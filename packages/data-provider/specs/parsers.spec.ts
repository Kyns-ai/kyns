import {
  replaceSpecialVars,
  parseConvo,
  parseCompactConvo,
  parseTextParts,
  extractDialogueForTTS,
  extractThinkingContent,
  extractSuggestions,
} from '../src/parsers';
import { specialVariables } from '../src/config';
import { EModelEndpoint } from '../src/schemas';
import { ContentTypes } from '../src/types/runs';
import type { TMessageContentParts } from '../src/types/assistants';
import type { TUser, TConversation } from '../src/types';

// Mock dayjs module with consistent date/time values regardless of environment
jest.mock('dayjs', () => {
  const mockDayjs = () => ({
    format: (format: string) => {
      if (format === 'YYYY-MM-DD') {
        return '2024-04-29';
      }
      if (format === 'YYYY-MM-DD HH:mm:ss Z') {
        return '2024-04-29 12:34:56 -04:00';
      }
      if (format === 'dddd') {
        return 'Monday';
      }
      throw new Error(
        `Unhandled dayjs().format() call in mock: "${format}". Update the mock in parsers.spec.ts`,
      );
    },
    toISOString: () => '2024-04-29T16:34:56.000Z',
  });

  mockDayjs.extend = jest.fn();

  return mockDayjs;
});

describe('replaceSpecialVars', () => {
  // Create a partial user object for testing
  const mockUser = {
    name: 'Test User',
    id: 'user123',
  } as TUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return the original text if text is empty', () => {
    expect(replaceSpecialVars({ text: '' })).toBe('');
    expect(replaceSpecialVars({ text: null as unknown as string })).toBe(null);
    expect(replaceSpecialVars({ text: undefined as unknown as string })).toBe(undefined);
  });

  test('should replace {{current_date}} with the current date', () => {
    const result = replaceSpecialVars({ text: 'Today is {{current_date}}' });
    expect(result).toBe('Today is 2024-04-29 (Monday)');
  });

  test('should replace {{current_datetime}} with the current datetime', () => {
    const result = replaceSpecialVars({ text: 'Now is {{current_datetime}}' });
    expect(result).toBe('Now is 2024-04-29 12:34:56 -04:00 (Monday)');
  });

  test('should replace {{iso_datetime}} with the ISO datetime', () => {
    const result = replaceSpecialVars({ text: 'ISO time: {{iso_datetime}}' });
    expect(result).toBe('ISO time: 2024-04-29T16:34:56.000Z');
  });

  test('should replace {{current_user}} with the user name if provided', () => {
    const result = replaceSpecialVars({
      text: 'Hello {{current_user}}!',
      user: mockUser,
    });
    expect(result).toBe('Hello Test User!');
  });

  test('should not replace {{current_user}} if user is not provided', () => {
    const result = replaceSpecialVars({
      text: 'Hello {{current_user}}!',
    });
    expect(result).toBe('Hello {{current_user}}!');
  });

  test('should not replace {{current_user}} if user has no name', () => {
    const result = replaceSpecialVars({
      text: 'Hello {{current_user}}!',
      user: { id: 'user123' } as TUser,
    });
    expect(result).toBe('Hello {{current_user}}!');
  });

  test('should handle multiple replacements in the same text', () => {
    const result = replaceSpecialVars({
      text: 'Hello {{current_user}}! Today is {{current_date}} and the time is {{current_datetime}}. ISO: {{iso_datetime}}',
      user: mockUser,
    });
    expect(result).toBe(
      'Hello Test User! Today is 2024-04-29 (Monday) and the time is 2024-04-29 12:34:56 -04:00 (Monday). ISO: 2024-04-29T16:34:56.000Z',
    );
  });

  test('should be case-insensitive when replacing variables', () => {
    const result = replaceSpecialVars({
      text: 'Date: {{CURRENT_DATE}}, User: {{Current_User}}',
      user: mockUser,
    });
    expect(result).toBe('Date: 2024-04-29 (Monday), User: Test User');
  });

  test('should confirm all specialVariables from config.ts get parsed', () => {
    // Create a text that includes all special variables
    const specialVarsText = Object.keys(specialVariables)
      .map((key) => `{{${key}}}`)
      .join(' ');

    const result = replaceSpecialVars({
      text: specialVarsText,
      user: mockUser,
    });

    // Verify none of the original variable placeholders remain in the result
    Object.keys(specialVariables).forEach((key) => {
      const placeholder = `{{${key}}}`;
      expect(result).not.toContain(placeholder);
    });

    // Verify the expected replacements
    expect(result).toContain('2024-04-29 (Monday)'); // current_date
    expect(result).toContain('2024-04-29 12:34:56 -04:00 (Monday)'); // current_datetime
    expect(result).toContain('2024-04-29T16:34:56.000Z'); // iso_datetime
    expect(result).toContain('Test User'); // current_user
  });
});

describe('parseCompactConvo', () => {
  describe('iconURL security sanitization', () => {
    test('should strip iconURL from OpenAI endpoint conversation input', () => {
      const maliciousIconURL = 'https://evil-tracker.example.com/pixel.png?user=victim';
      const conversation: Partial<TConversation> = {
        model: 'gpt-4',
        iconURL: maliciousIconURL,
        endpoint: EModelEndpoint.openAI,
      };

      const result = parseCompactConvo({
        endpoint: EModelEndpoint.openAI,
        conversation,
      });

      expect(result).not.toBeNull();
      expect(result?.['iconURL']).toBeUndefined();
      expect(result?.model).toBe('gpt-4');
    });

    test('should strip iconURL from agents endpoint conversation input', () => {
      const maliciousIconURL = 'https://evil-tracker.example.com/pixel.png';
      const conversation: Partial<TConversation> = {
        agent_id: 'agent_123',
        iconURL: maliciousIconURL,
        endpoint: EModelEndpoint.agents,
      };

      const result = parseCompactConvo({
        endpoint: EModelEndpoint.agents,
        conversation,
      });

      expect(result).not.toBeNull();
      expect(result?.['iconURL']).toBeUndefined();
      expect(result?.agent_id).toBe('agent_123');
    });

    test('should strip iconURL from anthropic endpoint conversation input', () => {
      const maliciousIconURL = 'https://tracker.malicious.com/beacon.gif';
      const conversation: Partial<TConversation> = {
        model: 'claude-3-opus',
        iconURL: maliciousIconURL,
        endpoint: EModelEndpoint.anthropic,
      };

      const result = parseCompactConvo({
        endpoint: EModelEndpoint.anthropic,
        conversation,
      });

      expect(result).not.toBeNull();
      expect(result?.['iconURL']).toBeUndefined();
      expect(result?.model).toBe('claude-3-opus');
    });

    test('should strip iconURL from google endpoint conversation input', () => {
      const maliciousIconURL = 'https://tracking.example.com/spy.png';
      const conversation: Partial<TConversation> = {
        model: 'gemini-pro',
        iconURL: maliciousIconURL,
        endpoint: EModelEndpoint.google,
      };

      const result = parseCompactConvo({
        endpoint: EModelEndpoint.google,
        conversation,
      });

      expect(result).not.toBeNull();
      expect(result?.['iconURL']).toBeUndefined();
      expect(result?.model).toBe('gemini-pro');
    });

    test('should strip iconURL from assistants endpoint conversation input', () => {
      const maliciousIconURL = 'https://evil.com/track.png';
      const conversation: Partial<TConversation> = {
        assistant_id: 'asst_123',
        iconURL: maliciousIconURL,
        endpoint: EModelEndpoint.assistants,
      };

      const result = parseCompactConvo({
        endpoint: EModelEndpoint.assistants,
        conversation,
      });

      expect(result).not.toBeNull();
      expect(result?.['iconURL']).toBeUndefined();
      expect(result?.assistant_id).toBe('asst_123');
    });

    test('should preserve other conversation properties while stripping iconURL', () => {
      const conversation: Partial<TConversation> = {
        model: 'gpt-4',
        iconURL: 'https://malicious.com/track.png',
        endpoint: EModelEndpoint.openAI,
        temperature: 0.7,
        top_p: 0.9,
        promptPrefix: 'You are a helpful assistant.',
        maxContextTokens: 4000,
      };

      const result = parseCompactConvo({
        endpoint: EModelEndpoint.openAI,
        conversation,
      });

      expect(result).not.toBeNull();
      expect(result?.['iconURL']).toBeUndefined();
      expect(result?.model).toBe('gpt-4');
      expect(result?.temperature).toBe(0.7);
      expect(result?.top_p).toBe(0.9);
      expect(result?.promptPrefix).toBe('You are a helpful assistant.');
      expect(result?.maxContextTokens).toBe(4000);
    });

    test('should handle conversation without iconURL (no error)', () => {
      const conversation: Partial<TConversation> = {
        model: 'gpt-4',
        endpoint: EModelEndpoint.openAI,
      };

      const result = parseCompactConvo({
        endpoint: EModelEndpoint.openAI,
        conversation,
      });

      expect(result).not.toBeNull();
      expect(result?.['iconURL']).toBeUndefined();
      expect(result?.model).toBe('gpt-4');
    });
  });
});

describe('parseConvo - defaultParamsEndpoint', () => {
  test('should strip maxOutputTokens for custom endpoint without defaultParamsEndpoint', () => {
    const conversation: Partial<TConversation> = {
      model: 'anthropic/claude-opus-4.5',
      temperature: 0.7,
      maxOutputTokens: 8192,
      maxContextTokens: 50000,
    };

    const result = parseConvo({
      endpoint: 'MyCustomEndpoint' as EModelEndpoint,
      endpointType: EModelEndpoint.custom,
      conversation,
    });

    expect(result).not.toBeNull();
    expect(result?.temperature).toBe(0.7);
    expect(result?.maxContextTokens).toBe(50000);
    expect(result?.maxOutputTokens).toBeUndefined();
  });

  test('should preserve maxOutputTokens when defaultParamsEndpoint is anthropic', () => {
    const conversation: Partial<TConversation> = {
      model: 'anthropic/claude-opus-4.5',
      temperature: 0.7,
      maxOutputTokens: 8192,
      topP: 0.9,
      topK: 40,
      maxContextTokens: 50000,
    };

    const result = parseConvo({
      endpoint: 'MyCustomEndpoint' as EModelEndpoint,
      endpointType: EModelEndpoint.custom,
      conversation,
      defaultParamsEndpoint: EModelEndpoint.anthropic,
    });

    expect(result).not.toBeNull();
    expect(result?.model).toBe('anthropic/claude-opus-4.5');
    expect(result?.temperature).toBe(0.7);
    expect(result?.maxOutputTokens).toBe(8192);
    expect(result?.topP).toBe(0.9);
    expect(result?.topK).toBe(40);
    expect(result?.maxContextTokens).toBe(50000);
  });

  test('should strip OpenAI-specific fields when defaultParamsEndpoint is anthropic', () => {
    const conversation: Partial<TConversation> = {
      model: 'anthropic/claude-opus-4.5',
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 0.9,
      presence_penalty: 0.5,
      frequency_penalty: 0.3,
    };

    const result = parseConvo({
      endpoint: 'MyCustomEndpoint' as EModelEndpoint,
      endpointType: EModelEndpoint.custom,
      conversation,
      defaultParamsEndpoint: EModelEndpoint.anthropic,
    });

    expect(result).not.toBeNull();
    expect(result?.temperature).toBe(0.7);
    expect(result?.max_tokens).toBeUndefined();
    expect(result?.top_p).toBeUndefined();
    expect(result?.presence_penalty).toBeUndefined();
    expect(result?.frequency_penalty).toBeUndefined();
  });

  test('should preserve max_tokens when defaultParamsEndpoint is not set (OpenAI default)', () => {
    const conversation: Partial<TConversation> = {
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 0.9,
    };

    const result = parseConvo({
      endpoint: 'MyCustomEndpoint' as EModelEndpoint,
      endpointType: EModelEndpoint.custom,
      conversation,
    });

    expect(result).not.toBeNull();
    expect(result?.max_tokens).toBe(4096);
    expect(result?.top_p).toBe(0.9);
  });

  test('should preserve Google-specific fields when defaultParamsEndpoint is google', () => {
    const conversation: Partial<TConversation> = {
      model: 'gemini-pro',
      temperature: 0.7,
      maxOutputTokens: 8192,
      topP: 0.9,
      topK: 40,
    };

    const result = parseConvo({
      endpoint: 'MyCustomEndpoint' as EModelEndpoint,
      endpointType: EModelEndpoint.custom,
      conversation,
      defaultParamsEndpoint: EModelEndpoint.google,
    });

    expect(result).not.toBeNull();
    expect(result?.maxOutputTokens).toBe(8192);
    expect(result?.topP).toBe(0.9);
    expect(result?.topK).toBe(40);
  });

  test('should not strip fields from non-custom endpoints that already have a schema', () => {
    const conversation: Partial<TConversation> = {
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 0.9,
    };

    const result = parseConvo({
      endpoint: EModelEndpoint.openAI,
      conversation,
      defaultParamsEndpoint: EModelEndpoint.anthropic,
    });

    expect(result).not.toBeNull();
    expect(result?.max_tokens).toBe(4096);
    expect(result?.top_p).toBe(0.9);
  });

  test('should not carry bedrock region to custom endpoint without defaultParamsEndpoint', () => {
    const conversation: Partial<TConversation> = {
      model: 'gpt-4o',
      temperature: 0.7,
      region: 'us-east-1',
    };

    const result = parseConvo({
      endpoint: 'MyCustomEndpoint' as EModelEndpoint,
      endpointType: EModelEndpoint.custom,
      conversation,
    });

    expect(result).not.toBeNull();
    expect(result?.temperature).toBe(0.7);
    expect(result?.region).toBeUndefined();
  });

  test('should fall back to endpointType schema when defaultParamsEndpoint is invalid', () => {
    const conversation: Partial<TConversation> = {
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 4096,
      maxOutputTokens: 8192,
    };

    const result = parseConvo({
      endpoint: 'MyCustomEndpoint' as EModelEndpoint,
      endpointType: EModelEndpoint.custom,
      conversation,
      defaultParamsEndpoint: 'nonexistent_endpoint',
    });

    expect(result).not.toBeNull();
    expect(result?.max_tokens).toBe(4096);
    expect(result?.maxOutputTokens).toBeUndefined();
  });
});

describe('parseCompactConvo - defaultParamsEndpoint', () => {
  test('should strip maxOutputTokens for custom endpoint without defaultParamsEndpoint', () => {
    const conversation: Partial<TConversation> = {
      model: 'anthropic/claude-opus-4.5',
      temperature: 0.7,
      maxOutputTokens: 8192,
    };

    const result = parseCompactConvo({
      endpoint: 'MyCustomEndpoint' as EModelEndpoint,
      endpointType: EModelEndpoint.custom,
      conversation,
    });

    expect(result).not.toBeNull();
    expect(result?.temperature).toBe(0.7);
    expect(result?.maxOutputTokens).toBeUndefined();
  });

  test('should preserve maxOutputTokens when defaultParamsEndpoint is anthropic', () => {
    const conversation: Partial<TConversation> = {
      model: 'anthropic/claude-opus-4.5',
      temperature: 0.7,
      maxOutputTokens: 8192,
      topP: 0.9,
      maxContextTokens: 50000,
    };

    const result = parseCompactConvo({
      endpoint: 'MyCustomEndpoint' as EModelEndpoint,
      endpointType: EModelEndpoint.custom,
      conversation,
      defaultParamsEndpoint: EModelEndpoint.anthropic,
    });

    expect(result).not.toBeNull();
    expect(result?.maxOutputTokens).toBe(8192);
    expect(result?.topP).toBe(0.9);
    expect(result?.maxContextTokens).toBe(50000);
  });

  test('should strip iconURL even when defaultParamsEndpoint is set', () => {
    const conversation: Partial<TConversation> = {
      model: 'anthropic/claude-opus-4.5',
      iconURL: 'https://malicious.com/track.png',
      maxOutputTokens: 8192,
    };

    const result = parseCompactConvo({
      endpoint: 'MyCustomEndpoint' as EModelEndpoint,
      endpointType: EModelEndpoint.custom,
      conversation,
      defaultParamsEndpoint: EModelEndpoint.anthropic,
    });

    expect(result).not.toBeNull();
    expect(result?.['iconURL']).toBeUndefined();
    expect(result?.maxOutputTokens).toBe(8192);
  });

  test('should fall back to endpointType when defaultParamsEndpoint is null', () => {
    const conversation: Partial<TConversation> = {
      model: 'gpt-4o',
      max_tokens: 4096,
      maxOutputTokens: 8192,
    };

    const result = parseCompactConvo({
      endpoint: 'MyCustomEndpoint' as EModelEndpoint,
      endpointType: EModelEndpoint.custom,
      conversation,
      defaultParamsEndpoint: null,
    });

    expect(result).not.toBeNull();
    expect(result?.max_tokens).toBe(4096);
    expect(result?.maxOutputTokens).toBeUndefined();
  });
});

describe('parseTextParts', () => {
  test('should concatenate text parts', () => {
    const parts: TMessageContentParts[] = [
      { type: ContentTypes.TEXT, text: 'Hello' },
      { type: ContentTypes.TEXT, text: 'World' },
    ];
    expect(parseTextParts(parts)).toBe('Hello World');
  });

  test('should handle text parts with object-style text values', () => {
    const parts: TMessageContentParts[] = [
      { type: ContentTypes.TEXT, text: { value: 'structured text' } },
    ];
    expect(parseTextParts(parts)).toBe('structured text');
  });

  test('should extract :::thinking blocks from text parts', () => {
    const extracted = extractThinkingContent(':::thinking\nstep 1\n:::\nVisible answer');

    expect(extracted.thinkingContent).toBe('step 1');
    expect(extracted.regularContent).toBe('Visible answer');
    expect(extracted.segments).toEqual([
      { type: 'think', content: 'step 1' },
      { type: 'text', content: '\nVisible answer' },
    ]);
  });

  test('should extract think tags and skip them when requested', () => {
    const parts: TMessageContentParts[] = [
      { type: ContentTypes.TEXT, text: 'Answer <think>private chain</think>done' },
    ];

    expect(parseTextParts(parts)).toBe('Answer private chain done');
    expect(parseTextParts(parts, true)).toBe('Answer done');
  });

  test('should treat leading thinking process sections as reasoning only', () => {
    const extracted = extractThinkingContent('Thinking Process:\n\n1. Analyze\n2. Decide');

    expect(extracted.thinkingContent).toBe('Thinking Process:\n\n1. Analyze\n2. Decide');
    expect(extracted.regularContent).toBe('');
  });

  test('should keep final answer after a thinking process heading', () => {
    const extracted = extractThinkingContent(
      'Thinking Process:\n\n1. Analyze\n2. Decide\n\nFinal Answer: 437',
    );

    expect(extracted.thinkingContent).toBe('1. Analyze\n2. Decide');
    expect(extracted.regularContent).toBe('437');
  });

  test('should extract markdown-emphasized thinking and final answer headings', () => {
    const extracted = extractThinkingContent(
      '**Thinking Process:**\n\n1. Analyze\n2. Decide\n\n**Final Answer:** 437',
    );

    expect(extracted.thinkingContent).toBe('1. Analyze\n2. Decide');
    expect(extracted.regularContent).toBe('437');
  });

  test('should extract markdown heading thinking and final answer sections', () => {
    const extracted = extractThinkingContent(
      '### Thinking Process\n\n1. Analyze\n2. Decide\n\n## Final Answer\n437',
    );

    expect(extracted.thinkingContent).toBe('1. Analyze\n2. Decide');
    expect(extracted.regularContent).toBe('437');
  });

  test('should remove duplicated final answer from the end of a think block', () => {
    const extracted = extractThinkingContent(
      '<think>1. Analyze\n2. Decide\n\nResposta final</think>Resposta final',
    );

    expect(extracted.thinkingContent).toBe('1. Analyze\n2. Decide');
    expect(extracted.regularContent).toBe('Resposta final');
    expect(extracted.segments).toEqual([
      { type: 'think', content: '1. Analyze\n2. Decide' },
      { type: 'text', content: 'Resposta final' },
    ]);
  });

  test('should hide incomplete think blocks while streaming', () => {
    const extracted = extractThinkingContent('Resposta parcial <think>raciocínio ainda aberto');

    expect(extracted.thinkingContent).toBe('raciocínio ainda aberto');
    expect(extracted.regularContent).toBe('Resposta parcial');
    expect(extracted.segments).toEqual([
      { type: 'text', content: 'Resposta parcial' },
      { type: 'think', content: 'raciocínio ainda aberto' },
    ]);
  });

  test('should include think parts by default', () => {
    const parts: TMessageContentParts[] = [
      { type: ContentTypes.TEXT, text: 'Answer:' },
      { type: ContentTypes.THINK, think: 'reasoning step' },
    ];
    expect(parseTextParts(parts)).toBe('Answer: reasoning step');
  });

  test('should skip think parts when skipReasoning is true', () => {
    const parts: TMessageContentParts[] = [
      { type: ContentTypes.THINK, think: 'internal reasoning' },
      { type: ContentTypes.TEXT, text: 'visible answer' },
    ];
    expect(parseTextParts(parts, true)).toBe('visible answer');
  });

  test('should skip non-text/think part types', () => {
    const parts: TMessageContentParts[] = [
      { type: ContentTypes.TEXT, text: 'before' },
      { type: ContentTypes.IMAGE_FILE } as TMessageContentParts,
      { type: ContentTypes.TEXT, text: 'after' },
    ];
    expect(parseTextParts(parts)).toBe('before after');
  });

  test('should handle undefined elements in the content parts array', () => {
    const parts: Array<TMessageContentParts | undefined> = [
      { type: ContentTypes.TEXT, text: 'first' },
      undefined,
      { type: ContentTypes.TEXT, text: 'third' },
    ];
    expect(parseTextParts(parts)).toBe('first third');
  });

  test('should handle multiple consecutive undefined elements', () => {
    const parts: Array<TMessageContentParts | undefined> = [
      undefined,
      undefined,
      { type: ContentTypes.TEXT, text: 'only text' },
      undefined,
    ];
    expect(parseTextParts(parts)).toBe('only text');
  });

  test('should handle an array of all undefined elements', () => {
    const parts: Array<TMessageContentParts | undefined> = [undefined, undefined, undefined];
    expect(parseTextParts(parts)).toBe('');
  });

  test('should handle parts with missing type property', () => {
    const parts: Array<TMessageContentParts | undefined> = [
      { text: 'no type field' } as unknown as TMessageContentParts,
      { type: ContentTypes.TEXT, text: 'valid' },
    ];
    expect(parseTextParts(parts)).toBe('valid');
  });

  test('should return empty string for empty array', () => {
    expect(parseTextParts([])).toBe('');
  });

  test('should not add extra spaces when parts already have spacing', () => {
    const parts: TMessageContentParts[] = [
      { type: ContentTypes.TEXT, text: 'Hello ' },
      { type: ContentTypes.TEXT, text: 'World' },
    ];
    expect(parseTextParts(parts)).toBe('Hello World');
  });
});

describe('extractDialogueForTTS', () => {
  test('should return only quoted speech when dialogue exists', () => {
    const text =
      '*Ela sorri de lado.* "Oi, amor." *Passa a mão no teu braço.* "Como foi teu dia?"';

    expect(extractDialogueForTTS(text)).toBe('Oi, amor. Como foi teu dia?');
  });

  test('should support smart quotes', () => {
    const text = '*Ela ri baixo.* “Vem cá.” *Te encara por um segundo.* “Eu tava com saudade.”';

    expect(extractDialogueForTTS(text)).toBe('Vem cá. Eu tava com saudade.');
  });

  test('should fall back to sanitized text when no quoted speech exists', () => {
    const text = '*Ela sorri de lado e senta na tua frente.*';

    expect(extractDialogueForTTS(text)).toBe('');
  });

  test('should ignore thinking blocks before extracting dialogue', () => {
    const text = '<think>private reasoning</think>*Ela se aproxima.* "Agora me escuta."';

    expect(extractDialogueForTTS(text)).toBe('Agora me escuta.');

describe('extractSuggestions', () => {
  test('returns original text unchanged when no suggestions block is present', () => {
    const text = 'Uma resposta normal sem sugestões.';
    const result = extractSuggestions(text);
    expect(result.cleanText).toBe(text);
    expect(result.suggestions).toEqual([]);
  });

  test('removes a suggestions block and returns its lines', () => {
    const text =
      'Resposta.\n[suggestions]\nComo aplicar isso?\nQual o risco?\nE o contrário?\n[/suggestions]';
    const result = extractSuggestions(text);
    expect(result.cleanText).toBe('Resposta.');
    expect(result.suggestions).toEqual(['Como aplicar isso?', 'Qual o risco?', 'E o contrário?']);
  });

  test('trims whitespace from suggestion lines', () => {
    const text = 'Texto.\n[suggestions]\n  Opção A  \n  Opção B  \n[/suggestions]';
    const result = extractSuggestions(text);
    expect(result.suggestions).toEqual(['Opção A', 'Opção B']);
  });

  test('caps suggestions at MAX_SUGGESTIONS (4)', () => {
    const text =
      'Texto.\n[suggestions]\nA\nB\nC\nD\nE\n[/suggestions]';
    const result = extractSuggestions(text);
    expect(result.suggestions).toHaveLength(4);
    expect(result.suggestions).toEqual(['A', 'B', 'C', 'D']);
  });

  test('returns empty cleanText when entire message is a suggestions block', () => {
    const text = '[suggestions]\nA\nB\n[/suggestions]';
    const result = extractSuggestions(text);
    expect(result.cleanText).toBe('');
    expect(result.suggestions).toEqual(['A', 'B']);
  });

  test('handles empty string input', () => {
    const result = extractSuggestions('');
    expect(result.cleanText).toBe('');
    expect(result.suggestions).toEqual([]);
  });

  test('handles text without closing tag gracefully (no match, returns as-is)', () => {
    const text = 'Texto. [suggestions]\nOrfão sem fechar.';
    const result = extractSuggestions(text);
    expect(result.cleanText).toBe(text);
    expect(result.suggestions).toEqual([]);
  });
});
