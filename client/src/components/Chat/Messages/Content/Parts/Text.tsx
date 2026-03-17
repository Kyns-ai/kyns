import { memo, useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import type { ReactElement } from 'react';
import { extractSuggestions, extractThinkingContent } from 'librechat-data-provider';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import { useStreamingAnimation } from '~/hooks/useStreamingAnimation';
import Markdown from '~/components/Chat/Messages/Content/Markdown';
import Thinking from '~/components/Chat/Messages/Content/Parts/Thinking';
import { useMessageContext } from '~/Providers';
import { cn } from '~/utils';
import store from '~/store';

type TextPartProps = {
  text: string;
  showCursor: boolean;
  isCreatedByUser: boolean;
};

type ContentType =
  | ReactElement<React.ComponentProps<typeof Markdown>>
  | ReactElement<React.ComponentProps<typeof MarkdownLite>>
  | ReactElement;

const normalizeThinkingText = (value: string) => value.replace(/\r\n/g, '\n').trim();

const stripDuplicatedResponseFromThinking = (thinking: string, response: string) => {
  const normalizedThinking = normalizeThinkingText(thinking);
  const normalizedResponse = normalizeThinkingText(response);

  if (!normalizedThinking || !normalizedResponse) {
    return normalizedThinking;
  }

  if (normalizedThinking === normalizedResponse) {
    return '';
  }

  if (normalizedThinking.endsWith(normalizedResponse)) {
    return normalizeThinkingText(
      normalizedThinking.slice(0, normalizedThinking.length - normalizedResponse.length),
    );
  }

  return normalizedThinking;
};

const TextPart = memo(function TextPart({ text, isCreatedByUser, showCursor }: TextPartProps) {
  const { isSubmitting = false, isLatestMessage = false, isCharacterMessage = false } = useMessageContext();
  const enableUserMsgMarkdown = useRecoilValue(store.enableUserMsgMarkdown);
  const showCursorState = useMemo(() => showCursor && isSubmitting, [showCursor, isSubmitting]);

  const isStreaming = isSubmitting && isLatestMessage && !isCreatedByUser;
  const visibleText = useStreamingAnimation({ text, isStreaming });

  const cleanVisibleText = useMemo(
    () => (!isCreatedByUser ? extractSuggestions(visibleText).cleanText : visibleText),
    [visibleText, isCreatedByUser],
  );

  const { thinkingSegments, regularContent, hasThinking } = useMemo(() => {
    if (isCreatedByUser) {
      return { thinkingSegments: [] as Array<{ type: string; content: string }>, regularContent: '', hasThinking: false };
    }
    const extracted = extractThinkingContent(cleanVisibleText);
    const thinkSegs = extracted.segments
      .filter((s) => s.type === 'think')
      .map((segment, index, allSegments) => {
        const isLastThinkingSegment =
          index === allSegments.length - 1 ||
          allSegments.slice(index + 1).every((nextSegment) => nextSegment.type !== 'think');

        if (!isLastThinkingSegment) {
          return segment;
        }

        return {
          ...segment,
          content: stripDuplicatedResponseFromThinking(segment.content, extracted.regularContent),
        };
      })
      .filter((segment) => segment.content.length > 0);
    return {
      thinkingSegments: thinkSegs,
      regularContent: extracted.regularContent,
      hasThinking: thinkSegs.length > 0,
    };
  }, [cleanVisibleText, isCreatedByUser]);

  const content: ContentType | null = useMemo(() => {
    if (isCreatedByUser) {
      if (enableUserMsgMarkdown) {
        return <MarkdownLite content={visibleText} />;
      }
      return <>{visibleText}</>;
    }
    if (hasThinking) {
      return null;
    }
    return (
      <Markdown content={cleanVisibleText} isLatestMessage={isLatestMessage} isRoleplay={isCharacterMessage} />
    );
  }, [
    isCreatedByUser,
    enableUserMsgMarkdown,
    visibleText,
    cleanVisibleText,
    isLatestMessage,
    isCharacterMessage,
    hasThinking,
  ]);

  const thinkingBlocks = useMemo(() => {
    if (!hasThinking) {
      return null;
    }
    return (
      <>
        {thinkingSegments.map((segment, index) => (
          <Thinking key={`thinking-${index}`}>{segment.content}</Thinking>
        ))}
      </>
    );
  }, [hasThinking, thinkingSegments]);

  const regularMarkdown = useMemo(() => {
    if (!hasThinking) {
      return null;
    }
    if (regularContent.length === 0 && !isStreaming) {
      return null;
    }
    return (
      <Markdown content={regularContent} isLatestMessage={isLatestMessage} isRoleplay={isCharacterMessage} />
    );
  }, [hasThinking, regularContent, isLatestMessage, isCharacterMessage, isStreaming]);

  return (
    <div
      className={cn(
        isSubmitting ? 'submitting' : '',
        showCursorState && !!text.length ? 'result-streaming' : '',
        'markdown prose message-content dark:prose-invert light w-full break-words',
        isCreatedByUser && !enableUserMsgMarkdown && 'whitespace-pre-wrap',
        isCreatedByUser ? 'dark:text-gray-20' : 'dark:text-gray-100',
        isCharacterMessage && !isCreatedByUser && 'rp-message',
      )}
    >
      {thinkingBlocks}
      {content}
      {regularMarkdown}
    </div>
  );
});
TextPart.displayName = 'TextPart';

export default TextPart;
