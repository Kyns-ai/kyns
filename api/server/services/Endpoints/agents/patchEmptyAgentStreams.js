const { logger } = require('@librechat/data-schemas');
const { StandardGraph, MultiAgentGraph } = require('@librechat/agents');

const PATCH_FLAG = Symbol.for('librechat.patchEmptyAgentStreams');

function sanitizeToolCalls(message) {
  if (!message || !Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
    return message;
  }

  message.tool_calls = message.tool_calls.filter((toolCall) => !!toolCall?.name);
  return message;
}

function hasVisibleMessageContent(message) {
  if (!message || typeof message !== 'object') {
    return false;
  }
  const content = message.content;
  if (typeof content === 'string' && content.trim().length > 0) {
    return true;
  }
  if (Array.isArray(content)) {
    for (const part of content) {
      const t = part?.text ?? part?.value;
      if (typeof t === 'string' && t.trim().length > 0) {
        return true;
      }
    }
  }
  return false;
}

function patchGraphPrototype(GraphClass, graphName) {
  const proto = GraphClass?.prototype;
  if (!proto || typeof proto.attemptInvoke !== 'function' || proto[PATCH_FLAG] === true) {
    return;
  }

  const originalAttemptInvoke = proto.attemptInvoke;

  proto.attemptInvoke = async function attemptInvokeWithEmptyStreamFallback(args, config) {
    const result = await originalAttemptInvoke.call(this, args, config);
    if (!Array.isArray(result?.messages)) {
      return result;
    }

    const validMessages = result.messages.filter(Boolean);
    if (validMessages.length === result.messages.length) {
      return result;
    }

    const model = this.overrideModel ?? args?.currentModel;
    const provider = args?.provider ?? 'unknown';
    const finalMessages = Array.isArray(args?.finalMessages) ? args.finalMessages : [];

    if (validMessages.length > 0) {
      logger.warn('[AgentGraph] Dropping nullish streamed messages before reducer', {
        graph: graphName,
        provider,
        originalCount: result.messages.length,
        validCount: validMessages.length,
      });
      return { ...result, messages: validMessages.map(sanitizeToolCalls) };
    }

    if (!model || typeof model.invoke !== 'function') {
      throw new Error(
        `Empty streamed response in ${graphName} for provider "${provider}" without invoke fallback`,
      );
    }

    logger.warn('[AgentGraph] Empty streamed response detected, retrying with invoke fallback', {
      graph: graphName,
      provider,
      promptMessageCount: finalMessages.length,
    });

    let fallbackMessage = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        fallbackMessage = await model.invoke(finalMessages, config);
      } catch (invokeErr) {
        logger.warn('[AgentGraph] Invoke fallback threw, attempt will be retried if possible', {
          graph: graphName,
          provider,
          attempt,
          error: invokeErr?.message,
        });
        fallbackMessage = null;
      }
      if (fallbackMessage && hasVisibleMessageContent(fallbackMessage)) {
        break;
      }
      logger.warn('[AgentGraph] Invoke fallback returned no visible content', {
        graph: graphName,
        provider,
        attempt,
      });
    }

    if (!fallbackMessage || !hasVisibleMessageContent(fallbackMessage)) {
      throw new Error(
        `Empty streamed response in ${graphName} for provider "${provider}" and invoke fallback returned no visible content`,
      );
    }

    return {
      ...result,
      messages: [sanitizeToolCalls(fallbackMessage)],
    };
  };

  Object.defineProperty(proto, PATCH_FLAG, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });
}

function patchEmptyAgentStreams() {
  patchGraphPrototype(StandardGraph, 'StandardGraph');
  patchGraphPrototype(MultiAgentGraph, 'MultiAgentGraph');
}

module.exports = patchEmptyAgentStreams;
