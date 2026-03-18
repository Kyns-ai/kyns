import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Button, Skeleton } from '@librechat/client';
import { apiBaseUrl } from 'librechat-data-provider';
import { ArrowDownToLine } from 'lucide-react';
import KynsImageGeneration from './KynsImageGeneration';
import DialogImage from './DialogImage';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

/** Max display height for chat images (Tailwind JIT class) */
export const IMAGE_MAX_H = 'max-h-[45vh]' as const;
/** Matches the `max-w-lg` Tailwind class on the wrapper button (32rem = 512px at 16px base) */
const IMAGE_MAX_W_PX = 512;

/** Caches image dimensions by src so remounts can reserve space */
const dimensionCache = new Map<string, { width: number; height: number }>();
/** Tracks URLs that have been fully painted — skip skeleton on remount */
const paintedUrls = new Set<string>();

/** Test-only: resets module-level caches */
export function _resetImageCaches(): void {
  dimensionCache.clear();
  paintedUrls.clear();
}

function computeHeightStyle(w: number, h: number): React.CSSProperties {
  return { height: `min(45vh, ${(h / w) * 100}vw, ${(h / w) * IMAGE_MAX_W_PX}px)` };
}

const Image = ({
  imagePath,
  altText,
  className,
  args,
  width,
  height,
}: {
  imagePath: string;
  altText: string;
  className?: string;
  args?: {
    prompt?: string;
    quality?: 'low' | 'medium' | 'high';
    size?: string;
    style?: string;
    [key: string]: unknown;
  };
  width?: number;
  height?: number;
}) => {
  const localize = useLocalize();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const absoluteImageUrl = useMemo(() => {
    if (!imagePath) return imagePath;

    if (
      imagePath.startsWith('http') ||
      imagePath.startsWith('data:') ||
      !imagePath.startsWith('/images/')
    ) {
      return imagePath;
    }

    const baseURL = apiBaseUrl();
    return `${baseURL}${imagePath}`;
  }, [imagePath]);

  const isGeneratedImage = useMemo(
    () => absoluteImageUrl.includes('/images/generated/'),
    [absoluteImageUrl],
  );

  const downloadImage = async () => {
    try {
      const response = await fetch(absoluteImageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = altText || 'image.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      const link = document.createElement('a');
      link.href = absoluteImageUrl;
      link.download = altText || 'image.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  useEffect(() => {
    if (width && height && absoluteImageUrl) {
      dimensionCache.set(absoluteImageUrl, { width, height });
    }
  }, [absoluteImageUrl, width, height]);

  useEffect(() => {
    const alreadyPainted = paintedUrls.has(absoluteImageUrl);
    let initialProgress = 0;
    if (alreadyPainted) {
      initialProgress = 100;
    } else if (isGeneratedImage) {
      initialProgress = 6;
    }
    setIsLoaded(alreadyPainted);
    setLoadProgress(initialProgress);

    if (alreadyPainted || !isGeneratedImage) {
      return;
    }

    let progress = 6;
    const timer = window.setInterval(() => {
      if (progress < 60) {
        progress += 7;
      } else if (progress < 82) {
        progress += 4;
      } else if (progress < 95) {
        progress += 1;
      }
      setLoadProgress(Math.min(progress, 95));
    }, 220);

    return () => window.clearInterval(timer);
  }, [absoluteImageUrl, isGeneratedImage]);

  const dims = width && height ? { width, height } : dimensionCache.get(absoluteImageUrl);
  const hasDimensions = !!(dims?.width && dims?.height);
  const heightStyle = hasDimensions ? computeHeightStyle(dims.width, dims.height) : undefined;
  const showGeneratedLoader = isGeneratedImage && !isLoaded;
  const showSkeleton = !showGeneratedLoader && hasDimensions && !isLoaded;

  const handleImageLoad = () => {
    paintedUrls.add(absoluteImageUrl);
    setLoadProgress(100);
    setIsLoaded(true);
  };

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`View ${altText} in dialog`}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
        className={cn(
          'relative mt-1 w-full max-w-lg cursor-pointer overflow-hidden rounded-lg border border-border-light text-text-secondary-alt shadow-md transition-shadow',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary',
          showGeneratedLoader && 'aspect-square',
          className,
        )}
        style={heightStyle}
      >
        {showGeneratedLoader && (
          <KynsImageGeneration
            progress={loadProgress}
            className="absolute inset-0 rounded-[inherit] border-0 shadow-none"
          />
        )}
        {showSkeleton && <Skeleton className="absolute inset-0" aria-hidden="true" />}
        <img
          alt={altText}
          src={absoluteImageUrl}
          onLoad={handleImageLoad}
          onError={() => setIsLoaded(true)}
          className={cn(
            'relative block text-transparent transition-all duration-700 ease-out',
            showGeneratedLoader ? 'scale-[1.01] opacity-0 blur-md' : 'scale-100 opacity-100 blur-0',
            hasDimensions
              ? 'size-full object-contain'
              : cn('h-auto w-auto max-w-full', IMAGE_MAX_H),
          )}
        />
      </button>
      {isGeneratedImage && isLoaded && (
        <div className="mt-2 flex">
          <Button
            type="button"
            onClick={() => void downloadImage()}
            variant="outline"
            className="h-8 rounded-full px-3 text-xs"
            aria-label={localize('com_ui_download')}
          >
            <ArrowDownToLine className="mr-2 size-4" aria-hidden="true" />
            {localize('com_ui_download')}
          </Button>
        </div>
      )}
      <DialogImage
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        src={absoluteImageUrl}
        downloadImage={downloadImage}
        args={args}
        triggerRef={triggerRef}
      />
    </div>
  );
};

export default Image;
