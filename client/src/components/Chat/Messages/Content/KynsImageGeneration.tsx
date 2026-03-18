import { memo, useEffect, useMemo, useState } from 'react';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

const KYNS_IMAGE_MODEL_TOKENS = ['flux2klein', 'zimage', 'kyns-image', 'lustify'];

type KynsImageMessageParams = {
  endpoint?: string | null;
  model?: string | null;
};

type KynsImageGenerationProps = {
  progress?: number;
  className?: string;
};

export function isKynsImageGeneration({ endpoint, model }: KynsImageMessageParams): boolean {
  const normalizedEndpoint = endpoint?.trim().toLowerCase() ?? '';
  if (normalizedEndpoint === 'kynsimage' || normalizedEndpoint === 'kyns-image') {
    return true;
  }

  const normalizedModel = model?.trim().toLowerCase() ?? '';
  if (normalizedModel.length === 0) {
    return false;
  }

  return KYNS_IMAGE_MODEL_TOKENS.some((token) => normalizedModel.includes(token));
}

const KynsImageGeneration = memo(function KynsImageGeneration({
  progress,
  className,
}: KynsImageGenerationProps) {
  const localize = useLocalize();
  const [estimatedProgress, setEstimatedProgress] = useState(4);
  const brandLabel = 'kyns.ai';

  useEffect(() => {
    if (typeof progress === 'number') {
      return;
    }

    setEstimatedProgress(4);

    const timer = window.setInterval(() => {
      setEstimatedProgress((current) => {
        if (current >= 94) {
          return current;
        }
        if (current < 28) {
          return current + 5;
        }
        if (current < 68) {
          return current + 3;
        }
        if (current < 86) {
          return current + 2;
        }
        return current + 1;
      });
    }, 320);

    return () => window.clearInterval(timer);
  }, [progress]);

  const resolvedProgress = useMemo(() => {
    const nextValue = typeof progress === 'number' ? progress : estimatedProgress;
    return Math.max(0, Math.min(100, Math.round(nextValue)));
  }, [estimatedProgress, progress]);

  const statusText = useMemo(() => {
    if (resolvedProgress >= 86) {
      return localize('com_ui_final_touch');
    }
    if (resolvedProgress >= 24) {
      return localize('com_ui_creating_image');
    }
    return localize('com_ui_getting_started');
  }, [localize, resolvedProgress]);

  return (
    <div
      className={cn(
        'border-border-light/80 relative isolate flex h-full w-full overflow-hidden rounded-2xl border shadow-lg',
        className,
      )}
      style={{
        background: [
          'radial-gradient(circle at top left, rgba(184, 148, 62, 0.24), transparent 38%)',
          'radial-gradient(circle at bottom right, rgba(171, 104, 255, 0.18), transparent 34%)',
          'linear-gradient(135deg, var(--surface-secondary) 0%, var(--surface-primary) 56%, var(--surface-tertiary) 100%)',
        ].join(', '),
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(140deg, rgba(255, 255, 255, 0.08), transparent 45%, rgba(255, 255, 255, 0.04))',
        }}
      />
      <div className="absolute inset-x-6 top-6 h-px bg-white/15 dark:bg-white/10" />
      <div
        className="absolute bottom-0 right-0 h-40 w-40 rounded-full blur-3xl"
        style={{ background: 'rgba(184, 148, 62, 0.14)' }}
      />
      <div className="relative flex h-full w-full flex-col justify-between p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="bg-surface-primary/70 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-text-primary backdrop-blur-sm">
            {brandLabel}
          </div>
          <div className="bg-surface-primary/60 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-text-secondary backdrop-blur-sm">
            {resolvedProgress}%
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-2 text-center">
          <div className="bg-surface-primary/70 relative flex size-24 items-center justify-center rounded-[28px] border border-white/15 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.75)] backdrop-blur-sm">
            <div className="absolute inset-3 rounded-[20px] border border-white/10" />
            <div
              className="absolute inset-0 rounded-[28px] opacity-70"
              style={{
                background:
                  'linear-gradient(135deg, rgba(184, 148, 62, 0.2) 0%, rgba(171, 104, 255, 0.12) 100%)',
              }}
            />
            <span className="relative text-3xl font-semibold tracking-tight text-text-primary">
              {resolvedProgress}
              <span className="ml-0.5 text-base text-text-secondary">%</span>
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-base font-semibold text-text-primary sm:text-lg">{statusText}</p>
            <p className="text-sm text-text-secondary">{localize('com_ui_creating_image')}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-2.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out"
              style={{
                width: `${resolvedProgress}%`,
                background:
                  'linear-gradient(90deg, var(--surface-submit) 0%, var(--brand-purple) 100%)',
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-text-secondary">
            <span>{statusText}</span>
            <span>{localize('com_ui_loading')}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default KynsImageGeneration;
