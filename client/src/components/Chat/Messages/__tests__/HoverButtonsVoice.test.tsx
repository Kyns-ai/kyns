import React from 'react';
import { render, screen } from '@testing-library/react';
import HoverButtons from '../HoverButtons';
import type { TConversation, TMessage } from 'librechat-data-provider';

jest.mock('recoil', () => ({
  ...jest.requireActual('recoil'),
  useRecoilState: jest.fn((atom) => {
    const key = typeof atom === 'object' && atom !== null ? String((atom as { key?: string }).key ?? '') : '';
    if (key.includes('textToSpeech')) {
      return [true, jest.fn()];
    }
    if (key.includes('engineTTS')) {
      return ['external', jest.fn()];
    }
    return [undefined, jest.fn()];
  }),
  useRecoilValue: jest.fn((atom) => {
    const key = typeof atom === 'object' && atom !== null ? String((atom as { key?: string }).key ?? '') : '';
    if (key.includes('engineTTS')) return 'external';
    if (key.includes('textToSpeech')) return true;
    return undefined;
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: jest.fn(() => (key: string) => key),
  useGenerationsByLatest: jest.fn(() => ({
    hideEditButton: false,
    regenerateEnabled: false,
    continueSupported: false,
    forkingSupported: false,
    isEditableEndpoint: false,
  })),
}));

jest.mock('~/components/Conversations', () => ({
  Fork: jest.fn(() => null),
}));

jest.mock('../Feedback', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const capturedAudioProps: Record<string, unknown>[] = [];

jest.mock('../MessageAudio', () => ({
  __esModule: true,
  default: jest.fn((props: Record<string, unknown>) => {
    capturedAudioProps.push({ ...props });
    return <div data-testid="message-audio" data-agent-voice={props.agentVoice as string} />;
  }),
}));

const baseMessage: TMessage = {
  messageId: 'msg-1',
  conversationId: 'conv-1',
  text: 'Hello world',
  isCreatedByUser: false,
  parentMessageId: '',
  error: false,
  unfinished: false,
  finish_reason: '',
  model: 'agent_abc',
};

const baseConversation: Partial<TConversation> = {
  conversationId: 'conv-1',
  endpoint: 'agents',
};

const baseProps = {
  index: 0,
  isEditing: false,
  enterEdit: jest.fn(),
  copyToClipboard: jest.fn(),
  conversation: baseConversation as TConversation,
  isSubmitting: false,
  regenerate: jest.fn(),
  handleContinue: jest.fn(),
  latestMessageId: 'msg-1',
  isLast: true,
  handleFeedback: undefined,
};

beforeEach(() => {
  capturedAudioProps.length = 0;
});

describe('HoverButtons — agent voice', () => {
  it('renders MessageAudio with agentVoice when agent has a voice', () => {
    render(<HoverButtons {...baseProps} message={baseMessage} agentVoice="nova" />);

    const audio = screen.getByTestId('message-audio');
    expect(audio).toBeDefined();
    expect(audio.getAttribute('data-agent-voice')).toBe('nova');
  });

  it('renders MessageAudio with undefined agentVoice when agent has no voice', () => {
    render(<HoverButtons {...baseProps} message={baseMessage} agentVoice={undefined} />);

    const audio = screen.getByTestId('message-audio');
    expect(audio).toBeDefined();
    expect(audio.getAttribute('data-agent-voice')).toBeNull();
  });

  it('passes message.content array directly without extracting to string', () => {
    const messageWithContent: TMessage = {
      ...baseMessage,
      content: [
        { type: 'text', text: 'Visible response' },
      ] as TMessage['content'],
    };

    render(<HoverButtons {...baseProps} message={messageWithContent} agentVoice="alloy" />);

    expect(capturedAudioProps.length).toBeGreaterThan(0);
    const lastProps = capturedAudioProps[capturedAudioProps.length - 1];
    expect(Array.isArray(lastProps.content)).toBe(true);
  });

  it('falls back to message.text when content is undefined', () => {
    const messageTextOnly: TMessage = {
      ...baseMessage,
      content: undefined,
      text: 'Plain text fallback',
    };

    render(<HoverButtons {...baseProps} message={messageTextOnly} agentVoice={null} />);

    expect(capturedAudioProps.length).toBeGreaterThan(0);
    const lastProps = capturedAudioProps[capturedAudioProps.length - 1];
    expect(lastProps.content).toBe('Plain text fallback');
  });
});
