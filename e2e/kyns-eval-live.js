#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const yaml = require('js-yaml');

const { EVAL_CASES } = require('./kyns-eval-cases');
const { prependKynsMasterPrompt } = require('../api/server/services/safety/kynsPlatform');

dotenv.config({ path: path.resolve(process.cwd(), 'e2e/.env.e2e') });
dotenv.config();

const ROOT = process.cwd();
const CONFIG_PATH = path.resolve(ROOT, 'librechat.yaml');
const RESULTS_DIR = path.resolve(ROOT, 'e2e/.artifacts');
const DEFAULT_OUTPUT_PATH = path.join(RESULTS_DIR, 'kyns-eval-live-results.json');
const BLOCKED_TEXT = 'Essa conversa não pode continuar nessa direção.';
const LOOP_INTERRUPTED_TEXT = 'A resposta entrou em loop e foi interrompida. Tente novamente.';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_APP_BASE_URL =
  process.env.KYNS_EVAL_APP_BASE_URL || process.env.LIBRECHAT_BASE_URL || 'https://chat.kyns.ai';
const DEFAULT_APP_EMAIL = process.env.KYNS_TEST_EMAIL || 'kyns.e2e.test@kyns.ai';
const DEFAULT_APP_PASSWORD = process.env.KYNS_TEST_PASSWORD || 'KynsTest2026!';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DEFAULT_TIMEOUTS_MS = {
  kyns: 120_000,
  'kyns-deep': 180_000,
};

const FILLER_OPENING_PATTERNS = [
  /^\s*claro[\s!,.:-]/i,
  /^\s*(otima|ótima|boa|excelente)\s+pergunta\b/i,
  /^\s*como posso ajudar\b/i,
  /^\s*(com certeza|sem problema|vamos la|vamos lá)\b/i,
];

const VISIBLE_META_PATTERNS = [
  /<think>/i,
  /<\/think>/i,
  /\bthinking process\b/i,
  /^here'?s a thinking process\b/i,
  /^plan:/i,
  /^let me (think|restart|break this down)\b/i,
  /^response start\b/i,
  /^output generation\b/i,
  /\bas an ai\b/i,
  /\bcomo ia\b/i,
  /\bsou uma ia\b/i,
];

function parseArgs(argv) {
  const options = {
    caseId: null,
    compareDeepThinking: false,
    limit: null,
    mode: 'auto',
    outputPath: DEFAULT_OUTPUT_PATH,
    appBaseUrl: DEFAULT_APP_BASE_URL,
    appEmail: DEFAULT_APP_EMAIL,
    appPassword: DEFAULT_APP_PASSWORD,
    proxyApiKey: process.env.KYNS_EVAL_API_KEY || process.env.OPENAI_API_KEY || '',
    proxyBaseUrl: process.env.KYNS_EVAL_BASE_URL || process.env.OPENAI_REVERSE_PROXY || '',
    repeatsOverride: null,
    spec: null,
    skipWarmup: false,
  };

  for (const arg of argv) {
    if (arg === '--compare-deep-thinking') {
      options.compareDeepThinking = true;
      continue;
    }
    if (arg === '--skip-warmup') {
      options.skipWarmup = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      continue;
    }
    const [flag, rawValue = ''] = arg.split('=');
    switch (flag) {
      case '--case':
        options.caseId = rawValue.trim() || null;
        break;
      case '--app-base-url':
        options.appBaseUrl = rawValue.trim() || DEFAULT_APP_BASE_URL;
        break;
      case '--app-email':
        options.appEmail = rawValue.trim() || DEFAULT_APP_EMAIL;
        break;
      case '--app-password':
        options.appPassword = rawValue.trim() || DEFAULT_APP_PASSWORD;
        break;
      case '--limit':
        options.limit = Number.parseInt(rawValue, 10) || null;
        break;
      case '--mode':
        options.mode = rawValue.trim() || 'auto';
        break;
      case '--output':
        options.outputPath = rawValue.trim() || DEFAULT_OUTPUT_PATH;
        break;
      case '--proxy-api-key':
        options.proxyApiKey = rawValue.trim();
        break;
      case '--proxy-base-url':
        options.proxyBaseUrl = rawValue.trim();
        break;
      case '--repeats':
        options.repeatsOverride = Number.parseInt(rawValue, 10) || null;
        break;
      case '--spec':
        options.spec = rawValue.trim() || null;
        break;
      default:
        break;
    }
  }

  return options;
}

function resolveMode(options) {
  if (options.mode === 'proxy' || options.mode === 'app') {
    return options.mode;
  }
  return options.proxyBaseUrl && options.proxyApiKey ? 'proxy' : 'app';
}

function ensureTargetConfig(mode, options) {
  if (mode === 'proxy') {
    if (!options.proxyBaseUrl) {
      throw new Error(
        'Base URL do proxy ausente. Defina OPENAI_REVERSE_PROXY, KYNS_EVAL_BASE_URL ou use --proxy-base-url.',
      );
    }
    if (!options.proxyApiKey) {
      throw new Error(
        'API key do proxy ausente. Defina OPENAI_API_KEY, KYNS_EVAL_API_KEY ou use --proxy-api-key.',
      );
    }
    return;
  }

  if (!options.appBaseUrl) {
    throw new Error('Base URL do app ausente. Use --app-base-url ou KYNS_EVAL_APP_BASE_URL.');
  }
  if (!options.appEmail || !options.appPassword) {
    throw new Error('Credenciais do app ausentes. Use --app-email/--app-password ou KYNS_TEST_*.');
  }
}

function loadConfig() {
  return yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function normalizeOpenAIBaseUrl(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/chat/completions`;
  }
  return `${trimmed}/v1/chat/completions`;
}

function normalizeText(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeExactText(text = '') {
  return normalizeText(text)
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

function countNonEmptyLines(text = '') {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function countSentences(text = '') {
  return text
    .split(/[.!?]+/g)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function uniqueRatio(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 1;
  }
  return new Set(values).size / values.length;
}

function detectLooping(text = '') {
  const normalized = normalizeText(text).replace(/\s+/g, ' ').trim();
  if (normalized.length < 700) {
    return false;
  }

  const trailingWindow = normalized.slice(-1200);
  const words = trailingWindow.split(' ').filter(Boolean);
  if (words.length >= 80) {
    const trailingWords = words.slice(-120);
    const wordRatio = uniqueRatio(trailingWords);
    if (wordRatio < 0.35) {
      return true;
    }
  }

  return /(.{40,120})\1{2,}/.test(trailingWindow);
}

function matchesAnyPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function includesAll(text, terms = []) {
  const normalized = normalizeText(text);
  return terms.every((term) => normalized.includes(normalizeText(term)));
}

function includesAny(text, terms = []) {
  const normalized = normalizeText(text);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function includesGroups(text, groups = []) {
  return groups.every((group) => includesAny(text, group));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickCustomEndpoint(config, endpointName) {
  const customEndpoints = config?.endpoints?.custom;
  if (!Array.isArray(customEndpoints)) {
    throw new Error('Nenhum endpoint custom encontrado no librechat.yaml.');
  }
  const endpoint = customEndpoints.find((item) => item.name === endpointName);
  if (!endpoint) {
    throw new Error(`Endpoint custom "${endpointName}" não encontrado no librechat.yaml.`);
  }
  return endpoint;
}

function pickPreset(config, specName) {
  const specs = config?.modelSpecs?.list;
  if (!Array.isArray(specs)) {
    throw new Error('Nenhum model spec encontrado no librechat.yaml.');
  }
  const spec = specs.find((item) => item.name === specName);
  if (!spec?.preset) {
    throw new Error(`Model spec "${specName}" não encontrado no librechat.yaml.`);
  }
  return spec;
}

function buildSpecConfig(config, specName, overrides = {}) {
  const spec = pickPreset(config, specName);
  const endpoint = pickCustomEndpoint(config, spec.preset.endpoint);
  const endpointParams = endpoint.addParams ?? {};
  const chatTemplateKwargs = {
    ...(endpointParams.chat_template_kwargs ?? {}),
    ...(overrides.chat_template_kwargs ?? {}),
  };

  const requestParams = {
    model: spec.preset.model,
    user: 'kyns-eval-live',
  };

  const copyIfPresent = (source, key) => {
    if (source[key] != null && source[key] !== '') {
      requestParams[key] = source[key];
    }
  };

  copyIfPresent(spec.preset, 'temperature');
  copyIfPresent(spec.preset, 'top_p');
  copyIfPresent(spec.preset, 'frequency_penalty');
  copyIfPresent(spec.preset, 'max_tokens');
  copyIfPresent(spec.preset, 'reasoning_effort');
  copyIfPresent(endpointParams, 'repetition_penalty');
  copyIfPresent(endpointParams, 'top_k');

  if (Object.keys(chatTemplateKwargs).length > 0) {
    requestParams.chat_template_kwargs = chatTemplateKwargs;
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (key === 'chat_template_kwargs') {
      continue;
    }
    if (value != null && value !== '') {
      requestParams[key] = value;
    }
  }

  return {
    promptPrefix: spec.preset.promptPrefix ?? '',
    requestParams,
    specName,
  };
}

function buildVariants(config, options) {
  const current = {
    id: 'current',
    label: 'config-local-atual',
    specs: {
      kyns: buildSpecConfig(config, 'kyns'),
      'kyns-deep': buildSpecConfig(config, 'kyns-deep'),
    },
  };

  if (!options.compareDeepThinking) {
    return [current];
  }

  return [
    current,
    {
      id: 'deep-thinking-on',
      label: 'deep-enable-thinking',
      specs: {
        kyns: current.specs.kyns,
        'kyns-deep': buildSpecConfig(config, 'kyns-deep', {
          chat_template_kwargs: { enable_thinking: true },
        }),
      },
    },
  ];
}

function filterCases(options) {
  let cases = [...EVAL_CASES];
  if (options.spec) {
    cases = cases.filter((testCase) => testCase.spec === options.spec);
  }
  if (options.caseId) {
    cases = cases.filter((testCase) => testCase.id === options.caseId);
  }
  if (options.limit != null && options.limit > 0) {
    cases = cases.slice(0, options.limit);
  }
  return cases;
}

function extractText(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item?.type === 'text' && typeof item.text === 'string') {
          return item.text;
        }
        if (typeof item?.text?.value === 'string') {
          return item.text.value;
        }
        return '';
      })
      .filter(Boolean)
      .join('');
  }
  if (value != null && typeof value === 'object') {
    if (typeof value.text === 'string') {
      return value.text;
    }
    if (typeof value.content === 'string') {
      return value.content;
    }
  }
  return '';
}

function extractChoiceContent(choice) {
  if (!choice) {
    return '';
  }
  if (choice.message?.content != null) {
    return extractText(choice.message.content);
  }
  if (choice.delta?.content != null) {
    return extractText(choice.delta.content);
  }
  return '';
}

function extractChoiceReasoning(choice) {
  if (!choice) {
    return '';
  }
  if (choice.delta?.reasoning_content != null) {
    return extractText(choice.delta.reasoning_content);
  }
  if (choice.delta?.reasoning != null) {
    return extractText(choice.delta.reasoning);
  }
  if (choice.message?.reasoning_content != null) {
    return extractText(choice.message.reasoning_content);
  }
  if (choice.message?.reasoning != null) {
    return extractText(choice.message.reasoning);
  }
  return '';
}

async function streamCompletion({ apiKey, requestBody, timeoutMs, url }) {
  const controller = new AbortController();
  const startedAt = Date.now();
  let timeoutId;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  try {
    timeoutId = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        ...requestBody,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errorBody.slice(0, 400)}`);
    }

    if (!response.body) {
      throw new Error('Resposta sem body de stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const rawEvents = [];
    let buffer = '';
    let content = '';
    let reasoning = '';
    let finishReason = 'stream_end';
    let firstChunkMs = null;
    let firstVisibleTokenMs = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) {
          continue;
        }

        const data = line.slice(5).trim();
        if (!data) {
          continue;
        }
        if (data === '[DONE]') {
          cleanup();
          return {
            content,
            reasoning,
            finishReason,
            firstChunkMs,
            firstVisibleTokenMs,
            rawEvents,
            totalMs: Date.now() - startedAt,
          };
        }

        let payload;
        try {
          payload = JSON.parse(data);
        } catch {
          continue;
        }

        if (rawEvents.length < 40) {
          rawEvents.push(payload);
        }

        const choice = payload.choices?.[0];
        if (!choice) {
          continue;
        }

        const reasoningDelta = extractChoiceReasoning(choice);
        const contentDelta = extractChoiceContent(choice);

        if ((reasoningDelta || contentDelta) && firstChunkMs == null) {
          firstChunkMs = Date.now() - startedAt;
        }
        if (contentDelta && firstVisibleTokenMs == null) {
          firstVisibleTokenMs = Date.now() - startedAt;
        }

        if (reasoningDelta) {
          reasoning += reasoningDelta;
        }
        if (contentDelta) {
          content += contentDelta;
        }

        const choiceFinishReason = choice.finish_reason ?? choice.finishReason;
        if (choiceFinishReason) {
          finishReason = choiceFinishReason;
        }
      }
    }

    cleanup();
    return {
      content,
      reasoning,
      finishReason,
      firstChunkMs,
      firstVisibleTokenMs,
      rawEvents,
      totalMs: Date.now() - startedAt,
    };
  } catch (error) {
    cleanup();
    const timeout = error?.name === 'AbortError' || /timeout/i.test(error?.message ?? '');
    return {
      content: '',
      reasoning: '',
      error: timeout ? 'timeout' : error?.message ?? 'unknown_error',
      finishReason: timeout ? 'timeout' : 'error',
      firstChunkMs: null,
      firstVisibleTokenMs: null,
      rawEvents: [],
      totalMs: Date.now() - startedAt,
    };
  }
}

async function loginApp({ baseUrl, email, password }) {
  const response = await fetch(`${String(baseUrl).replace(/\/+$/, '')}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Login app falhou: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload?.token) {
    throw new Error('Login app não retornou token.');
  }

  return payload.token;
}

function extractAppDeltaText(eventPayload) {
  if (eventPayload?.text != null && eventPayload.text !== '') {
    return String(eventPayload.text);
  }

  if (
    eventPayload?.event === 'message.delta' ||
    eventPayload?.type === 'message.delta' ||
    eventPayload?.event === 'on_message_delta'
  ) {
    return extractText(eventPayload.data?.delta?.content ?? eventPayload.delta?.content);
  }

  return '';
}

function extractAppReasoningText(eventPayload) {
  if (
    eventPayload?.event === 'reasoning.delta' ||
    eventPayload?.type === 'reasoning.delta' ||
    eventPayload?.event === 'on_reasoning_delta'
  ) {
    return extractText(eventPayload.data?.delta?.content ?? eventPayload.delta?.content);
  }

  return '';
}

async function streamAppCompletion({ baseUrl, token, requestBody, timeoutMs }) {
  const base = String(baseUrl).replace(/\/+$/, '');
  const startedAt = Date.now();

  const chatResponse = await fetch(`${base}/api/agents/chat/KYNS`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify(requestBody),
  });

  if (!chatResponse.ok) {
    const errorBody = await chatResponse.text().catch(() => '');
    return {
      content: '',
      reasoning: '',
      error: `chat_post_http_${chatResponse.status}:${errorBody.slice(0, 300)}`,
      finishReason: 'error',
      firstChunkMs: null,
      firstVisibleTokenMs: null,
      rawEvents: [],
      totalMs: Date.now() - startedAt,
    };
  }

  const chatText = await chatResponse.text().catch(() => '');
  let chatPayload;
  try {
    chatPayload = JSON.parse(chatText);
  } catch {
    return {
      content: '',
      reasoning: '',
      error: `chat_post_non_json:${chatText.slice(0, 300)}`,
      finishReason: 'error',
      firstChunkMs: null,
      firstVisibleTokenMs: null,
      rawEvents: [],
      totalMs: Date.now() - startedAt,
    };
  }

  if (chatPayload?.blocked) {
    const text = chatPayload.responseMessage?.text ?? BLOCKED_TEXT;
    return {
      content: text,
      reasoning: '',
      finishReason: 'blocked',
      firstChunkMs: 0,
      firstVisibleTokenMs: 0,
      rawEvents: [chatPayload],
      totalMs: Date.now() - startedAt,
    };
  }

  if (!chatPayload?.streamId) {
    return {
      content: '',
      reasoning: '',
      error: `missing_stream_id:${JSON.stringify(chatPayload).slice(0, 300)}`,
      finishReason: 'error',
      firstChunkMs: null,
      firstVisibleTokenMs: null,
      rawEvents: [chatPayload],
      totalMs: Date.now() - startedAt,
    };
  }

  const controller = new AbortController();
  let timeoutId;
  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  try {
    timeoutId = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
    const streamResponse = await fetch(`${base}/api/agents/chat/stream/${chatPayload.streamId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!streamResponse.ok || !streamResponse.body) {
      const errorBody = await streamResponse.text().catch(() => '');
      throw new Error(`stream_http_${streamResponse.status}:${errorBody.slice(0, 300)}`);
    }

    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    const rawEvents = [];
    let buffer = '';
    let content = '';
    let reasoning = '';
    let finishReason = 'stream_end';
    let firstChunkMs = null;
    let firstVisibleTokenMs = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) {
          continue;
        }

        const data = line.slice(5).trim();
        if (!data) {
          continue;
        }

        let eventPayload;
        try {
          eventPayload = JSON.parse(data);
        } catch {
          continue;
        }

        if (rawEvents.length < 40) {
          rawEvents.push(eventPayload);
        }

        const reasoningDelta = extractAppReasoningText(eventPayload);
        const visibleDelta = extractAppDeltaText(eventPayload);

        if ((reasoningDelta || visibleDelta) && firstChunkMs == null) {
          firstChunkMs = Date.now() - startedAt;
        }
        if (visibleDelta && firstVisibleTokenMs == null) {
          firstVisibleTokenMs = Date.now() - startedAt;
        }

        if (reasoningDelta) {
          reasoning += reasoningDelta;
        }
        if (visibleDelta) {
          content += visibleDelta;
        }

        if (Array.isArray(eventPayload.content)) {
          const aggregatedText = extractText(eventPayload.content);
          if (aggregatedText) {
            content = aggregatedText;
          }
        }

        if (eventPayload.final === true) {
          const responseMessage = eventPayload.responseMessage;
          const finalText =
            typeof responseMessage?.text === 'string' && responseMessage.text.length > 0
              ? responseMessage.text
              : extractText(responseMessage?.content);
          if (finalText) {
            content = finalText;
          }
          finishReason =
            responseMessage?.finish_reason ?? responseMessage?.finishReason ?? finishReason ?? 'stop';
          cleanup();
          return {
            content,
            reasoning,
            finishReason,
            firstChunkMs,
            firstVisibleTokenMs,
            rawEvents,
            totalMs: Date.now() - startedAt,
          };
        }
      }
    }

    cleanup();
    return {
      content,
      reasoning,
      finishReason,
      firstChunkMs,
      firstVisibleTokenMs,
      rawEvents,
      totalMs: Date.now() - startedAt,
    };
  } catch (error) {
    cleanup();
    const timeout = error?.name === 'AbortError' || /timeout/i.test(error?.message ?? '');
    return {
      content: '',
      reasoning: '',
      error: timeout ? 'timeout' : error?.message ?? 'unknown_error',
      finishReason: timeout ? 'timeout' : 'error',
      firstChunkMs: null,
      firstVisibleTokenMs: null,
      rawEvents: [],
      totalMs: Date.now() - startedAt,
    };
  }
}

function evaluateCaseRun(testCase, response, variant) {
  const failures = [];
  const text = String(response.content || '').trim();
  const normalizedText = normalizeText(text);
  const normalizedExactText = normalizeExactText(text);
  const lineCount = countNonEmptyLines(text);
  const sentenceCount = countSentences(text);
  const looping = detectLooping(text);
  const visibleMetaLeak = matchesAnyPattern(text, VISIBLE_META_PATTERNS);
  const fillerOpening = matchesAnyPattern(text, FILLER_OPENING_PATTERNS);
  const blockedFalsePositive = normalizedText.includes(normalizeText(BLOCKED_TEXT));
  const loopInterrupted = normalizedText.includes(normalizeText(LOOP_INTERRUPTED_TEXT));
  const hiddenReasoningStreamed =
    String(response.reasoning || '').trim().length > 0 &&
    variant.specs[testCase.spec]?.requestParams?.chat_template_kwargs?.enable_thinking === false;

  if (response.error) {
    failures.push(`transport:${response.error}`);
  }
  if (!text) {
    failures.push('empty');
  }
  if (looping) {
    failures.push('looping');
  }
  if (loopInterrupted) {
    failures.push('loop_interrupted');
  }
  if (visibleMetaLeak) {
    failures.push('visible_meta_leak');
  }
  if (hiddenReasoningStreamed) {
    failures.push('reasoning_streamed_despite_disabled');
  }
  if (fillerOpening) {
    failures.push('filler_opening');
  }
  if (blockedFalsePositive) {
    failures.push('blocked_false_positive');
  }
  if (response.finishReason === 'length') {
    failures.push('truncated');
  }

  if (testCase.acceptedOutputs?.length) {
    const accepted = testCase.acceptedOutputs.map((item) => normalizeExactText(item));
    if (!accepted.includes(normalizedExactText)) {
      failures.push(`exact_mismatch:${text || '<empty>'}`);
    }
  }
  if (testCase.minChars != null && text.length < testCase.minChars) {
    failures.push(`too_short:${text.length}<${testCase.minChars}`);
  }
  if (testCase.maxChars != null && text.length > testCase.maxChars) {
    failures.push(`too_long:${text.length}>${testCase.maxChars}`);
  }
  if (testCase.minLines != null && lineCount < testCase.minLines) {
    failures.push(`too_few_lines:${lineCount}<${testCase.minLines}`);
  }
  if (testCase.maxLines != null && lineCount > testCase.maxLines) {
    failures.push(`too_many_lines:${lineCount}>${testCase.maxLines}`);
  }
  if (testCase.minSentences != null && sentenceCount < testCase.minSentences) {
    failures.push(`too_few_sentences:${sentenceCount}<${testCase.minSentences}`);
  }
  if (testCase.maxSentences != null && sentenceCount > testCase.maxSentences) {
    failures.push(`too_many_sentences:${sentenceCount}>${testCase.maxSentences}`);
  }
  if (testCase.mustIncludeAll?.length && !includesAll(text, testCase.mustIncludeAll)) {
    failures.push(`missing_all:${testCase.mustIncludeAll.join('|')}`);
  }
  if (testCase.mustIncludeAny?.length && !includesAny(text, testCase.mustIncludeAny)) {
    failures.push(`missing_any:${testCase.mustIncludeAny.join('|')}`);
  }
  if (testCase.mustIncludeGroups?.length && !includesGroups(text, testCase.mustIncludeGroups)) {
    failures.push(
      `missing_groups:${testCase.mustIncludeGroups.map((group) => group.join('|')).join(' / ')}`,
    );
  }
  if (testCase.forbidPatterns?.length && matchesAnyPattern(text, testCase.forbidPatterns)) {
    failures.push('case_specific_forbidden_pattern');
  }

  return {
    blockedFalsePositive,
    failures,
    fillerOpening,
    hiddenReasoningStreamed,
    lineCount,
    looping,
    loopInterrupted,
    pass: failures.length === 0,
    sentenceCount,
    textLength: text.length,
    visibleMetaLeak,
  };
}

function summarizeRuns(results) {
  const summary = {
    overall: {
      passRuns: 0,
      totalRuns: results.length,
      emptyRuns: 0,
      loopingRuns: 0,
      metaLeakRuns: 0,
      blockedFalsePositiveRuns: 0,
      truncatedRuns: 0,
      hiddenReasoningRuns: 0,
    },
    variants: {},
  };

  for (const result of results) {
    const variantId = result.variant.id;
    const spec = result.case.spec;
    const variantSummary =
      summary.variants[variantId] ??
      (summary.variants[variantId] = {
        label: result.variant.label,
        passRuns: 0,
        totalRuns: 0,
        emptyRuns: 0,
        loopingRuns: 0,
        metaLeakRuns: 0,
        blockedFalsePositiveRuns: 0,
        truncatedRuns: 0,
        hiddenReasoningRuns: 0,
        specs: {},
      });

    const specSummary =
      variantSummary.specs[spec] ??
      (variantSummary.specs[spec] = {
        passRuns: 0,
        totalRuns: 0,
        emptyRuns: 0,
        loopingRuns: 0,
        metaLeakRuns: 0,
        blockedFalsePositiveRuns: 0,
        truncatedRuns: 0,
        hiddenReasoningRuns: 0,
        totalLatencyMs: 0,
        totalVisibleTokenMs: 0,
        visibleTokenSamples: 0,
      });

    summary.overall.totalRuns += 0;
    variantSummary.totalRuns += 1;
    specSummary.totalRuns += 1;
    specSummary.totalLatencyMs += result.response.totalMs;

    if (result.response.firstVisibleTokenMs != null) {
      specSummary.totalVisibleTokenMs += result.response.firstVisibleTokenMs;
      specSummary.visibleTokenSamples += 1;
    }
    if (result.evaluation.pass) {
      summary.overall.passRuns += 1;
      variantSummary.passRuns += 1;
      specSummary.passRuns += 1;
    }
    if (result.evaluation.failures.includes('empty')) {
      summary.overall.emptyRuns += 1;
      variantSummary.emptyRuns += 1;
      specSummary.emptyRuns += 1;
    }
    if (result.evaluation.looping || result.evaluation.loopInterrupted) {
      summary.overall.loopingRuns += 1;
      variantSummary.loopingRuns += 1;
      specSummary.loopingRuns += 1;
    }
    if (result.evaluation.visibleMetaLeak) {
      summary.overall.metaLeakRuns += 1;
      variantSummary.metaLeakRuns += 1;
      specSummary.metaLeakRuns += 1;
    }
    if (result.evaluation.blockedFalsePositive) {
      summary.overall.blockedFalsePositiveRuns += 1;
      variantSummary.blockedFalsePositiveRuns += 1;
      specSummary.blockedFalsePositiveRuns += 1;
    }
    if (result.response.finishReason === 'length') {
      summary.overall.truncatedRuns += 1;
      variantSummary.truncatedRuns += 1;
      specSummary.truncatedRuns += 1;
    }
    if (result.evaluation.hiddenReasoningStreamed) {
      summary.overall.hiddenReasoningRuns += 1;
      variantSummary.hiddenReasoningRuns += 1;
      specSummary.hiddenReasoningRuns += 1;
    }
  }

  for (const variantSummary of Object.values(summary.variants)) {
    variantSummary.passRate =
      variantSummary.totalRuns > 0 ? variantSummary.passRuns / variantSummary.totalRuns : 0;
    for (const specSummary of Object.values(variantSummary.specs)) {
      specSummary.passRate = specSummary.totalRuns > 0 ? specSummary.passRuns / specSummary.totalRuns : 0;
      specSummary.avgLatencyMs =
        specSummary.totalRuns > 0 ? Math.round(specSummary.totalLatencyMs / specSummary.totalRuns) : 0;
      specSummary.avgVisibleTokenMs =
        specSummary.visibleTokenSamples > 0
          ? Math.round(specSummary.totalVisibleTokenMs / specSummary.visibleTokenSamples)
          : null;
    }
  }

  summary.overall.passRate =
    summary.overall.totalRuns > 0 ? summary.overall.passRuns / summary.overall.totalRuns : 0;

  return summary;
}

function evaluateGate(results, summary) {
  const exactResults = results.filter((result) => result.case.category === 'exact');
  const exactFailures = exactResults.filter((result) => !result.evaluation.pass);
  const failingCases = results
    .filter((result) => !result.evaluation.pass)
    .map((result) => ({
      caseId: result.case.id,
      variant: result.variant.id,
      run: result.runIndex,
      failures: result.evaluation.failures,
      preview: String(result.response.content || '').slice(0, 180).replace(/\s+/g, ' '),
    }));

  const pass =
    exactFailures.length === 0 &&
    summary.overall.emptyRuns === 0 &&
    summary.overall.loopingRuns === 0 &&
    summary.overall.metaLeakRuns === 0 &&
    summary.overall.blockedFalsePositiveRuns === 0 &&
    summary.overall.hiddenReasoningRuns === 0 &&
    summary.overall.passRate >= 0.9;

  return {
    exactFailures,
    failingCases,
    pass,
  };
}

function writeResults(outputPath, payload) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
}

async function warmupTarget({ appToken, mode, requestUrl, appBaseUrl, apiKey, selectedSpecs, variant }) {
  for (const spec of selectedSpecs) {
    const specConfig = variant.specs[spec];
    const systemPrompt = prependKynsMasterPrompt(specConfig.promptPrefix);
    process.stdout.write(`Warm-up ${variant.id}/${spec}... `);

    const response =
      mode === 'proxy'
        ? await streamCompletion({
            apiKey,
            requestBody: {
              ...specConfig.requestParams,
              messages: [
                {
                  role: 'system',
                  content: systemPrompt,
                },
                {
                  role: 'user',
                  content: 'Responda apenas com "ok".',
                },
              ],
            },
            timeoutMs: 45_000,
            url: requestUrl,
          })
        : await streamAppCompletion({
            baseUrl: appBaseUrl,
            token: appToken,
            requestBody: {
              text: 'Responda apenas com "ok".',
              endpoint: 'KYNS',
              endpointType: 'openAI',
              spec,
              model: specConfig.requestParams.model,
              modelLabel: spec === 'kyns-deep' ? 'KYNS Deep' : 'KYNS',
              conversationId: 'new',
              messageId: crypto.randomUUID(),
              responseMessageId: crypto.randomUUID(),
              parentMessageId: ZERO_UUID,
              isContinued: false,
              isRegenerate: false,
            },
            timeoutMs: 45_000,
          });

    console.log(!response.error ? 'ok' : `falhou (${response.error})`);
    await sleep(350);
  }
}

async function executeTargetCase({ appToken, appBaseUrl, mode, requestUrl, apiKey, specConfig, testCase }) {
  const systemPrompt = specConfig.systemPrompt ?? prependKynsMasterPrompt(specConfig.promptPrefix);

  if (mode === 'proxy') {
    return streamCompletion({
      apiKey,
      requestBody: {
        ...specConfig.requestParams,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: testCase.prompt },
        ],
      },
      timeoutMs: DEFAULT_TIMEOUTS_MS[testCase.spec] ?? 120_000,
      url: requestUrl,
    });
  }

  return streamAppCompletion({
    baseUrl: appBaseUrl,
    token: appToken,
    requestBody: {
      text: testCase.prompt,
      endpoint: 'KYNS',
      endpointType: 'openAI',
      spec: testCase.spec,
      model: specConfig.requestParams.model,
      modelLabel: testCase.spec === 'kyns-deep' ? 'KYNS Deep' : 'KYNS',
      conversationId: 'new',
      messageId: crypto.randomUUID(),
      responseMessageId: crypto.randomUUID(),
      parentMessageId: ZERO_UUID,
      isContinued: false,
      isRegenerate: false,
    },
    timeoutMs: DEFAULT_TIMEOUTS_MS[testCase.spec] ?? 120_000,
  });
}

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const mode = resolveMode(options);
  ensureTargetConfig(mode, options);

  const selectedCases = filterCases(options);
  if (selectedCases.length === 0) {
    throw new Error('Nenhum caso selecionado para avaliação.');
  }

  const config = loadConfig();
  const variants =
    mode === 'app'
      ? buildVariants(config, { ...options, compareDeepThinking: false })
      : buildVariants(config, options);
  const requestUrl =
    mode === 'proxy' ? normalizeOpenAIBaseUrl(options.proxyBaseUrl) : String(options.appBaseUrl).replace(/\/+$/, '');
  const selectedSpecs = [...new Set(selectedCases.map((testCase) => testCase.spec))];
  const appToken =
    mode === 'app'
      ? await loginApp({
          baseUrl: options.appBaseUrl,
          email: options.appEmail,
          password: options.appPassword,
        })
      : null;

  console.log('=== KYNS Eval Live ===');
  console.log(`Modo: ${mode}`);
  console.log(`Casos: ${selectedCases.length}`);
  console.log(`Specs: ${selectedSpecs.join(', ')}`);
  console.log(`Variantes: ${variants.map((variant) => variant.id).join(', ')}`);
  console.log(`Saída: ${path.relative(ROOT, options.outputPath)}`);
  if (mode === 'app' && options.compareDeepThinking) {
    console.log('Aviso: modo app ignora --compare-deep-thinking.');
  }
  console.log('');

  if (!options.skipWarmup) {
    for (const variant of variants) {
      await warmupTarget({
        appBaseUrl: options.appBaseUrl,
        appToken,
        apiKey: options.proxyApiKey,
        mode,
        requestUrl,
        selectedSpecs,
        variant,
      });
    }
    console.log('');
  }

  const results = [];
  let currentIndex = 0;
  const totalRuns = selectedCases.reduce((sum, testCase) => {
    const repeats = options.repeatsOverride ?? testCase.repeats ?? 1;
    return sum + repeats * variants.length;
  }, 0);

  for (const variant of variants) {
    for (const testCase of selectedCases) {
      const repeats = options.repeatsOverride ?? testCase.repeats ?? 1;
      const specConfig = variant.specs[testCase.spec];
      const systemPrompt = prependKynsMasterPrompt(specConfig.promptPrefix);

      for (let runIndex = 1; runIndex <= repeats; runIndex += 1) {
        currentIndex += 1;
        process.stdout.write(
          `[${currentIndex}/${totalRuns}] ${variant.id} ${testCase.id} run ${runIndex}/${repeats}... `,
        );

        const response = await executeTargetCase({
          appBaseUrl: options.appBaseUrl,
          appToken,
          apiKey: options.proxyApiKey,
          mode,
          requestUrl,
          specConfig: {
            ...specConfig,
            promptPrefix: specConfig.promptPrefix,
            systemPrompt,
          },
          testCase,
        });

        const evaluation = evaluateCaseRun(testCase, response, variant);
        const status = evaluation.pass ? 'PASS' : 'FAIL';
        const preview = String(response.content || '')
          .slice(0, 90)
          .replace(/\s+/g, ' ')
          .trim();

        console.log(
          `${status} | ${formatDuration(response.totalMs)} | finish:${response.finishReason} | len:${evaluation.textLength} | ${
            evaluation.pass ? preview || '<vazio>' : evaluation.failures.join(', ')
          }`,
        );

        results.push({
          case: testCase,
          evaluation,
          response: {
            ...response,
            contentPreview: preview,
          },
          runIndex,
          variant: {
            id: variant.id,
            label: variant.label,
          },
        });

        await sleep(300);
      }
    }
  }

  const summary = summarizeRuns(results);
  const gate = evaluateGate(results, summary);
  const payload = {
    generatedAt: new Date().toISOString(),
    options: {
      caseId: options.caseId,
      compareDeepThinking: options.compareDeepThinking,
      mode,
      repeatsOverride: options.repeatsOverride,
      spec: options.spec,
      skipWarmup: options.skipWarmup,
    },
    requestUrl,
    summary,
    gate,
    results,
  };

  writeResults(options.outputPath, payload);

  console.log('\n=== RESUMO ===');
  console.log(
    `Geral: ${(summary.overall.passRate * 100).toFixed(1)}% | empty:${summary.overall.emptyRuns} | loop:${summary.overall.loopingRuns} | meta:${summary.overall.metaLeakRuns} | false-positive:${summary.overall.blockedFalsePositiveRuns}`,
  );

  for (const [variantId, variantSummary] of Object.entries(summary.variants)) {
    console.log(`\nVariante ${variantId}: ${(variantSummary.passRate * 100).toFixed(1)}%`);
    for (const [spec, specSummary] of Object.entries(variantSummary.specs)) {
      console.log(
        `  ${spec}: ${(specSummary.passRate * 100).toFixed(1)}% | avg:${formatDuration(
          specSummary.avgLatencyMs,
        )} | ttft:${
          specSummary.avgVisibleTokenMs == null ? '?' : formatDuration(specSummary.avgVisibleTokenMs)
        } | empty:${specSummary.emptyRuns} | loop:${specSummary.loopingRuns} | meta:${specSummary.metaLeakRuns}`,
      );
    }
  }

  if (!gate.pass) {
    console.log('\nFalhas principais:');
    gate.failingCases.slice(0, 15).forEach((item) => {
      console.log(
        `- ${item.variant} / ${item.caseId} / run ${item.run}: ${item.failures.join(', ')}${
          item.preview ? ` | ${item.preview}` : ''
        }`,
      );
    });
  }

  console.log(`\nRelatório salvo em ${path.relative(ROOT, options.outputPath)}`);

  if (!gate.pass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('KYNS eval failed:', error);
  process.exit(1);
});
