import { memo, useMemo, useEffect, useRef, useState, type ReactElement } from 'react';
import { useRecoilValue } from 'recoil';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import Markdown from '~/components/Chat/Messages/Content/Markdown';
import { useMessageContext } from '~/Providers';
import { cn } from '~/utils';
import store from '~/store';

const MIN_CHARS_PER_FRAME = 3;
const TARGET_STREAM_FRAMES = 90;

type TextPartProps = {
  text: string;
  showCursor: boolean;
  isCreatedByUser: boolean;
};

type ContentType =
  | ReactElement<React.ComponentProps<typeof Markdown>>
  | ReactElement<React.ComponentProps<typeof MarkdownLite>>
  | ReactElement;

const TextPart = memo(function TextPart({ text, isCreatedByUser, showCursor }: TextPartProps) {
  const { isSubmitting = false, isLatestMessage = false } = useMessageContext();
  const enableUserMsgMarkdown = useRecoilValue(store.enableUserMsgMarkdown);
  const showCursorState = useMemo(() => showCursor && isSubmitting, [showCursor, isSubmitting]);
  const [displayedLength, setDisplayedLength] = useState(() => text.length);
  const rafRef = useRef<number | null>(null);
  const targetLenRef = useRef(text.length);

  useEffect(() => {
    if (!isSubmitting || !isLatestMessage || isCreatedByUser) {
      setDisplayedLength(text.length);
      targetLenRef.current = text.length;
      return;
    }
    targetLenRef.current = text.length;
    if (text.length <= displayedLength) {
      return;
    }

    const tick = () => {
      setDisplayedLength((current) => {
        const target = targetLenRef.current;
        const charsPerFrame = Math.max(
          MIN_CHARS_PER_FRAME,
          Math.ceil(target / TARGET_STREAM_FRAMES),
        );
        const next = Math.min(current + charsPerFrame, target);
        if (next < target) {
          rafRef.current = requestAnimationFrame(tick);
        }
        return next;
      });
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, isSubmitting, isLatestMessage, isCreatedByUser]);

  useEffect(() => {
    if (!isSubmitting && text.length > 0) {
      setDisplayedLength(text.length);
      targetLenRef.current = text.length;
    }
  }, [isSubmitting, text.length]);

  const visibleText = useMemo(() => {
    if (!isSubmitting || !isLatestMessage || isCreatedByUser || displayedLength >= text.length) {
      return text;
    }
    return text.slice(0, displayedLength);
  }, [text, displayedLength, isSubmitting, isLatestMessage, isCreatedByUser]);

  const content: ContentType = useMemo(() => {
    if (!isCreatedByUser) {
      return <Markdown content={visibleText} isLatestMessage={isLatestMessage} />;
    } else if (enableUserMsgMarkdown) {
      return <MarkdownLite content={visibleText} />;
    } else {
      return <>{visibleText}</>;
    }
  }, [isCreatedByUser, enableUserMsgMarkdown, visibleText, isLatestMessage]);

  return (
    <div
      className={cn(
        isSubmitting ? 'submitting' : '',
        showCursorState && !!text.length ? 'result-streaming' : '',
        'markdown prose message-content dark:prose-invert light w-full break-words',
        isCreatedByUser && !enableUserMsgMarkdown && 'whitespace-pre-wrap',
        isCreatedByUser ? 'dark:text-gray-20' : 'dark:text-gray-100',
      )}
    >
      {content}
    </div>
  );
});
TextPart.displayName = 'TextPart';

export default TextPart;
