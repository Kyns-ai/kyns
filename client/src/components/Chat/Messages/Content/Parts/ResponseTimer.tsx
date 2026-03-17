import { memo, useEffect, useState } from 'react';
import { useLocalize } from '~/hooks';

/**
 * Shows "Responding… Xs" while waiting for the first token in normal chat (not agents).
 * Gives the user a clear indication that the model is working.
 */
const ResponseTimer = memo(function ResponseTimer() {
  const localize = useLocalize();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p
      className="text-sm text-text-secondary"
      role="status"
      aria-live="polite"
      aria-label={localize('com_ui_responding_seconds', { seconds: String(seconds) })}
    >
      {localize('com_ui_responding_seconds', { seconds: String(seconds) })}
    </p>
  );
});

export default ResponseTimer;
