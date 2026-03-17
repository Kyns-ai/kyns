// client/src/hooks/Audio/useTTSExternal.ts
import { useRef, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import {
  extractDialogueForTTS,
  extractThinkingContent,
  parseTextParts,
} from 'librechat-data-provider';
import type { TMessageContentParts } from 'librechat-data-provider';
import useTextToSpeechExternal from '~/hooks/Input/useTextToSpeechExternal';
import usePauseGlobalAudio from '~/hooks/Audio/usePauseGlobalAudio';
import useAudioRef from '~/hooks/Audio/useAudioRef';
import { logger } from '~/utils';
import store from '~/store';

type TUseTextToSpeech = {
  messageId?: string;
  content?: TMessageContentParts[] | string;
  isLast?: boolean;
  index?: number;
  /** Voice ID from the agent, overrides the global voice setting */
  agentVoice?: string | null;
};

const useTTSExternal = (props?: TUseTextToSpeech) => {
  const { messageId, content, isLast = false, index = 0, agentVoice } = props ?? {};

  const isMouseDownRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const [isSpeakingState, setIsSpeaking] = useState(false);
  const { audioRef } = useAudioRef({ setIsPlaying: setIsSpeaking });

  const { pauseGlobalAudio } = usePauseGlobalAudio(index);
  const [voice, setVoice] = useRecoilState(store.voice);
  const globalIsPlaying = useRecoilValue(store.globalAudioPlayingFamily(index));

  const isSpeaking = isSpeakingState || (isLast && globalIsPlaying);
  const {
    cancelSpeech,
    generateSpeechExternal: generateSpeech,
    isLoading,
    voices,
  } = useTextToSpeechExternal({
    setIsSpeaking,
    audioRef,
    messageId,
    isLast,
    index,
    agentVoice,
  });

  useEffect(() => {
    const firstVoice = voices[0];
    if (voices.length) {
      const lastSelectedVoice = voices.find((v) => v === voice);
      if (lastSelectedVoice != null) {
        logger.log('useTextToSpeech.ts - Effect:', { voices, voice: lastSelectedVoice });
        setVoice(lastSelectedVoice.toString());
        return;
      }
      logger.log('useTextToSpeech.ts - Effect:', { voices, voice: firstVoice });
      setVoice(firstVoice.toString());
    }
  }, [setVoice, voice, voices]);

  const prepareTextForTTS = (messageContent: TMessageContentParts[] | string) => {
    const raw =
      typeof messageContent === 'string'
        ? extractThinkingContent(messageContent).regularContent
        : parseTextParts(messageContent, true);
    return extractDialogueForTTS(raw);
  };

  const handleMouseDown = () => {
    isMouseDownRef.current = true;
    timerRef.current = window.setTimeout(() => {
      if (isMouseDownRef.current) {
        generateSpeech(prepareTextForTTS(content ?? ''), false);
      }
    }, 1000);
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
    }
  };

  const toggleSpeech = () => {
    if (isSpeaking === true) {
      cancelSpeech();
      pauseGlobalAudio();
    } else {
      generateSpeech(prepareTextForTTS(content ?? ''), false);
    }
  };

  return {
    handleMouseDown,
    handleMouseUp,
    toggleSpeech,
    isSpeaking,
    isLoading,
    audioRef,
    voices,
  };
};

export default useTTSExternal;
