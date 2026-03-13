import { memo } from 'react';
import { Lightbulb } from 'lucide-react';
import { useLocalize } from '~/hooks';
import ResponseTimer from './ResponseTimer';

const KynsDeepThinkingLoader = memo(function KynsDeepThinkingLoader() {
  const localize = useLocalize();

  return (
    <div
      data-testid="kyns-deep-thinking-loader"
      className="not-prose w-full max-w-xl rounded-3xl border border-border-medium bg-surface-tertiary/80 px-4 py-4 shadow-sm backdrop-blur-sm"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-surface-secondary text-text-secondary">
          <Lightbulb className="size-4 animate-pulse" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">
              {localize('com_ui_analyzing')}
            </span>
            <div className="flex items-center gap-1" aria-hidden="true">
              <span className="size-1.5 rounded-full bg-current opacity-60 animate-pulse" />
              <span className="size-1.5 rounded-full bg-current opacity-60 animate-pulse [animation-delay:180ms]" />
              <span className="size-1.5 rounded-full bg-current opacity-60 animate-pulse [animation-delay:360ms]" />
            </div>
          </div>
          <p className="mt-1 text-sm text-text-secondary">{localize('com_ui_thinking')}</p>
          <div className="mt-3">
            <ResponseTimer />
          </div>
        </div>
      </div>
    </div>
  );
});

export default KynsDeepThinkingLoader;
