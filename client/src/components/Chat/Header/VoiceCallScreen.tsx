import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { PhoneOff, Mic, MicOff } from 'lucide-react';
import { useChatContext } from '~/Providers';
import useSpeechToText from '~/hooks/Input/useSpeechToText';
import useSoundEffects from '~/hooks/Audio/useSoundEffects';
import store from '~/store';

interface VoiceCallScreenProps {
  agentName: string;
  agentAvatar?: React.ReactNode;
  onEnd: () => void;
}

type CallState = 'connecting' | 'idle' | 'listening' | 'processing' | 'speaking';

const WAVEFORM_BARS = 40;

const VoiceCallScreen: React.FC<VoiceCallScreenProps> = ({ agentName, agentAvatar, onEnd }) => {
  const { ask } = useChatContext();
  const { playRing, playClick, playHangup } = useSoundEffects();

  const [callState, setCallState] = useState<CallState>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const [waveHeights, setWaveHeights] = useState<number[]>(() => Array(WAVEFORM_BARS).fill(3));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const isSubmitting = useRecoilValue(store.isSubmitting);
  const [, setAutoTranscribe] = useRecoilState(store.autoTranscribeAudio);
  const [, setAutoSend] = useRecoilState(store.autoSendText);
  const [, setAutoPlayback] = useRecoilState(store.automaticPlayback);

  const prevSettingsRef = useRef({
    t: false,
    s: -1,
    p: false,
  });

  const onTranscriptionComplete = useCallback(
    (text: string) => {
      if (!mountedRef.current || !text.trim()) return;
      setSubtitle(text.length > 60 ? text.substring(0, 60) + '...' : text);
      setCallState('processing');
      ask({ text });
    },
    [ask],
  );

  const setText = useCallback((_text: string) => {
    // no-op: we don't need to update a text input in call mode
  }, []);

  const { isListening, isLoading, startRecording, stopRecording } = useSpeechToText(
    setText,
    onTranscriptionComplete,
  );

  // Save prev settings on mount, restore on unmount
  useEffect(() => {
    prevSettingsRef.current = {
      t: false, // default values (we read fresh on unmount)
      s: -1,
      p: false,
    };
    setAutoTranscribe(true);
    setAutoSend(0);
    setAutoPlayback(true);

    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

    const ringTimer = setTimeout(() => {
      if (mountedRef.current) {
        playRing();
        setCallState('idle');
      }
    }, 800);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveRef.current) clearInterval(waveRef.current);
      clearTimeout(ringTimer);
      setAutoTranscribe(prevSettingsRef.current.t);
      setAutoSend(prevSettingsRef.current.s);
      setAutoPlayback(prevSettingsRef.current.p);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync callState with actual recording state
  useEffect(() => {
    if (isListening) {
      setCallState('listening');
    } else if (isLoading) {
      setCallState('processing');
    }
  }, [isListening, isLoading]);

  // Detect when AI finishes responding (isSubmitting goes false after being true)
  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (isSubmitting) {
      wasSubmitting.current = true;
      setCallState('speaking');
    } else if (wasSubmitting.current) {
      wasSubmitting.current = false;
      if (mountedRef.current) {
        setCallState('idle');
      }
    }
  }, [isSubmitting]);

  // Waveform animation
  useEffect(() => {
    if (callState === 'listening' || callState === 'speaking') {
      waveRef.current = setInterval(() => {
        setWaveHeights(
          Array.from({ length: WAVEFORM_BARS }, () =>
            callState === 'listening' ? 3 + Math.random() * 14 : 4 + Math.random() * 24,
          ),
        );
      }, 120);
    } else if (callState === 'processing') {
      waveRef.current = setInterval(() => {
        setWaveHeights((prev) =>
          prev.map((h, i) => 3 + Math.sin(Date.now() / 300 + i * 0.5) * 6),
        );
      }, 80);
    } else {
      if (waveRef.current) clearInterval(waveRef.current);
      setWaveHeights(Array(WAVEFORM_BARS).fill(3));
    }
    return () => {
      if (waveRef.current) clearInterval(waveRef.current);
    };
  }, [callState]);

  const handleMicToggle = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      playClick();
      return;
    }
    if (isListening) {
      stopRecording();
      playClick();
    } else {
      startRecording();
      playClick();
    }
  }, [isListening, isMuted, startRecording, stopRecording, playClick]);

  const handleMuteToggle = useCallback(() => {
    playClick();
    setIsMuted((m) => !m);
    if (!isMuted && isListening) {
      stopRecording();
    }
  }, [playClick, isMuted, isListening, stopRecording]);

  const handleEnd = useCallback(() => {
    playHangup();
    if (isListening) stopRecording();
    setTimeout(() => onEnd(), 400);
  }, [playHangup, isListening, stopRecording, onEnd]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const stateLabel: Record<CallState, string> = {
    connecting: 'Conectando...',
    idle: 'Toque o microfone para falar',
    listening: 'Ouvindo...',
    processing: 'Pensando...',
    speaking: `${agentName} falando...`,
  };

  const waveColor: Record<CallState, string> = {
    connecting: 'bg-gray-600',
    idle: 'bg-gray-600',
    listening: 'bg-emerald-500',
    processing: 'bg-amber-500/60',
    speaking: 'bg-violet-500',
  };

  const screen = (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        zIndex: 99999,
        background: 'linear-gradient(180deg, #075E54 0%, #054d44 40%, #02332e 100%)',
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pb-2 pt-14">
        <span className="text-xs text-white/60">KYNS Voice</span>
        <span className="text-xs font-medium tabular-nums text-white/80">{fmt(duration)}</span>
      </div>

      {/* Center */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-white/20 bg-white/10 shadow-2xl">
          {agentAvatar ?? (
            <span className="text-5xl font-bold text-white/80">
              {agentName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <h2 className="text-2xl font-semibold text-white">{agentName}</h2>
          <p className="text-sm text-emerald-200/80">{stateLabel[callState]}</p>
        </div>

        {/* Waveform */}
        <div className="flex h-12 w-full max-w-xs items-center justify-center gap-[2px]">
          {waveHeights.map((h, i) => (
            <div
              key={i}
              className={`w-[3px] rounded-full transition-all duration-100 ${waveColor[callState]}`}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>

        {/* Subtitle (last transcription) */}
        {subtitle && (
          <p className="max-w-xs text-center text-xs text-white/40 italic">
            &ldquo;{subtitle}&rdquo;
          </p>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="flex items-center justify-center gap-10 pb-16 pt-6">
        {/* Mute */}
        <button
          type="button"
          onClick={handleMuteToggle}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-all ${
            isMuted ? 'bg-red-500/30 text-red-300' : 'bg-white/15 text-white hover:bg-white/25'
          }`}
          aria-label={isMuted ? 'Ativar microfone' : 'Silenciar'}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>

        {/* Hang up */}
        <button
          type="button"
          onClick={handleEnd}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-xl transition-all hover:scale-105 hover:bg-red-500 active:scale-95"
          aria-label="Encerrar chamada"
        >
          <PhoneOff className="h-7 w-7" />
        </button>

        {/* Mic toggle (main action) */}
        <button
          type="button"
          onClick={handleMicToggle}
          disabled={isMuted || callState === 'connecting'}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-all ${
            isListening
              ? 'animate-pulse bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
              : callState === 'processing' || callState === 'speaking'
                ? 'bg-white/10 text-white/40'
                : 'bg-white/15 text-white hover:bg-white/25'
          }`}
          aria-label={isListening ? 'Parar de gravar' : 'Gravar'}
        >
          <Mic className="h-6 w-6" />
        </button>
      </div>
    </div>
  );

  return createPortal(screen, document.body);
};

export default VoiceCallScreen;
