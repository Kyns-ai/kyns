import { useMemo, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { XIcon } from 'lucide-react';
import { useRecoilState } from 'recoil';
import { Button, cn } from '@librechat/client';
import { useGetBannerQuery } from '~/data-provider';
import store from '~/store';

const sanitize = DOMPurify();

export const Banner = ({ onHeightChange }: { onHeightChange?: (height: number) => void }) => {
  const { data: banner } = useGetBannerQuery();
  const [hideBannerHint, setHideBannerHint] = useRecoilState<string[]>(store.hideBannerHint);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onHeightChange && bannerRef.current) {
      onHeightChange(bannerRef.current.offsetHeight);
    }
  }, [banner, hideBannerHint, onHeightChange]);

  if (
    !banner ||
    (banner.bannerId && !banner.persistable && hideBannerHint.includes(banner.bannerId))
  ) {
    return null;
  }

  const onClick = () => {
    if (banner.persistable) {
      return;
    }

    setHideBannerHint([...hideBannerHint, banner.bannerId]);

    if (onHeightChange) {
      onHeightChange(0);
    }
  };

  return (
    <div
      ref={bannerRef}
      className="sticky top-0 z-20 flex items-center bg-presentation px-2 py-1 text-text-primary dark:bg-gradient-to-r md:relative"
    >
      <div
        className={cn(
          'text-md w-full truncate text-center [&_a]:text-blue-700 [&_a]:underline dark:[&_a]:text-blue-400',
          !banner.persistable && 'px-4',
        )}
        dangerouslySetInnerHTML={{
          __html: sanitize.sanitize(banner.message, {
            ALLOWED_TAGS: ['a', 'strong', 'b', 'em', 'i', 'br', 'code', 'span'],
            ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
            ALLOW_DATA_ATTR: false,
          }),
        }}
      ></div>
      {!banner.persistable && (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Dismiss banner"
          className="size-8"
          onClick={onClick}
        >
          <XIcon className="mx-auto h-4 w-4 text-text-primary" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
};
