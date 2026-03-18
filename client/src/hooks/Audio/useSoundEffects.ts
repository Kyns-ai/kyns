import { useCallback, useRef } from 'react';

function getAudioContext(): AudioContext | null {
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
  startTime = 0,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, ctx.currentTime + startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + startTime);
  osc.stop(ctx.currentTime + startTime + duration);
}

export default function useSoundEffects() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = getAudioContext();
    }
    return ctxRef.current;
  }, []);

  const playRing = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    playTone(ctx, 440, 0.15, 'sine', 0.12, 0);
    playTone(ctx, 580, 0.15, 'sine', 0.12, 0.18);
    playTone(ctx, 440, 0.15, 'sine', 0.12, 0.5);
    playTone(ctx, 580, 0.15, 'sine', 0.12, 0.68);
  }, [getCtx]);

  const playClick = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    playTone(ctx, 1200, 0.06, 'square', 0.08);
  }, [getCtx]);

  const playHangup = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    playTone(ctx, 480, 0.2, 'sine', 0.12, 0);
    playTone(ctx, 360, 0.3, 'sine', 0.12, 0.2);
  }, [getCtx]);

  return { playRing, playClick, playHangup };
}
