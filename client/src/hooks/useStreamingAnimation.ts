import { useState, useEffect, useRef } from 'react';

/**
 * At ≤180 chars pending → 2 chars/frame (~120 chars/s), smooth typewriter feel.
 * When lagging (large batches or resume) → scales up to clear backlog in ~90 frames.
 */
const MIN_CHARS_PER_FRAME = 2;
const CATCHUP_FRAMES = 90;

type UseStreamingAnimationOptions = {
  text: string;
  isStreaming: boolean;
};

export function useStreamingAnimation({ text, isStreaming }: UseStreamingAnimationOptions): string {
  const [displayedLength, setDisplayedLength] = useState(() => text.length);
  const rafRef = useRef<number | null>(null);
  const targetLenRef = useRef(text.length);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedLength(text.length);
      targetLenRef.current = text.length;
      return;
    }

    targetLenRef.current = text.length;
    if (text.length <= displayedLength) return;

    const tick = () => {
      setDisplayedLength((current) => {
        const target = targetLenRef.current;
        const pending = target - current;
        const charsPerFrame = Math.max(MIN_CHARS_PER_FRAME, Math.ceil(pending / CATCHUP_FRAMES));
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
  }, [text, isStreaming]);

  useEffect(() => {
    if (!isStreaming && text.length > 0) {
      setDisplayedLength(text.length);
      targetLenRef.current = text.length;
    }
  }, [isStreaming, text.length]);

  return !isStreaming || displayedLength >= text.length ? text : text.slice(0, displayedLength);
}
