import { useEffect, useState, useRef, useCallback } from 'react';
import { v4 } from 'uuid';
import { SSE } from 'sse.js';
import { useSetRecoilState } from 'recoil';
import { useQueryClient } from '@tanstack/react-query';
import {
  request,
  Constants,
  QueryKeys,
  ErrorTypes,
  apiBaseUrl,
  createPayload,
  ViolationTypes,
  LocalStorageKeys,
  removeNullishValues,
} from 'librechat-data-provider';
import type { TMessage, TPayload, TSubmission, EventSubmission } from 'librechat-data-provider';
import type { EventHandlerParams } from './useEventHandlers';
import { useGetStartupConfig, useGetUserBalance, queueTitleGeneration } from '~/data-provider';
import type { ActiveJobsResponse } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import useLocalize from '~/hooks/useLocalize';
import useEventHandlers from './useEventHandlers';
import store from '~/store';

const clearDraft = (conversationId?: string | null) => {
  if (conversationId) {
    localStorage.removeItem(`${LocalStorageKeys.TEXT_DRAFT}${conversationId}`);
    localStorage.removeItem(`${LocalStorageKeys.FILES_DRAFT}${conversationId}`);
  } else {
    localStorage.removeItem(`${LocalStorageKeys.TEXT_DRAFT}${Constants.NEW_CONVO}`);
    localStorage.removeItem(`${LocalStorageKeys.FILES_DRAFT}${Constants.NEW_CONVO}`);
  }
};

type ChatHelpers = Pick<
  EventHandlerParams,
  | 'setMessages'
  | 'getMessages'
  | 'setConversation'
  | 'setIsSubmitting'
  | 'newConversation'
  | 'resetLatestMessage'
>;

const MAX_RETRIES = 5;

/**
 * Hook for resumable SSE streams.
 * Separates generation start (POST) from stream subscription (GET EventSource).
 * Supports auto-reconnection with exponential backoff.
 *
 * Key behavior:
 * - Navigation away does NOT abort the generation (just closes SSE)
 * - Only explicit abort (via stop button → backend abort endpoint) stops generation
 * - Backend emits `done` event with `aborted: true` on abort, handled via finalHandler
 */
export default function useResumableSSE(
  submission: TSubmission | null,
  chatHelpers: ChatHelpers,
  isAddedRequest = false,
  runIndex = 0,
) {
  const queryClient = useQueryClient();
  const setActiveRunId = useSetRecoilState(store.activeRunFamily(runIndex));

  const { token, isAuthenticated } = useAuthContext();
  const localize = useLocalize();

  /**
   * Optimistically add a job ID to the active jobs cache.
   * Called when generation starts.
   */
  const addActiveJob = useCallback(
    (jobId: string) => {
      queryClient.setQueryData<ActiveJobsResponse>([QueryKeys.activeJobs], (old) => ({
        activeJobIds: [...new Set([...(old?.activeJobIds ?? []), jobId])],
      }));
    },
    [queryClient],
  );

  /**
   * Optimistically remove a job ID from the active jobs cache.
   * Called when generation completes, aborts, or errors.
   */
  const removeActiveJob = useCallback(
    (jobId: string) => {
      queryClient.setQueryData<ActiveJobsResponse>([QueryKeys.activeJobs], (old) => ({
        activeJobIds: (old?.activeJobIds ?? []).filter((id) => id !== jobId),
      }));
    },
    [queryClient],
  );
  const [_completed, setCompleted] = useState(new Set());
  const [streamId, setStreamId] = useState<string | null>(null);
  const setAbortScroll = useSetRecoilState(store.abortScrollFamily(runIndex));
  const setShowStopButton = useSetRecoilState(store.showStopButtonByIndex(runIndex));

  const sseRef = useRef<SSE | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const submissionRef = useRef<TSubmission | null>(null);

  const {
    setMessages,
    getMessages,
    setConversation,
    setIsSubmitting,
    newConversation,
    resetLatestMessage,
  } = chatHelpers;

  const {
    stepHandler,
    finalHandler,
    errorHandler,
    clearStepMaps,
    messageHandler,
    contentHandler,
    createdHandler,
    syncStepMessage,
    attachmentHandler,
    resetContentHandler,
  } = useEventHandlers({
    setMessages,
    getMessages,
    setCompleted,
    isAddedRequest,
    setConversation,
    setIsSubmitting,
    newConversation,
    setShowStopButton,
    resetLatestMessage,
  });

  const { data: startupConfig } = useGetStartupConfig();
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && startupConfig?.balance?.enabled,
  });

  /**
   * Subscribe to stream via SSE library (supports custom headers)
   * Follows same auth pattern as useSSE
   * @param isResume - If true, adds ?resume=true to trigger sync event from server
   */
  const subscribeToStream = useCallback(
    (currentStreamId: string, currentSubmission: TSubmission, isResume = false) => {
      let { userMessage } = currentSubmission;
      let textIndex: number | null = null;

      const baseUrl = `${apiBaseUrl()}/api/agents/chat/stream/${encodeURIComponent(currentStreamId)}`;
      const url = isResume ? `${baseUrl}?resume=true` : baseUrl;
      console.log('[ResumableSSE] Subscribing to stream:', url, { isResume });

      const sse = new SSE(url, {
        headers: { Authorization: `Bearer ${token}` },
        method: 'GET',
      });
      sseRef.current = sse;

      sse.addEventListener('open', () => {
        console.log('[ResumableSSE] Stream connected');
        setAbortScroll(false);
        // Restore UI state on successful connection (including reconnection)
        setIsSubmitting(true);
        setShowStopButton(true);
        reconnectAttemptRef.current = 0;
      });

      sse.addEventListener('message', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);

          if (data.final != null) {
            console.log('[ResumableSSE] Received FINAL event', {
              aborted: data.aborted,
              conversationId: data.conversation?.conversationId,
              hasResponseMessage: !!data.responseMessage,
            });
            clearDraft(currentSubmission.conversation?.conversationId);
            try {
              finalHandler(data, currentSubmission as EventSubmission);
            } catch (error) {
              console.error('[ResumableSSE] Error in finalHandler:', error);
              setIsSubmitting(false);
              setShowStopButton(false);
            }
            // Clear handler maps on stream completion to prevent memory leaks
            clearStepMaps();
            // Optimistically remove from active jobs
            removeActiveJob(currentStreamId);
            (startupConfig?.balance?.enabled ?? false) && balanceQuery.refetch();
            sse.close();
            setStreamId(null);
            return;
          }

          if (data.created != null) {
            console.log('[ResumableSSE] Received CREATED event', {
              messageId: data.message?.messageId,
              conversationId: data.message?.conversationId,
            });
            const runId = v4();
            setActiveRunId(runId);
            userMessage = {
              ...userMessage,
              ...data.message,
              overrideParentMessageId: userMessage.overrideParentMessageId,
            };
            createdHandler(data, { ...currentSubmission, userMessage } as EventSubmission);
            return;
          }

          if (data.event === 'attachment' && data.data) {
            attachmentHandler({
              data: data.data,
              submission: currentSubmission as EventSubmission,
            });
            return;
          }

          if (data.event != null) {
            stepHandler(data, { ...currentSubmission, userMessage } as EventSubmission);
            return;
          }

          if (data.sync != null) {
            console.log('[ResumableSSE] SYNC received', {
              runSteps: data.resumeState?.runSteps?.length ?? 0,
            });

            const runId = v4();
            setActiveRunId(runId);

            // Replay run steps
            if (data.resumeState?.runSteps) {
              for (const runStep of data.resumeState.runSteps) {
                stepHandler({ event: 'on_run_step', data: runStep }, {
                  ...currentSubmission,
                  userMessage,
                } as EventSubmission);
              }
            }

            // Set message content from aggregatedContent
            if (data.resumeState?.aggregatedContent && userMessage?.messageId) {
              const messages = getMessages() ?? [];
              const userMsgId = userMessage.messageId;
              const serverResponseId = data.resumeState.responseMessageId;

              // Find the EXACT response message - prioritize responseMessageId from server
              // This is critical when there are multiple responses to the same user message
              let responseIdx = -1;
              if (serverResponseId) {
                responseIdx = messages.findIndex((m) => m.messageId === serverResponseId);
              }
              // Fallback: find by parentMessageId pattern (for new messages)
              if (responseIdx < 0) {
                responseIdx = messages.findIndex(
                  (m) =>
                    !m.isCreatedByUser &&
                    (m.messageId === `${userMsgId}_` || m.parentMessageId === userMsgId),
                );
              }

              console.log('[ResumableSSE] SYNC update', {
                userMsgId,
                serverResponseId,
                responseIdx,
                foundMessageId: responseIdx >= 0 ? messages[responseIdx]?.messageId : null,
                messagesCount: messages.length,
                aggregatedContentLength: data.resumeState.aggregatedContent?.length,
              });

              if (responseIdx >= 0) {
                // Update existing response message with aggregatedContent
                const updated = [...messages];
                const oldContent = updated[responseIdx]?.content;
                updated[responseIdx] = {
                  ...updated[responseIdx],
                  content: data.resumeState.aggregatedContent,
                };
                console.log('[ResumableSSE] SYNC updating message', {
                  messageId: updated[responseIdx]?.messageId,
                  oldContentLength: Array.isArray(oldContent) ? oldContent.length : 0,
                  newContentLength: data.resumeState.aggregatedContent?.length,
                });
                setMessages(updated);
                // Sync both content handler and step handler with the updated message
                // so subsequent deltas build on synced content, not stale content
                resetContentHandler();
                syncStepMessage(updated[responseIdx]);
                console.log('[ResumableSSE] SYNC complete, handlers synced');
              } else {
                // Add new response message
                const responseId = serverResponseId ?? `${userMsgId}_`;
                setMessages([
                  ...messages,
                  {
                    messageId: responseId,
                    parentMessageId: userMsgId,
                    conversationId: currentSubmission.conversation?.conversationId ?? '',
                    text: '',
                    content: data.resumeState.aggregatedContent,
                    isCreatedByUser: false,
                  } as TMessage,
                ]);
              }
            }

            setIsSubmitting(true);
            setShowStopButton(true);
            return;
          }

          if (data.type != null) {
            const { text, index } = data;
            if (text != null && index !== textIndex) {
              textIndex = index;
            }
            contentHandler({ data, submission: currentSubmission as EventSubmission });
            return;
          }

          if (data.message != null) {
            const text = data.text ?? data.response;
            const initialResponse = {
              ...(currentSubmission.initialResponse as TMessage),
              parentMessageId: data.parentMessageId,
              messageId: data.messageId,
            };
            messageHandler(text, { ...currentSubmission, userMessage, initialResponse });
          }
        } catch (error) {
          console.error('[ResumableSSE] Error processing message:', error);
        }
      });

      /**
       * Error event handler - handles BOTH:
       * 1. HTTP-level errors (responseCode present) - 404, 401, network failures
       * 2. Server-sent error events (event: error with data) - known errors like ViolationTypes/ErrorTypes
       *
       * Order matters: check responseCode first since HTTP errors may also include data
       */
      sse.addEventListener('error', async (e: MessageEvent) => {
        (startupConfig?.balance?.enabled ?? false) && balanceQuery.refetch();

        /* @ts-ignore - sse.js types don't expose responseCode */
        const responseCode = e.responseCode;

        // 404 means job doesn't exist (wrong instance or expired) - show user-facing error
        if (responseCode === 404) {
          console.log('[ResumableSSE] Stream not found (404) - job completed or wrong instance');
          sse.close();
          removeActiveJob(currentStreamId);
          setIsSubmitting(false);
          setShowStopButton(false);
          setStreamId(null);
          reconnectAttemptRef.current = 0;
          errorHandler({
            data: {
              text: localize('com_agents_error_stream_not_found_message'),
            } as unknown as Parameters<typeof errorHandler>[0]['data'],
            submission: currentSubmission as EventSubmission,
          });
          return;
        }

        // Check for 401 and try to refresh token (same pattern as useSSE)
        if (responseCode === 401) {
          try {
            const refreshResponse = await request.refreshToken();
            const newToken = refreshResponse?.token ?? '';
            if (!newToken) {
              throw new Error('Token refresh failed.');
            }
            sse.headers = {
              Authorization: `Bearer ${newToken}`,
            };
            request.dispatchTokenUpdatedEvent(newToken);
            sse.stream();
            return;
          } catch (error) {
            console.log('[ResumableSSE] Token refresh failed:', error);
          }
        }

        /**
         * Server-sent error event (event: error with data) - no responseCode.
         * These are known errors (ErrorTypes, ViolationTypes) that should be displayed to user.
         * Only check e.data if there's no HTTP responseCode, since HTTP errors may also have body data.
         */
        if (!responseCode && e.data) {
          console.log('[ResumableSSE] Server-sent error event received:', e.data);
          sse.close();
          removeActiveJob(currentStreamId);

          try {
            const errorData = JSON.parse(e.data);
            const errorString = errorData.error ?? errorData.message ?? JSON.stringify(errorData);

            // Check if it's a known error type (ViolationTypes or ErrorTypes)
            let isKnownError = false;
            try {
              const parsed =
                typeof errorString === 'string' ? JSON.parse(errorString) : errorString;
              const errorType = parsed?.type ?? parsed?.code;
              if (errorType) {
                const violationValues = Object.values(ViolationTypes) as string[];
                const errorTypeValues = Object.values(ErrorTypes) as string[];
                isKnownError =
                  violationValues.includes(errorType) || errorTypeValues.includes(errorType);
              }
            } catch {
              // Not JSON or parsing failed - treat as generic error
            }

            console.log('[ResumableSSE] Error type check:', { isKnownError, errorString });

            // Display the error to user via errorHandler
            errorHandler({
              data: { text: errorString } as unknown as Parameters<typeof errorHandler>[0]['data'],
              submission: currentSubmission as EventSubmission,
            });
          } catch (parseError) {
            console.error('[ResumableSSE] Failed to parse server error:', parseError);
            errorHandler({
              data: { text: e.data } as unknown as Parameters<typeof errorHandler>[0]['data'],
              submission: currentSubmission as EventSubmission,
            });
          }

          setIsSubmitting(false);
          setShowStopButton(false);
          setStreamId(null);
          reconnectAttemptRef.current = 0;
          return;
        }

        // Network failure or unknown HTTP error - attempt reconnection with backoff
        console.log('[ResumableSSE] Stream error (network failure) - will attempt reconnect', {
          responseCode,
          hasData: !!e.data,
        });

        if (reconnectAttemptRef.current < MAX_RETRIES) {
          // Increment counter BEFORE close() so abort handler knows we're reconnecting
          reconnectAttemptRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current - 1), 30000);

          console.log(
            `[ResumableSSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current}/${MAX_RETRIES})`,
          );

          sse.close();

          reconnectTimeoutRef.current = setTimeout(() => {
            if (submissionRef.current) {
              // Reconnect with isResume=true to get sync event with any missed content
              subscribeToStream(currentStreamId, submissionRef.current, true);
            }
          }, delay);

          // Keep UI in "submitting" state during reconnection attempts
          // so user knows we're still trying (abort handler may have reset these)
          setIsSubmitting(true);
          setShowStopButton(true);
        } else {
          console.error('[ResumableSSE] Max reconnect attempts reached');
          sse.close();
          errorHandler({ data: undefined, submission: currentSubmission as EventSubmission });
          // Optimistically remove from active jobs on max retries
          removeActiveJob(currentStreamId);
          setIsSubmitting(false);
          setShowStopButton(false);
          setStreamId(null);
        }
      });

      /**
       * Abort event - fired when sse.close() is called (intentional close).
       * This happens on cleanup/navigation OR when error handler closes to reconnect.
       * Only reset state if we're NOT in a reconnection cycle.
       */
      sse.addEventListener('abort', () => {
        // If we're in a reconnection cycle, don't reset state
        // (error handler will set up the reconnect timeout)
        if (reconnectAttemptRef.current > 0) {
          console.log('[ResumableSSE] Stream closed for reconnect - preserving state');
          return;
        }

        console.log('[ResumableSSE] Stream aborted (intentional close) - no reconnect');
        // Clear any pending reconnect attempts
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        // Reset UI state - useResumeOnLoad will restore if user returns to this conversation
        setIsSubmitting(false);
        setShowStopButton(false);
        setStreamId(null);
      });

      // Start the SSE connection
      sse.stream();

      // Debug hooks for testing reconnection vs clean close behavior (dev only)
      if (import.meta.env.DEV) {
        const debugWindow = window as Window & {
          __sse?: SSE;
          __killNetwork?: () => void;
          __closeClean?: () => void;
        };
        debugWindow.__sse = sse;

        /** Simulate network drop - triggers error event → reconnection */
        debugWindow.__killNetwork = () => {
          console.log('[Debug] Simulating network drop...');
          // @ts-ignore - sse.js types are incorrect, dispatchEvent actually takes Event
          sse.dispatchEvent(new Event('error'));
        };

        /** Simulate clean close (navigation away) - triggers abort event → no reconnection */
        debugWindow.__closeClean = () => {
          console.log('[Debug] Simulating clean close (navigation away)...');
          sse.close();
        };
      }
    },
    [
      token,
      setAbortScroll,
      setActiveRunId,
      setShowStopButton,
      finalHandler,
      createdHandler,
      attachmentHandler,
      stepHandler,
      contentHandler,
      resetContentHandler,
      syncStepMessage,
      clearStepMaps,
      messageHandler,
      errorHandler,
      setIsSubmitting,
      getMessages,
      setMessages,
      startupConfig?.balance?.enabled,
      balanceQuery,
      removeActiveJob,
    ],
  );

  /**
   * Consume agent stream when backend returns it inline (no Redis / legacy mode).
   * Parses SSE from the POST response body and dispatches to the same handlers as GET stream.
   */
  const subscribeToInlineStream = useCallback(
    async (response: Response, currentSubmission: TSubmission) => {
      const streamId = 'inline';
      let userMessage = currentSubmission.userMessage;
      let textIndex: number | null = null;
      const state = { userMessage, textIndex };

      const processEvent = (data: Record<string, unknown>) => {
        if (data.final != null) {
          clearDraft(currentSubmission.conversation?.conversationId);
          try {
            finalHandler(data as Parameters<typeof finalHandler>[0], currentSubmission as EventSubmission);
          } catch {
            setIsSubmitting(false);
            setShowStopButton(false);
          }
          clearStepMaps();
          removeActiveJob(streamId);
          (startupConfig?.balance?.enabled ?? false) && balanceQuery.refetch();
          setStreamId(null);
          return;
        }
        if (data.created != null) {
          const runId = v4();
          setActiveRunId(runId);
          state.userMessage = {
            ...state.userMessage,
            ...(data.message as Record<string, unknown>),
            overrideParentMessageId: state.userMessage.overrideParentMessageId,
          } as TMessage;
          createdHandler(
            data as Parameters<typeof createdHandler>[0],
            { ...currentSubmission, userMessage: state.userMessage } as EventSubmission,
          );
          return;
        }
        if (data.event === 'attachment' && data.data) {
          attachmentHandler({
            data: data.data as Parameters<typeof attachmentHandler>[0]['data'],
            submission: currentSubmission as EventSubmission,
          });
          return;
        }
        if (data.event != null) {
          stepHandler(data as Parameters<typeof stepHandler>[0], {
            ...currentSubmission,
            userMessage: state.userMessage,
          } as EventSubmission);
          return;
        }
        if (data.sync != null) {
          const runId = v4();
          setActiveRunId(runId);
          const syncData = data as { resumeState?: { runSteps?: unknown[]; aggregatedContent?: unknown; responseMessageId?: string } };
          if (syncData.resumeState?.runSteps) {
            for (const runStep of syncData.resumeState.runSteps) {
              stepHandler(
                { event: 'on_run_step', data: runStep },
                { ...currentSubmission, userMessage: state.userMessage } as EventSubmission,
              );
            }
          }
          if (syncData.resumeState?.aggregatedContent && state.userMessage?.messageId) {
            const messages = getMessages() ?? [];
            const userMsgId = state.userMessage.messageId;
            const serverResponseId = syncData.resumeState.responseMessageId;
            let responseIdx = serverResponseId
              ? messages.findIndex((m) => m.messageId === serverResponseId)
              : -1;
            if (responseIdx < 0) {
              responseIdx = messages.findIndex(
                (m) =>
                  !m.isCreatedByUser &&
                  (m.messageId === `${userMsgId}_` || m.parentMessageId === userMsgId),
              );
            }
            if (responseIdx >= 0) {
              const updated = [...messages];
              updated[responseIdx] = {
                ...updated[responseIdx],
                content: syncData.resumeState.aggregatedContent,
              };
              setMessages(updated);
              resetContentHandler();
              syncStepMessage(updated[responseIdx]);
            } else {
              const responseId = serverResponseId ?? `${userMsgId}_`;
              setMessages([
                ...messages,
                {
                  messageId: responseId,
                  parentMessageId: userMsgId,
                  conversationId: currentSubmission.conversation?.conversationId ?? '',
                  text: '',
                  content: syncData.resumeState.aggregatedContent,
                  isCreatedByUser: false,
                } as TMessage,
              ]);
            }
          }
          setIsSubmitting(true);
          setShowStopButton(true);
          return;
        }
        if (data.type != null) {
          const { text, index } = data as { text?: string; index?: number };
          if (text != null && index !== state.textIndex) {
            state.textIndex = index ?? null;
          }
          contentHandler({
            data: data as Parameters<typeof contentHandler>[0]['data'],
            submission: currentSubmission as EventSubmission,
          });
          return;
        }
        if (data.message != null) {
          const msgData = data as {
            text?: string;
            response?: string;
            parentMessageId?: string;
            messageId?: string;
          };
          const text = msgData.text ?? msgData.response;
          const initialResponse = {
            ...(currentSubmission.initialResponse as TMessage),
            parentMessageId: msgData.parentMessageId,
            messageId: msgData.messageId,
          };
          messageHandler(text, {
            ...currentSubmission,
            userMessage: state.userMessage,
            initialResponse,
          } as EventSubmission);
        }
      };

      setAbortScroll(false);
      setIsSubmitting(true);
      setShowStopButton(true);

      try {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        if (!reader) {
          throw new Error('No response body');
        }
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            if (!part.trim()) continue;
            let eventType = 'message';
            let dataStr = '';
            for (const line of part.split('\n')) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                dataStr = line.slice(6);
              }
            }
            if (eventType === 'error') {
              try {
                const errMsg = JSON.parse(dataStr) as string;
                errorHandler({
                  data: { text: errMsg } as unknown as Parameters<typeof errorHandler>[0]['data'],
                  submission: currentSubmission as EventSubmission,
                });
              } catch {
                errorHandler({
                  data: { text: dataStr } as unknown as Parameters<typeof errorHandler>[0]['data'],
                  submission: currentSubmission as EventSubmission,
                });
              }
              setIsSubmitting(false);
              setShowStopButton(false);
              removeActiveJob(streamId);
              setStreamId(null);
              return;
            }
            try {
              const data = JSON.parse(dataStr) as Record<string, unknown>;
              processEvent(data);
            } catch {
              // skip malformed chunk
            }
          }
        }
      } catch (err) {
        console.error('[ResumableSSE] Inline stream error:', err);
        errorHandler({ data: undefined, submission: currentSubmission as EventSubmission });
        removeActiveJob(streamId);
        setStreamId(null);
      } finally {
        setIsSubmitting(false);
        setShowStopButton(false);
      }
    },
    [
      clearDraft,
      finalHandler,
      clearStepMaps,
      removeActiveJob,
      setStreamId,
      setAbortScroll,
      setActiveRunId,
      setIsSubmitting,
      setShowStopButton,
      createdHandler,
      attachmentHandler,
      stepHandler,
      getMessages,
      setMessages,
      resetContentHandler,
      syncStepMessage,
      contentHandler,
      messageHandler,
      errorHandler,
      startupConfig?.balance?.enabled,
      balanceQuery,
    ],
  );

  /**
   * Start generation (POST request).
   * When backend uses Redis: returns streamId, client then GETs the stream.
   * When backend has no Redis (legacy): response is the stream itself (inline).
   */
  const startGeneration = useCallback(
    async (
      currentSubmission: TSubmission,
    ): Promise<string | { inlineStream: Response } | null> => {
      const payloadData = createPayload(currentSubmission);
      let { payload } = payloadData;
      payload = removeNullishValues(payload) as TPayload;

      clearStepMaps();

      const url = payloadData.server;

      const maxRetries = 3;
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          const contentType = res.headers.get('content-type') ?? '';
          if (contentType.includes('text/event-stream')) {
            console.log('[ResumableSSE] Inline stream (legacy mode, no Redis)');
            return { inlineStream: res };
          }

          if (!res.ok) {
            const errBody = await res.text();
            try {
              lastError = { status: res.status, data: JSON.parse(errBody) };
            } catch {
              lastError = { status: res.status, data: errBody };
            }
            break;
          }

          const data = (await res.json()) as { streamId: string };
          console.log('[ResumableSSE] Generation started:', { streamId: data.streamId });
          return data.streamId;
        } catch (error) {
          lastError = error;
          // Check if it's a network error (retry) vs server error (don't retry)
          const isNetworkError =
            error instanceof Error &&
            'code' in error &&
            (error.code === 'ERR_NETWORK' || error.code === 'ERR_INTERNET_DISCONNECTED');

          if (isNetworkError && attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
            console.log(
              `[ResumableSSE] Network error starting generation, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          // Don't retry: either not a network error or max retries reached
          break;
        }
      }

      console.error('[ResumableSSE] Error starting generation:', lastError);

      const err = lastError as { status?: number; data?: Record<string, unknown> };
      const errorData = err?.data;
      if (errorData) {
        errorHandler({
          data: { text: JSON.stringify(errorData) } as unknown as Parameters<
            typeof errorHandler
          >[0]['data'],
          submission: currentSubmission as EventSubmission,
        });
      } else {
        errorHandler({ data: undefined, submission: currentSubmission as EventSubmission });
      }
      setIsSubmitting(false);
      return null;
    },
    [clearStepMaps, errorHandler, setIsSubmitting, token],
  );

  useEffect(() => {
    if (!submission || Object.keys(submission).length === 0) {
      console.log('[ResumableSSE] No submission, cleaning up');
      // Clear reconnect timeout if submission is cleared
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Close SSE but do NOT dispatch cancel - navigation should not abort
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      setStreamId(null);
      reconnectAttemptRef.current = 0;
      submissionRef.current = null;
      return;
    }

    const resumeStreamId = (submission as TSubmission & { resumeStreamId?: string }).resumeStreamId;
    console.log('[ResumableSSE] Effect triggered', {
      conversationId: submission.conversation?.conversationId,
      hasResumeStreamId: !!resumeStreamId,
      resumeStreamId,
      userMessageId: submission.userMessage?.messageId,
    });

    submissionRef.current = submission;

    const initStream = async () => {
      setIsSubmitting(true);
      setShowStopButton(true);

      if (resumeStreamId) {
        // Resume: just subscribe to existing stream, don't start new generation
        console.log('[ResumableSSE] Resuming existing stream:', resumeStreamId);
        setStreamId(resumeStreamId);
        // Optimistically add to active jobs (in case it's not already there)
        addActiveJob(resumeStreamId);
        subscribeToStream(resumeStreamId, submission, true); // isResume=true
      } else {
        // New generation: start and then subscribe (or consume inline stream when no Redis)
        console.log('[ResumableSSE] Starting NEW generation');
        const result = await startGeneration(submission);
        if (result && typeof result === 'object' && 'inlineStream' in result) {
          setStreamId('inline');
          addActiveJob('inline');
          subscribeToInlineStream(result.inlineStream, submission);
        } else if (typeof result === 'string') {
          setStreamId(result);
          addActiveJob(result);
          const isNewConvo = submission.userMessage?.parentMessageId === Constants.NO_PARENT;
          if (isNewConvo) {
            queueTitleGeneration(result);
          }
          subscribeToStream(result, submission);
        } else {
          console.error('[ResumableSSE] Failed to get streamId from startGeneration');
        }
      }
    };

    initStream();

    return () => {
      console.log('[ResumableSSE] Cleanup - closing SSE, resetting UI state');
      // Cleanup on unmount/navigation - close connection but DO NOT abort backend
      // Reset UI state so it doesn't leak to other conversations
      // If user returns to this conversation, useResumeOnLoad will restore the state
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Reset reconnect counter before closing (so abort handler doesn't think we're reconnecting)
      reconnectAttemptRef.current = 0;
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      // Clear handler maps to prevent memory leaks and stale state
      clearStepMaps();
      // Reset UI state on cleanup - useResumeOnLoad will restore if needed
      setIsSubmitting(false);
      setShowStopButton(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission]);

  return { streamId };
}
