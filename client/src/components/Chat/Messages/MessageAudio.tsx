import { memo } from 'react';
import { useRecoilValue } from 'recoil';
import type { TMessageAudio } from '~/common';
import { BrowserTTS, ExternalTTS } from '~/components/Audio/TTS';
import { TTSEndpoints } from '~/common';
import store from '~/store';

function MessageAudio(props: TMessageAudio) {
  const engineTTS = useRecoilValue<string>(store.engineTTS);

  const TTSComponents = {
    [TTSEndpoints.browser]: BrowserTTS,
    [TTSEndpoints.external]: ExternalTTS,
  };

  const SelectedTTS = TTSComponents[engineTTS];
  if (!SelectedTTS) {
    return null;
  }

  // BrowserTTS doesn't support agentVoice, omit it to avoid prop warnings
  if (engineTTS === TTSEndpoints.browser) {
    const { agentVoice: _agentVoice, ...browserProps } = props;
    return <SelectedTTS {...browserProps} />;
  }

  return <SelectedTTS {...props} />;
}

export default memo(MessageAudio);
