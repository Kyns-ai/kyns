import React from 'react';
import { render, screen } from '@testing-library/react';
import TextPart from '../Parts/Text';

jest.mock('recoil', () => {
  const actual = jest.requireActual('recoil');
  return {
    ...actual,
    useRecoilValue: jest.fn(() => false),
  };
});

jest.mock('~/Providers', () => ({
  useMessageContext: jest.fn(() => ({
    isSubmitting: false,
    isLatestMessage: false,
    isCharacterMessage: false,
  })),
}));

jest.mock('~/hooks/useStreamingAnimation', () => ({
  useStreamingAnimation: jest.fn(({ text }: { text: string }) => text),
}));

jest.mock('~/components/Chat/Messages/Content/Markdown', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}));

jest.mock('~/components/Chat/Messages/Content/MarkdownLite', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <div data-testid="markdown-lite">{content}</div>,
}));

jest.mock('~/components/Chat/Messages/Content/Parts/Thinking', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="thinking-block">{children}</div>
  ),
}));

describe('TextPart thinking extraction', () => {
  it('renders embedded thinking in a separate thinking block', () => {
    render(
      <TextPart
        text={'<think>passo privado</think>Resposta final'}
        isCreatedByUser={false}
        showCursor={false}
      />,
    );

    expect(screen.getByTestId('thinking-block')).toHaveTextContent('passo privado');
    expect(screen.getByTestId('markdown')).toHaveTextContent('Resposta final');
    expect(screen.queryByText('<think>')).not.toBeInTheDocument();
  });

  it('does not duplicate the final response inside and outside the thinking block', () => {
    render(
      <TextPart
        text={'<think>passo privado\n\nResposta final</think>Resposta final'}
        isCreatedByUser={false}
        showCursor={false}
      />,
    );

    expect(screen.getByTestId('thinking-block')).toHaveTextContent('passo privado');
    expect(screen.getByTestId('thinking-block')).not.toHaveTextContent('Resposta final');
    expect(screen.getByTestId('markdown')).toHaveTextContent('Resposta final');
  });
});

describe('TextPart suggestions stripping', () => {
  it('strips [suggestions] block from assistant message before rendering', () => {
    render(
      <TextPart
        text={'Resposta útil.\n[suggestions]\nOpção A\nOpção B\n[/suggestions]'}
        isCreatedByUser={false}
        showCursor={false}
      />,
    );

    expect(screen.getByTestId('markdown')).toHaveTextContent('Resposta útil.');
    expect(screen.queryByText(/\[suggestions\]/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\[\/suggestions\]/)).not.toBeInTheDocument();
    expect(screen.queryByText('Opção A')).not.toBeInTheDocument();
  });

  it('preserves [suggestions] tags in user messages unchanged', () => {
    render(
      <TextPart
        text={'[suggestions]\nOpção A\n[/suggestions]'}
        isCreatedByUser={true}
        showCursor={false}
      />,
    );

    expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();
  });

  it('renders cleanly when message has no suggestions block', () => {
    render(
      <TextPart
        text={'Apenas uma resposta direta.'}
        isCreatedByUser={false}
        showCursor={false}
      />,
    );

    expect(screen.getByTestId('markdown')).toHaveTextContent('Apenas uma resposta direta.');
  });
});
