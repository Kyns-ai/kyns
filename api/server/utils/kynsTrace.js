const { randomUUID } = require('crypto');
const { logger } = require('@librechat/data-schemas');

const TRACE_PREFIX = '[KYNS_TRACE]';
const MAX_PREVIEW_LENGTH = 160;
const MAX_ROLE_SAMPLE = 8;

function isKynsTraceEnabled() {
  const value = process.env.KYNS_TRACE;
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function truncateText(value, maxLength = MAX_PREVIEW_LENGTH) {
  if (typeof value !== 'string') {
    return value;
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}

function summarizeText(text) {
  if (typeof text !== 'string') {
    return { chars: 0, preview: '' };
  }
  return {
    chars: text.length,
    preview: truncateText(text.replace(/\s+/g, ' ').trim()),
  };
}

function summarizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return { count: 0, roles: [], textChars: 0 };
  }

  let textChars = 0;
  const roles = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i] ?? {};
    if (roles.length < MAX_ROLE_SAMPLE) {
      roles.push(message.role ?? message.constructor?.name ?? typeof message);
    }

    if (typeof message.content === 'string') {
      textChars += message.content.length;
      continue;
    }

    if (!Array.isArray(message.content)) {
      continue;
    }

    for (let j = 0; j < message.content.length; j++) {
      const part = message.content[j];
      if (typeof part?.text === 'string') {
        textChars += part.text.length;
      } else if (typeof part?.text?.value === 'string') {
        textChars += part.text.value.length;
      }
    }
  }

  return {
    count: messages.length,
    roles,
    textChars,
  };
}

function summarizeContentParts(contentParts) {
  if (!Array.isArray(contentParts)) {
    return { count: 0, types: [], textChars: 0 };
  }

  const typeCounts = {};
  let textChars = 0;

  for (let i = 0; i < contentParts.length; i++) {
    const part = contentParts[i] ?? {};
    const type = part.type ?? 'unknown';
    typeCounts[type] = (typeCounts[type] ?? 0) + 1;

    if (typeof part.text === 'string') {
      textChars += part.text.length;
    } else if (typeof part?.error === 'string') {
      textChars += part.error.length;
    }
  }

  return {
    count: contentParts.length,
    types: Object.entries(typeCounts).map(([type, count]) => `${type}:${count}`),
    textChars,
  };
}

function summarizeEndpointOption(endpointOption) {
  if (!endpointOption || typeof endpointOption !== 'object') {
    return {};
  }

  const modelParameters = endpointOption.model_parameters ?? {};
  const modelOptions = endpointOption.modelOptions ?? {};
  const chatTemplateKwargs =
    modelParameters.chat_template_kwargs ?? modelOptions.chat_template_kwargs ?? {};

  return {
    endpoint: endpointOption.endpoint,
    endpointType: endpointOption.endpointType,
    spec: endpointOption.spec,
    model: modelParameters.model ?? modelOptions.model,
    reasoning_effort: modelParameters.reasoning_effort ?? modelOptions.reasoning_effort,
    temperature: modelParameters.temperature ?? modelOptions.temperature,
    max_tokens: modelParameters.max_tokens ?? modelOptions.max_tokens,
    repetition_penalty:
      modelParameters.repetition_penalty ?? modelOptions.repetition_penalty,
    frequency_penalty:
      modelParameters.frequency_penalty ?? modelOptions.frequency_penalty,
    enable_thinking: chatTemplateKwargs.enable_thinking,
  };
}

function summarizeParsedBody(parsedBody) {
  if (!parsedBody || typeof parsedBody !== 'object') {
    return {};
  }

  return {
    endpoint: parsedBody.endpoint,
    endpointType: parsedBody.endpointType,
    spec: parsedBody.spec,
    model: parsedBody.model,
    reasoning_effort: parsedBody.reasoning_effort,
    temperature: parsedBody.temperature,
    max_tokens: parsedBody.max_tokens,
    repetition_penalty: parsedBody.repetition_penalty,
    frequency_penalty: parsedBody.frequency_penalty,
    top_p: parsedBody.top_p,
    top_k: parsedBody.top_k,
    enable_thinking: parsedBody.chat_template_kwargs?.enable_thinking,
  };
}

function summarizeError(error) {
  if (!error) {
    return {};
  }

  return {
    name: error.name,
    message: error.message,
    stack: truncateText(
      typeof error.stack === 'string' ? error.stack.split('\n').slice(0, 4).join('\n') : '',
      300,
    ),
  };
}

function ensureKynsTrace(req, metadata = {}) {
  if (!isKynsTraceEnabled() || !req) {
    return null;
  }

  if (!req._kynsTrace) {
    req._kynsTrace = {
      id: req.body?.responseMessageId ?? req.body?.messageId ?? randomUUID(),
      startedAt: Date.now(),
      metadata: {},
      counters: {},
    };
  }

  if (metadata && typeof metadata === 'object') {
    Object.assign(req._kynsTrace.metadata, metadata);
  }

  return req._kynsTrace;
}

function getKynsTrace(source) {
  if (!source) {
    return null;
  }
  if (source._kynsTrace) {
    return source._kynsTrace;
  }
  if (source.id && source.startedAt && source.metadata && source.counters) {
    return source;
  }
  return null;
}

function incrementKynsTraceCounter(source, counterName, amount = 1) {
  const trace = getKynsTrace(source);
  if (!trace || !counterName) {
    return 0;
  }

  trace.counters[counterName] = (trace.counters[counterName] ?? 0) + amount;
  return trace.counters[counterName];
}

function logKynsTrace(source, stage, payload = {}) {
  if (!isKynsTraceEnabled()) {
    return;
  }

  const trace = getKynsTrace(source);
  if (!trace) {
    return;
  }

  logger.info(TRACE_PREFIX, {
    traceId: trace.id,
    stage,
    elapsedMs: Date.now() - trace.startedAt,
    ...trace.metadata,
    ...payload,
  });
}

function snapshotKynsTrace(source) {
  const trace = getKynsTrace(source);
  if (!trace) {
    return null;
  }

  return {
    traceId: trace.id,
    elapsedMs: Date.now() - trace.startedAt,
    ...trace.metadata,
    counters: { ...trace.counters },
  };
}

module.exports = {
  isKynsTraceEnabled,
  summarizeText,
  summarizeError,
  truncateText,
  ensureKynsTrace,
  logKynsTrace,
  getKynsTrace,
  snapshotKynsTrace,
  summarizeMessages,
  summarizeParsedBody,
  incrementKynsTraceCounter,
  summarizeContentParts,
  summarizeEndpointOption,
};
