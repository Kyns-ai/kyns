import React, { useMemo, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { useRecoilValue } from 'recoil';
import {
  ContentTypes,
  dataService,
  extractSuggestions,
  type TMessageContentParts,
} from 'librechat-data-provider';
import type { TMessageProps, TMessageIcon } from '~/common';
import { useMessageHelpers, useLocalize, useAttachments, useContentMetadata, useSubmitMessage } from '~/hooks';
import { useGetStartupConfig } from '~/data-provider';
import SuggestionChips from '~/components/Chat/Messages/Content/Parts/SuggestionChips';
import MessageIcon from '~/components/Chat/Messages/MessageIcon';
import AvatarLightbox from '~/components/Chat/Messages/AvatarLightbox';
import ContentParts from './Content/ContentParts';
import { fontSizeAtom } from '~/store/fontSize';
import SiblingSwitch from './SiblingSwitch';
import MultiMessage from './MultiMessage';
import HoverButtons from './HoverButtons';
import SubRow from './SubRow';
import { cn, getMessageAriaLabel, getAgentAvatarUrl } from '~/utils';
import store from '~/store';

export default function Message(props: TMessageProps) {
  const localize = useLocalize();
  const { message, siblingIdx, siblingCount, setSiblingIdx, currentEditId, setCurrentEditId } =
    props;
  const { attachments, searchResults } = useAttachments({
    messageId: message?.messageId,
    attachments: message?.attachments,
  });
  const {
    edit,
    index,
    agent,
    isLast,
    enterEdit,
    assistant,
    handleScroll,
    conversation,
    isSubmitting,
    latestMessage,
    handleContinue,
    copyToClipboard,
    regenerateMessage,
  } = useMessageHelpers(props);

  const fontSize = useAtomValue(fontSizeAtom);
  const maximizeChatSpace = useRecoilValue(store.maximizeChatSpace);
  const { children, messageId = null, isCreatedByUser } = message ?? {};

  const name = useMemo(() => {
    let result = '';
    if (isCreatedByUser === true) {
      result = localize('com_user_message');
    } else if (assistant) {
      result = assistant.name ?? localize('com_ui_assistant');
    } else if (agent) {
      result = agent.name ?? localize('com_ui_agent');
    }

    return result;
  }, [assistant, agent, isCreatedByUser, localize]);

  const iconData: TMessageIcon = useMemo(
    () => ({
      endpoint: message?.endpoint ?? conversation?.endpoint,
      model: message?.model ?? conversation?.model,
      iconURL: message?.iconURL ?? conversation?.iconURL,
      modelLabel: name,
      isCreatedByUser: message?.isCreatedByUser,
    }),
    [
      name,
      conversation?.endpoint,
      conversation?.iconURL,
      conversation?.model,
      message?.model,
      message?.iconURL,
      message?.endpoint,
      message?.isCreatedByUser,
    ],
  );

  const { hasParallelContent } = useContentMetadata(message);
  const showResponseTimer = useMemo(
    () => !!conversation?.endpoint && !message.isCreatedByUser,
    [conversation?.endpoint, message?.isCreatedByUser],
  );
  const showSuggestions = useRecoilValue(store.showSuggestions);
  const { data: startupConfig } = useGetStartupConfig();
  const adminSuggestionsEnabled = startupConfig?.interface?.suggestions !== false;

  const suggestions = useMemo(() => {
    if (
      !isLast ||
      isSubmitting ||
      message?.isCreatedByUser ||
      !showSuggestions ||
      !adminSuggestionsEnabled ||
      !message?.content
    ) {
      return [];
    }
    const content = message.content as Array<TMessageContentParts | undefined>;
    for (let i = content.length - 1; i >= 0; i--) {
      const part = content[i];
      if (!part || part.type !== ContentTypes.TEXT) {
        continue;
      }
      const rawText = typeof part.text === 'string' ? part.text : part.text?.value;
      if (typeof rawText !== 'string') {
        continue;
      }
      const { suggestions: extracted } = extractSuggestions(rawText);
      if (extracted.length > 0) {
        return extracted;
      }
    }
    return [];
  }, [isLast, isSubmitting, message?.isCreatedByUser, message?.content, showSuggestions, adminSuggestionsEnabled]);

  const { submitMessage } = useSubmitMessage();
  const handleSuggestionClick = useCallback(
    (text: string) => {
      submitMessage({ text });
      dataService.logSuggestionClick({
        text,
        endpoint: conversation?.endpoint ?? '',
        conversationId: conversation?.conversationId ?? '',
      });
    },
    [submitMessage, conversation?.endpoint, conversation?.conversationId],
  );

  if (!message) {
    return null;
  }

  const getChatWidthClass = () => {
    if (maximizeChatSpace) {
      return 'w-full max-w-full md:px-5 lg:px-1 xl:px-5';
    }
    if (hasParallelContent) {
      return 'md:max-w-[58rem] xl:max-w-[70rem]';
    }
    return 'md:max-w-[47rem] xl:max-w-[55rem]';
  };

  const baseClasses = {
    common: 'group mx-auto flex flex-1 gap-3 transition-all duration-300 transform-gpu',
    chat: getChatWidthClass(),
  };

  return (
    <>
      <div
        className="w-full border-0 bg-transparent dark:border-0 dark:bg-transparent"
        onWheel={handleScroll}
        onTouchMove={handleScroll}
      >
        <div className="m-auto justify-center p-4 py-2 md:gap-6">
          <div
            id={messageId ?? ''}
            aria-label={getMessageAriaLabel(message, localize)}
            className={cn(baseClasses.common, baseClasses.chat, 'message-render')}
          >
            {!hasParallelContent && (
              <div className="relative flex flex-shrink-0 flex-col items-center">
                <AvatarLightbox
                  avatarUrl={getAgentAvatarUrl(agent)}
                  alt={agent?.name ? `${agent.name} avatar` : 'Agent avatar'}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center overflow-hidden rounded-full pt-0.5',
                      agent ? 'h-10 w-10' : 'h-6 w-6',
                    )}
                  >
                    <MessageIcon iconData={iconData} assistant={assistant} agent={agent} />
                  </div>
                </AvatarLightbox>
              </div>
            )}
            <div
              className={cn(
                'relative flex flex-col',
                hasParallelContent ? 'w-full' : 'w-11/12',
                isCreatedByUser ? 'user-turn' : 'agent-turn',
              )}
            >
              {!hasParallelContent && (
                <h2 className={cn('select-none font-semibold text-text-primary', fontSize)}>
                  {name}
                </h2>
              )}
              <div className="flex flex-col gap-1">
                <div className="flex max-w-full flex-grow flex-col gap-0">
                  <ContentParts
                    edit={edit}
                    isLast={isLast}
                    enterEdit={enterEdit}
                    siblingIdx={siblingIdx}
                    attachments={attachments}
                    isSubmitting={isSubmitting}
                    searchResults={searchResults}
                    messageId={message.messageId}
                    setSiblingIdx={setSiblingIdx}
                    isCreatedByUser={message.isCreatedByUser}
                    conversationId={conversation?.conversationId}
                    isLatestMessage={messageId === latestMessage?.messageId}
                    showResponseTimer={showResponseTimer}
                    content={message.content as Array<TMessageContentParts | undefined>}
                  />
                </div>
                {suggestions.length > 0 && (
                  <SuggestionChips
                    suggestions={suggestions}
                    onSuggestionClick={handleSuggestionClick}
                  />
                )}
                {isLast && isSubmitting ? (
                  <div className="mt-1 h-[27px] bg-transparent" />
                ) : (
                  <SubRow classes="text-xs">
                    <SiblingSwitch
                      siblingIdx={siblingIdx}
                      siblingCount={siblingCount}
                      setSiblingIdx={setSiblingIdx}
                    />
                    <HoverButtons
                      index={index}
                      isEditing={edit}
                      message={message}
                      enterEdit={enterEdit}
                      isSubmitting={isSubmitting}
                      conversation={conversation ?? null}
                      regenerate={() => regenerateMessage()}
                      copyToClipboard={copyToClipboard}
                      handleContinue={handleContinue}
                      latestMessage={latestMessage}
                      isLast={isLast}
                      agentVoice={agent?.voice ?? undefined}
                    />
                  </SubRow>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <MultiMessage
        key={messageId}
        messageId={messageId}
        conversation={conversation}
        messagesTree={children ?? []}
        currentEditId={currentEditId}
        setCurrentEditId={setCurrentEditId}
      />
    </>
  );
}
