const { logger } = require('@librechat/data-schemas');
const { Constants, ViolationTypes, ContentTypes, getResponseSender } = require('librechat-data-provider');
const {
  sendEvent,
  getViolationInfo,
  buildMessageFiles,
  GenerationJobManager,
  decrementPendingRequest,
  sanitizeMessageForTransmit,
  checkAndIncrementPendingRequest,
} = require('@librechat/api');
const { disposeClient, clientRegistry, requestDataMap } = require('~/server/cleanup');
const { handleAbortError } = require('~/server/middleware');
const { logViolation } = require('~/cache');
const { saveMessage, saveConvo } = require('~/models');
const {
  BLOCKED_REQUEST_RESPONSE,
  BLOCKED_USER_PLACEHOLDER,
  KYNS_PROJECT_PAUSED_REASON,
  KYNS_PROJECT_PAUSED_RESPONSE,
  SELF_HARM_CVV_RESPONSE,
} = require('~/server/services/safety/kynsPlatform');
const {
  ensureKynsTrace,
  logKynsTrace,
  summarizeText,
  summarizeError,
  snapshotKynsTrace,
  summarizeContentParts,
  summarizeEndpointOption,
} = require('~/server/utils/kynsTrace');
const { trackRunpodChatActivity } = require('~/server/services/runpodIdleStop');

function createCloseHandler(abortController) {
  return function (manual) {
    if (!manual) {
      logger.debug('[AgentController] Request closed');
    }
    if (!abortController) {
      return;
    } else if (abortController.signal.aborted) {
      return;
    } else if (abortController.requestCompleted) {
      return;
    }

    abortController.abort();
    logger.debug('[AgentController] Request aborted on close');
  };
}

function getBlockedResponseText(reason) {
  if (reason === 'SELF_HARM_METHOD') {
    return SELF_HARM_CVV_RESPONSE;
  }

  if (reason === KYNS_PROJECT_PAUSED_REASON) {
    return KYNS_PROJECT_PAUSED_RESPONSE;
  }

  return BLOCKED_REQUEST_RESPONSE;
}

async function emitBlockedSafetyResponse({
  req,
  res,
  userId,
  endpointOption,
  text,
  reason,
  parentMessageId,
  conversationId,
}) {
  const userMessageId = req.body?.messageId ?? crypto.randomUUID();
  const responseMessageId = req.body?.responseMessageId ?? crypto.randomUUID();
  const sender = getResponseSender(req.body);
  const model =
    endpointOption?.model_parameters?.model ?? endpointOption?.modelOptions?.model ?? undefined;
  const isProjectPaused = reason === KYNS_PROJECT_PAUSED_REASON;
  const userMessage = {
    sender: 'User',
    messageId: userMessageId,
    parentMessageId,
    conversationId,
    isCreatedByUser: true,
    text,
  };
  const storedUserMessage = {
    ...userMessage,
    text: isProjectPaused ? text : BLOCKED_USER_PLACEHOLDER,
    endpoint: endpointOption.endpoint,
    user: userId,
  };
  const responseText = getBlockedResponseText(reason);
  const responseMessage = {
    sender,
    messageId: responseMessageId,
    parentMessageId: userMessageId,
    conversationId,
    isCreatedByUser: false,
    text: responseText,
    content: [{ type: ContentTypes.TEXT, text: responseText }],
    unfinished: false,
    error: false,
    endpoint: endpointOption.endpoint,
    model,
    user: userId,
    agent_id: endpointOption.agent_id,
    spec: endpointOption.spec,
    iconURL: endpointOption.iconURL,
  };

  logger.warn(
    isProjectPaused
      ? '[AgentChat] Answered request with KYNS pause notice'
      : '[AgentChat] Blocked request by KYNS safety filter',
    {
      reason,
      userId,
      conversationId,
      endpoint: endpointOption.endpoint,
    },
  );

  try {
    await saveMessage(req, storedUserMessage, {
      context: 'api/server/controllers/agents/request.js - blocked user message',
    });
    await saveMessage(req, responseMessage, {
      context: 'api/server/controllers/agents/request.js - blocked response message',
    });

    const conversation = await saveConvo(
      req,
      {
        conversationId,
        endpoint: endpointOption.endpoint,
        endpointType: endpointOption.endpointType,
        promptPrefix: req.body?.promptPrefix,
        model,
        modelLabel: endpointOption.modelLabel,
        agent_id: endpointOption.agent_id,
        spec: endpointOption.spec,
        iconURL: endpointOption.iconURL,
      },
      { context: 'api/server/controllers/agents/request.js - blocked response conversation' },
    );

    return res.json({
      final: true,
      blocked: true,
      conversation,
      title: conversation?.title,
      requestMessage: sanitizeMessageForTransmit(userMessage),
      responseMessage: sanitizeMessageForTransmit(responseMessage),
    });
  } catch (error) {
    logger.error('[AgentChat] Failed to emit blocked safety response', error);
    return res.status(500).json({ error: error.message || 'Failed to emit blocked response' });
  }
}

/**
 * Resumable Agent Controller - Generation runs independently of HTTP connection.
 * Returns streamId immediately, client subscribes separately via SSE.
 */
const ResumableAgentController = async (req, res, next, initializeClient, addTitle) => {
  logger.info('[AgentChat] POST /chat received', {
    agent_id: req.body?.agent_id,
    conversationId: req.body?.conversationId,
    userId: req.user?.id,
  });

  const {
    text,
    isRegenerate,
    endpointOption,
    conversationId: reqConversationId,
    isContinued = false,
    editedContent = null,
    parentMessageId = null,
    overrideParentMessageId = null,
    responseMessageId: editedResponseMessageId = null,
  } = req.body;

  const userId = req.user.id;
  const conversationId =
    !reqConversationId || reqConversationId === 'new' ? crypto.randomUUID() : reqConversationId;
  const trace = ensureKynsTrace(req, {
    userId,
    conversationId,
    endpoint: endpointOption?.endpoint,
    spec: endpointOption?.spec,
  });
  logKynsTrace(trace, 'request.received', {
    text: summarizeText(text),
    isRegenerate,
    isContinued,
    endpointOption: summarizeEndpointOption(endpointOption),
  });

  if (req.kynsSafetyBlock?.blocked) {
    logKynsTrace(trace, 'request.blocked', {
      reason: req.kynsSafetyBlock.reason,
    });
    await emitBlockedSafetyResponse({
      req,
      res,
      userId,
      endpointOption,
      text,
      reason: req.kynsSafetyBlock.reason,
      parentMessageId: parentMessageId ?? Constants.NO_PARENT,
      conversationId,
    });
    return;
  }

  const { allowed, pendingRequests, limit } = await checkAndIncrementPendingRequest(userId);
  if (!allowed) {
    const violationInfo = getViolationInfo(pendingRequests, limit);
    await logViolation(req, res, ViolationTypes.CONCURRENT, violationInfo, violationInfo.score);
    return res.status(429).json(violationInfo);
  }

  const releaseRunpodActivity = trackRunpodChatActivity(endpointOption);

  // Generate conversationId upfront if not provided - streamId === conversationId always
  // Treat "new" as a placeholder that needs a real UUID (frontend may send "new" for new convos)
  const streamId = conversationId;

  let client = null;

  try {
    logger.debug(`[ResumableAgentController] Creating job`, {
      streamId,
      conversationId,
      reqConversationId,
      userId,
    });

    const job = await GenerationJobManager.createJob(streamId, userId, conversationId);
    const jobCreatedAt = job.createdAt; // Capture creation time to detect job replacement
    req._resumableStreamId = streamId;
    logKynsTrace(trace, 'request.jobCreated', {
      streamId,
      jobCreatedAt,
    });

    logger.info(`[ResumableAgentController] Job created streamId=${streamId} (conversationId=${conversationId})`);

    // Send JSON response IMMEDIATELY so client can connect to SSE stream
    // This is critical: tool loading (MCP OAuth) may emit events that the client needs to receive
    res.json({ streamId, conversationId, status: 'started' });

    // Note: We no longer use res.on('close') to abort since we send JSON immediately.
    // The response closes normally after res.json(), which is not an abort condition.
    // Abort handling is done through GenerationJobManager via the SSE stream connection.

    // Track if partial response was already saved to avoid duplicates
    let partialResponseSaved = false;

    /**
     * Listen for all subscribers leaving to save partial response.
     * This ensures the response is saved to DB even if all clients disconnect
     * while generation continues.
     *
     * Note: The messageId used here falls back to `${userMessage.messageId}_` if the
     * actual response messageId isn't available yet. The final response save will
     * overwrite this with the complete response using the same messageId pattern.
     */
    job.emitter.on('allSubscribersLeft', async (aggregatedContent) => {
      if (partialResponseSaved || !aggregatedContent || aggregatedContent.length === 0) {
        return;
      }

      const resumeState = await GenerationJobManager.getResumeState(streamId);
      if (!resumeState?.userMessage) {
        logger.debug('[ResumableAgentController] No user message to save partial response for');
        return;
      }

      partialResponseSaved = true;
      const responseConversationId = resumeState.conversationId || conversationId;

      try {
        const partialMessage = {
          messageId: resumeState.responseMessageId || `${resumeState.userMessage.messageId}_`,
          conversationId: responseConversationId,
          parentMessageId: resumeState.userMessage.messageId,
          sender: client?.sender ?? 'AI',
          content: aggregatedContent,
          unfinished: true,
          error: false,
          isCreatedByUser: false,
          user: userId,
          endpoint: endpointOption.endpoint,
          model: endpointOption.modelOptions?.model || endpointOption.model_parameters?.model,
        };

        if (req.body?.agent_id) {
          partialMessage.agent_id = req.body.agent_id;
        }

        await saveMessage(req, partialMessage, {
          context: 'api/server/controllers/agents/request.js - partial response on disconnect',
        });

        logger.debug(
          `[ResumableAgentController] Saved partial response for ${streamId}, content parts: ${aggregatedContent.length}`,
        );
      } catch (error) {
        logger.error('[ResumableAgentController] Error saving partial response:', error);
        // Reset flag so we can try again if subscribers reconnect and leave again
        partialResponseSaved = false;
      }
    });

    /** @type {{ client: TAgentClient; userMCPAuthMap?: Record<string, Record<string, string>> }} */
    const result = await initializeClient({
      req,
      res,
      endpointOption,
      // Use the job's abort controller signal - allows abort via GenerationJobManager.abortJob()
      signal: job.abortController.signal,
    });
    logKynsTrace(trace, 'request.initializeClient.done', {
      streamId,
      hasClient: Boolean(result?.client),
      hasUserMCPAuthMap: Boolean(result?.userMCPAuthMap),
    });

    if (job.abortController.signal.aborted) {
      logKynsTrace(trace, 'request.initialization.aborted', {
        streamId,
      });
      GenerationJobManager.completeJob(streamId, 'Request aborted during initialization');
      await decrementPendingRequest(userId);
      releaseRunpodActivity();
      return;
    }

    client = result.client;

    if (client?.sender) {
      GenerationJobManager.updateMetadata(streamId, { sender: client.sender });
    }

    // Store reference to client's contentParts - graph will be set when run is created
    if (client?.contentParts) {
      GenerationJobManager.setContentParts(streamId, client.contentParts);
    }

    let userMessage;

    const getReqData = (data = {}) => {
      if (data.userMessage) {
        userMessage = data.userMessage;
      }
      // conversationId is pre-generated, no need to update from callback
    };

    // Start background generation - readyPromise resolves immediately now
    // (sync mechanism handles late subscribers)
    const startGeneration = async () => {
      try {
        // Short timeout as safety net - promise should already be resolved
        await Promise.race([job.readyPromise, new Promise((resolve) => setTimeout(resolve, 100))]);
      } catch (waitError) {
        logger.warn(
          `[ResumableAgentController] Error waiting for subscriber: ${waitError.message}`,
        );
      }

      try {
        const onStart = (userMsg, respMsgId, _isNewConvo) => {
          userMessage = userMsg;
          logKynsTrace(trace, 'request.onStart', {
            streamId,
            userMessageId: userMsg.messageId,
            responseMessageId: respMsgId,
            text: summarizeText(userMsg.text),
          });

          // Store userMessage and responseMessageId upfront for resume capability
          GenerationJobManager.updateMetadata(streamId, {
            responseMessageId: respMsgId,
            userMessage: {
              messageId: userMsg.messageId,
              parentMessageId: userMsg.parentMessageId,
              conversationId: userMsg.conversationId,
              text: userMsg.text,
            },
          });

          GenerationJobManager.emitChunk(streamId, {
            created: true,
            message: userMessage,
            streamId,
          });
        };

        const messageOptions = {
          user: userId,
          onStart,
          getReqData,
          isContinued,
          isRegenerate,
          editedContent,
          conversationId,
          parentMessageId,
          abortController: job.abortController,
          overrideParentMessageId,
          isEdited: !!editedContent,
          userMCPAuthMap: result.userMCPAuthMap,
          responseMessageId: editedResponseMessageId,
          progressOptions: {
            res: {
              write: () => true,
              end: () => {},
              headersSent: false,
              writableEnded: false,
            },
          },
        };
        logKynsTrace(trace, 'request.sendMessage.start', {
          streamId,
          responseMessageId: editedResponseMessageId,
        });

        const response = await client.sendMessage(text, messageOptions);
        logKynsTrace(trace, 'request.sendMessage.done', {
          streamId,
          responseMessageId: response?.messageId,
          responseContent: summarizeContentParts(response?.content),
          clientContentParts: summarizeContentParts(client?.contentParts),
          traceSnapshot: snapshotKynsTrace(trace),
        });

        const messageId = response.messageId;
        const endpoint = endpointOption.endpoint;
        response.endpoint = endpoint;

        const databasePromise = response.databasePromise;
        delete response.databasePromise;

        const { conversation: convoData = {} } = await databasePromise;
        const conversation = { ...convoData };
        conversation.title =
          conversation && !conversation.title ? null : conversation?.title || 'New Chat';

        if (req.body.files && Array.isArray(client.options.attachments)) {
          const files = buildMessageFiles(req.body.files, client.options.attachments);
          if (files.length > 0) {
            userMessage.files = files;
          }
          delete userMessage.image_urls;
        }

        // Check abort state BEFORE calling completeJob (which triggers abort signal for cleanup)
        const wasAbortedBeforeComplete = job.abortController.signal.aborted;
        const isNewConvo = !reqConversationId || reqConversationId === 'new';
        const shouldGenerateTitle =
          addTitle &&
          parentMessageId === Constants.NO_PARENT &&
          isNewConvo &&
          !wasAbortedBeforeComplete;

        // Save user message BEFORE sending final event to avoid race condition
        // where client refetch happens before database is updated
        if (!client.skipSaveUserMessage && userMessage) {
          await saveMessage(req, userMessage, {
            context: 'api/server/controllers/agents/request.js - resumable user message',
          });
        }

        // CRITICAL: Save response message BEFORE emitting final event.
        // This prevents race conditions where the client sends a follow-up message
        // before the response is saved to the database, causing orphaned parentMessageIds.
        if (client.savedMessageIds && !client.savedMessageIds.has(messageId)) {
          await saveMessage(
            req,
            { ...response, user: userId, unfinished: wasAbortedBeforeComplete },
            { context: 'api/server/controllers/agents/request.js - resumable response end' },
          );
        }

        // Check if our job was replaced by a new request before emitting
        // This prevents stale requests from emitting events to newer jobs
        const currentJob = await GenerationJobManager.getJob(streamId);
        const jobWasReplaced = !currentJob || currentJob.createdAt !== jobCreatedAt;

        if (jobWasReplaced) {
          logKynsTrace(trace, 'request.jobReplaced', {
            streamId,
            originalCreatedAt: jobCreatedAt,
            currentCreatedAt: currentJob?.createdAt,
            traceSnapshot: snapshotKynsTrace(trace),
          });
          logger.debug(`[ResumableAgentController] Skipping FINAL emit - job was replaced`, {
            streamId,
            originalCreatedAt: jobCreatedAt,
            currentCreatedAt: currentJob?.createdAt,
          });
          // Still decrement pending request since we incremented at start
          await decrementPendingRequest(userId);
          return;
        }

        if (!wasAbortedBeforeComplete) {
          const finalEvent = {
            final: true,
            conversation,
            title: conversation.title,
            requestMessage: sanitizeMessageForTransmit(userMessage),
            responseMessage: { ...response },
          };
          logKynsTrace(trace, 'request.final.ready', {
            streamId,
            responseMessageId: response?.messageId,
            requestMessageId: userMessage?.messageId,
            responseContent: summarizeContentParts(response?.content),
            clientContentParts: summarizeContentParts(client?.contentParts),
            traceSnapshot: snapshotKynsTrace(trace),
          });

          logger.debug(`[ResumableAgentController] Emitting FINAL event`, {
            streamId,
            wasAbortedBeforeComplete,
            userMessageId: userMessage?.messageId,
            responseMessageId: response?.messageId,
            conversationId: conversation?.conversationId,
          });

          await GenerationJobManager.emitDone(streamId, finalEvent);
          GenerationJobManager.completeJob(streamId);
          await decrementPendingRequest(userId);
        } else {
          const finalEvent = {
            final: true,
            conversation,
            title: conversation.title,
            requestMessage: sanitizeMessageForTransmit(userMessage),
            responseMessage: { ...response, unfinished: true },
          };
          logKynsTrace(trace, 'request.final.aborted', {
            streamId,
            responseMessageId: response?.messageId,
            requestMessageId: userMessage?.messageId,
            traceSnapshot: snapshotKynsTrace(trace),
          });

          logger.debug(`[ResumableAgentController] Emitting ABORTED FINAL event`, {
            streamId,
            wasAbortedBeforeComplete,
            userMessageId: userMessage?.messageId,
            responseMessageId: response?.messageId,
            conversationId: conversation?.conversationId,
          });

          await GenerationJobManager.emitDone(streamId, finalEvent);
          GenerationJobManager.completeJob(streamId, 'Request aborted');
          await decrementPendingRequest(userId);
        }

        if (shouldGenerateTitle) {
          addTitle(req, {
            text,
            response: { ...response },
            client,
          })
            .catch((err) => {
              logger.error('[ResumableAgentController] Error in title generation', err);
            })
            .finally(() => {
              if (client) {
                disposeClient(client);
              }
            });
        } else {
          if (client) {
            disposeClient(client);
          }
        }
      } catch (error) {
        // Check if this was an abort (not a real error)
        const wasAborted = job.abortController.signal.aborted || error.message?.includes('abort');

        if (wasAborted) {
          logKynsTrace(trace, 'request.generation.aborted', {
            streamId,
            traceSnapshot: snapshotKynsTrace(trace),
          });
          logger.debug(`[ResumableAgentController] Generation aborted for ${streamId}`);
          // abortJob already handled emitDone and completeJob
        } else {
          logKynsTrace(trace, 'request.generation.error', {
            streamId,
            error: summarizeError(error),
            traceSnapshot: snapshotKynsTrace(trace),
          });
          logger.error(`[ResumableAgentController] Generation error for ${streamId}:`, error);
          await GenerationJobManager.emitError(streamId, error.message || 'Generation failed');
          GenerationJobManager.completeJob(streamId, error.message);
        }

        await decrementPendingRequest(userId);

        if (client) {
          disposeClient(client);
        }

        // Don't continue to title generation after error/abort
        return;
      } finally {
        releaseRunpodActivity();
      }
    };

    // Start generation and handle any unhandled errors
    startGeneration().catch(async (err) => {
      logger.error(
        `[ResumableAgentController] Unhandled error in background generation: ${err.message}`,
      );
      await GenerationJobManager.emitError(streamId, err.message || 'Generation failed');
      GenerationJobManager.completeJob(streamId, err.message);
      await decrementPendingRequest(userId);
    });
  } catch (error) {
    releaseRunpodActivity();
    logKynsTrace(trace, 'request.initialization.error', {
      error: summarizeError(error),
      traceSnapshot: snapshotKynsTrace(trace),
    });
    logger.error('[ResumableAgentController] Initialization error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to start generation' });
    } else {
      // JSON already sent, emit error to stream so client can receive it
      await GenerationJobManager.emitError(streamId, error.message || 'Failed to start generation');
    }
    GenerationJobManager.completeJob(streamId, error.message);
    await decrementPendingRequest(userId);
    if (client) {
      disposeClient(client);
    }
  }
};

const AgentController = ResumableAgentController;

module.exports = AgentController;
