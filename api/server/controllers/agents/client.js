require('events').EventEmitter.defaultMaxListeners = 100;
const jwt = require('jsonwebtoken');
const { logger } = require('@librechat/data-schemas');
const { getBufferString, HumanMessage } = require('@langchain/core/messages');
const {
  createRun,
  Tokenizer,
  checkAccess,
  buildToolSet,
  sanitizeTitle,
  logToolError,
  payloadParser,
  resolveHeaders,
  createSafeUser,
  initializeAgent,
  getBalanceConfig,
  omitTitleOptions,
  getProviderConfig,
  loadWebSearchAuth,
  isWebSearchSufficientlyAuthenticated,
  memoryInstructions,
  createTokenCounter,
  applyContextToAgent,
  recordCollectedUsage,
  GenerationJobManager,
  getTransactionsConfig,
  createMemoryProcessor,
  createMultiAgentMapper,
  filterMalformedContentParts,
} = require('@librechat/api');
const {
  Callback,
  Providers,
  TitleMethod,
  createSearchTool,
  formatMessage,
  formatAgentMessages,
  createMetadataAggregator,
} = require('@librechat/agents');
const {
  Constants,
  Permissions,
  Tools,
  VisionModes,
  ContentTypes,
  EModelEndpoint,
  PermissionTypes,
  isAgentsEndpoint,
  isEphemeralAgentId,
  removeNullishValues,
} = require('librechat-data-provider');
const { spendTokens, spendStructuredTokens } = require('~/models/spendTokens');
const { encodeAndFormat } = require('~/server/services/Files/images/encode');
const { updateBalance, bulkInsertTransactions } = require('~/models');
const { getMultiplier, getCacheMultiplier } = require('~/models/tx');
const { createContextHandlers } = require('~/app/clients/prompts');
const { getConvoFiles } = require('~/models/Conversation');
const BaseClient = require('~/app/clients/BaseClient');
const { getRoleByName } = require('~/models/Role');
const { loadAgent } = require('~/models/Agent');
const { getMCPManager } = require('~/config');
const { loadAuthValues } = require('~/server/services/Tools/credentials');
const { prependKynsMasterPrompt, KynsResponseFilteredError } = require('~/server/services/safety/kynsPlatform');
const {
  ensureKynsTrace,
  logKynsTrace,
  summarizeText,
  summarizeError,
  snapshotKynsTrace,
  summarizeMessages,
  summarizeContentParts,
} = require('~/server/utils/kynsTrace');
const db = require('~/models');

const DEFAULT_AGENT_RECURSION_LIMIT = 16;
const MEMORY_CONTEXT_TIMEOUT_MS = 8000;
const SLOW_STAGE_THRESHOLD_MS = 200;
const MANUAL_WEB_SEARCH_TOOL_ID = 'manual-web-search';

/**
 * @param {BaseMessage} message
 * @returns {string}
 */
function extractTextFromGraphMessage(message) {
  if (!message || typeof message !== 'object') {
    return '';
  }
  const content = message.content;
  if (typeof content === 'string') {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return '';
  }
  const parts = [];
  for (const part of content) {
    const t = part?.text ?? part?.value;
    if (typeof t === 'string' && t.trim()) {
      parts.push(t.trim());
    }
  }
  return parts.join('\n');
}

/**
 * @param {Object} run
 * @returns {string | null}
 */
function tryRecoverContentFromGraph(run) {
  const graph = run?.Graph;
  if (!graph) {
    return null;
  }
  try {
    const state = typeof graph.getState === 'function' ? graph.getState() : graph.state;
    if (!state) {
      return null;
    }
    const messages = state?.values?.messages ?? state?.messages ?? state?.channelValues?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return null;
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const role = msg?.role ?? msg?._getType?.() ?? '';
      if (role === 'ai' || role === 'assistant') {
        const text = extractTextFromGraphMessage(msg);
        if (text.length > 0) {
          return text;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function sanitizePayload(payload) {
  if (!Array.isArray(payload)) {
    return [];
  }
  const result = [];
  for (const rawMsg of payload) {
    if (rawMsg == null || typeof rawMsg !== 'object') {
      continue;
    }
    const msg = {
      ...rawMsg,
    };
    if (Array.isArray(msg.content)) {
      msg.content = msg.content.filter((part) => part != null && typeof part === 'object');
    }
    if (!msg.role) {
      const inferred =
        msg.sender?.toLowerCase() === 'user'
          ? 'user'
          : msg.isCreatedByUser
            ? 'user'
            : msg.lc_id?.[2] === 'SystemMessage'
              ? 'system'
              : 'assistant';
      msg.role = inferred;
    }
    result.push(msg);
  }
  return result;
}

function describeLangChainMessage(message) {
  if (message == null) {
    return { value: message };
  }
  if (typeof message !== 'object') {
    return { valueType: typeof message };
  }
  return {
    constructor: message.constructor?.name,
    hasGetType: typeof message._getType === 'function',
    role: typeof message.role === 'string' ? message.role : undefined,
    contentType: Array.isArray(message.content) ? 'array' : typeof message.content,
    keys: Object.keys(message).slice(0, 6),
  };
}

function normalizeToolContent(result) {
  if (result == null) {
    return '';
  }
  if (typeof result === 'string') {
    return result;
  }
  if (Array.isArray(result)) {
    return result;
  }
  if (typeof result === 'object') {
    try {
      return JSON.stringify(result);
    } catch {
      return String(result);
    }
  }
  return String(result);
}

function normalizeToolResult(result) {
  if (
    Array.isArray(result) &&
    result.length === 2 &&
    result[1] != null &&
    typeof result[1] === 'object' &&
    !Array.isArray(result[1])
  ) {
    return {
      content: result[0] ?? '',
      artifact: result[1],
    };
  }

  if (result != null && typeof result === 'object' && !Array.isArray(result)) {
    if ('content' in result || 'artifact' in result) {
      return {
        content: result.content ?? '',
        artifact: result.artifact,
      };
    }
  }

  return {
    content: normalizeToolContent(result),
    artifact: undefined,
  };
}

function appendTextToMessageContent(content, text) {
  if (typeof content === 'string') {
    return content.length ? `${content}\n\n${text}` : text;
  }

  if (Array.isArray(content)) {
    return [...content, { type: ContentTypes.TEXT, text }];
  }

  return text;
}

function hasVisibleTextContentParts(contentParts) {
  if (!Array.isArray(contentParts)) {
    return false;
  }

  return contentParts.some((part) => {
    const text = typeof part?.text === 'string' ? part.text : '';
    return text.trim().length > 0;
  });
}

class AgentClient extends BaseClient {
  constructor(options = {}) {
    super(null, options);
    /** The current client class
     * @type {string} */
    this.clientName = EModelEndpoint.agents;

    /** @type {'discard' | 'summarize'} */
    this.contextStrategy = 'discard';

    /** @deprecated @type {true} - Is a Chat Completion Request */
    this.isChatCompletion = true;

    /** @type {AgentRun} */
    this.run;

    const {
      agentConfigs,
      contentParts,
      collectedUsage,
      artifactPromises,
      maxContextTokens,
      ...clientOptions
    } = options;

    this.agentConfigs = agentConfigs;
    this.maxContextTokens = maxContextTokens;
    /** @type {MessageContentComplex[]} */
    this.contentParts = contentParts;
    /** @type {Array<UsageMetadata>} */
    this.collectedUsage = collectedUsage;
    /** @type {ArtifactPromises} */
    this.artifactPromises = artifactPromises;
    /** @type {AgentClientOptions} */
    this.options = Object.assign({ endpoint: options.endpoint }, clientOptions);
    /** @type {string} */
    this.model = this.options.agent.model_parameters.model;
    /** The key for the usage object's input tokens
     * @type {string} */
    this.inputTokensKey = 'input_tokens';
    /** The key for the usage object's output tokens
     * @type {string} */
    this.outputTokensKey = 'output_tokens';
    /** @type {UsageMetadata} */
    this.usage;
    /** @type {Record<string, number>} */
    this.indexTokenCountMap = {};
    /** @type {(messages: BaseMessage[]) => Promise<void>} */
    this.processMemory;
  }

  /**
   * Returns the aggregated content parts for the current run.
   * @returns {MessageContentComplex[]} */
  getContentParts() {
    return this.contentParts;
  }

  getTrace() {
    return ensureKynsTrace(this.options.req);
  }

  setOptions(_options) {}

  /**
   * `AgentClient` is not opinionated about vision requests, so we don't do anything here
   * @param {MongoFile[]} attachments
   */
  checkVisionRequest() {}

  getSaveOptions() {
    let runOptions = {};
    try {
      runOptions = payloadParser(this.options) ?? {};
    } catch (error) {
      logger.error(
        '[api/server/controllers/agents/client.js #getSaveOptions] Error parsing options',
        error,
      );
    }

    return removeNullishValues(
      Object.assign(
        {
          spec: this.options.spec,
          iconURL: this.options.iconURL,
          endpoint: this.options.endpoint,
          agent_id: this.options.agent.id,
          modelLabel: this.options.modelLabel,
          resendFiles: this.options.resendFiles,
          imageDetail: this.options.imageDetail,
          maxContextTokens: this.maxContextTokens,
        },
        // TODO: PARSE OPTIONS BY PROVIDER, MAY CONTAIN SENSITIVE DATA
        runOptions,
      ),
    );
  }

  /**
   * Returns build message options. For AgentClient, agent-specific instructions
   * are retrieved directly from agent objects in buildMessages, so this returns empty.
   * @returns {Object} Empty options object
   */
  getBuildMessagesOptions() {
    return {};
  }

  /**
   *
   * @param {TMessage} message
   * @param {Array<MongoFile>} attachments
   * @returns {Promise<Array<Partial<MongoFile>>>}
   */
  async addImageURLs(message, attachments) {
    const { files, image_urls } = await encodeAndFormat(
      this.options.req,
      attachments,
      {
        provider: this.options.agent.provider,
        endpoint: this.options.endpoint,
      },
      VisionModes.agents,
    );
    message.image_urls = image_urls.length ? image_urls : undefined;
    return files;
  }

  async buildMessages(messages, parentMessageId, _buildOptions, opts) {
    const trace = this.getTrace();
    if (this.isKynsImageEndpoint()) {
      const orderedMessages = this.constructor.getMessagesForConversation({
        messages,
        parentMessageId,
      });

      for (let i = 0; i < orderedMessages.length; i++) {
        this.indexTokenCountMap[i] = orderedMessages[i].tokenCount ?? 0;
      }

      if (typeof opts?.getReqData === 'function') {
        opts.getReqData({ promptTokens: 0 });
      }

      return {
        prompt: [],
        promptTokens: 0,
        tokenCountMap: undefined,
        messages: orderedMessages,
      };
    }

    /** Always pass mapMethod; getMessagesForConversation applies it only to messages with addedConvo flag */
    const orderedMessages = this.constructor.getMessagesForConversation({
      messages,
      parentMessageId,
      summary: this.shouldSummarize,
      mapMethod: createMultiAgentMapper(this.options.agent, this.agentConfigs),
      mapCondition: (message) => message.addedConvo === true,
    });
    logKynsTrace(trace, 'client.buildMessages.start', {
      orderedMessages: summarizeMessages(orderedMessages),
      parentMessageId,
      attachmentCount: Array.isArray(this.options.attachments) ? this.options.attachments.length : 0,
    });

    let payload;
    /** @type {number | undefined} */
    let promptTokens;

    /**
     * Extract base instructions for all agents (combines instructions + additional_instructions).
     * This must be done before applying context to preserve the original agent configuration.
     */
    const extractBaseInstructions = (agent) => {
      const baseInstructions = [agent.instructions ?? '', agent.additional_instructions ?? '']
        .filter(Boolean)
        .join('\n')
        .trim();
      agent.instructions = prependKynsMasterPrompt(baseInstructions);
      agent.additional_instructions = '';
      return agent;
    };

    /** Collect all agents for unified processing, extracting base instructions during collection */
    const allAgents = [
      { agent: extractBaseInstructions(this.options.agent), agentId: this.options.agent.id },
      ...(this.agentConfigs?.size > 0
        ? Array.from(this.agentConfigs.entries()).map(([agentId, agent]) => ({
            agent: extractBaseInstructions(agent),
            agentId,
          }))
        : []),
    ];

    if (this.options.attachments) {
      const attachments = await this.options.attachments;
      const latestMessage = orderedMessages[orderedMessages.length - 1];

      if (this.message_file_map) {
        this.message_file_map[latestMessage.messageId] = attachments;
      } else {
        this.message_file_map = {
          [latestMessage.messageId]: attachments,
        };
      }

      await this.addFileContextToMessage(latestMessage, attachments);
      const files = await this.processAttachments(latestMessage, attachments);

      this.options.attachments = files;
    }

    /** Note: Bedrock uses legacy RAG API handling */
    if (this.message_file_map && !isAgentsEndpoint(this.options.endpoint)) {
      this.contextHandlers = createContextHandlers(
        this.options.req,
        orderedMessages[orderedMessages.length - 1].text,
      );
    }

    const formattedMessages = orderedMessages.map((message, i) => {
      const formattedMessage = formatMessage({
        message,
        userName: this.options?.name,
        assistantName: this.options?.modelLabel,
      });

      /** For non-latest messages, prepend file context directly to message content */
      if (message.fileContext && i !== orderedMessages.length - 1) {
        if (typeof formattedMessage.content === 'string') {
          formattedMessage.content = message.fileContext + '\n' + formattedMessage.content;
        } else {
          const textPart = formattedMessage.content.find((part) => part.type === 'text');
          textPart
            ? (textPart.text = message.fileContext + '\n' + textPart.text)
            : formattedMessage.content.unshift({ type: 'text', text: message.fileContext });
        }
      }

      const needsTokenCount =
        (this.contextStrategy && !orderedMessages[i].tokenCount) || message.fileContext;

      /* If tokens were never counted, or, is a Vision request and the message has files, count again */
      if (needsTokenCount || (this.isVisionModel && (message.image_urls || message.files))) {
        orderedMessages[i].tokenCount = this.getTokenCountForMessage(formattedMessage);
      }

      /* If message has files, calculate image token cost */
      if (this.message_file_map && this.message_file_map[message.messageId]) {
        const attachments = this.message_file_map[message.messageId];
        for (const file of attachments) {
          if (file.embedded) {
            this.contextHandlers?.processFile(file);
            continue;
          }
          if (file.metadata?.fileIdentifier) {
            continue;
          }
          // orderedMessages[i].tokenCount += this.calculateImageTokenCost({
          //   width: file.width,
          //   height: file.height,
          //   detail: this.options.imageDetail ?? ImageDetail.auto,
          // });
        }
      }

      return formattedMessage;
    });

    /**
     * Build shared run context - applies to ALL agents in the run.
     * This includes: file context (latest message), augmented prompt (RAG), memory context.
     */
    const sharedRunContextParts = [];
    let latestFileContextChars = 0;
    let augmentedPromptChars = 0;
    let memoryContextChars = 0;

    /** File context from the latest message (attachments) */
    const latestMessage = orderedMessages[orderedMessages.length - 1];
    if (latestMessage?.fileContext) {
      latestFileContextChars = latestMessage.fileContext.length;
      sharedRunContextParts.push(latestMessage.fileContext);
    }

    /** Augmented prompt from RAG/context handlers */
    if (this.contextHandlers) {
      const contextStart = Date.now();
      this.augmentedPrompt = await this.contextHandlers.createContext();
      this.logSlowStage('createContext', contextStart);
      if (this.augmentedPrompt) {
        augmentedPromptChars = this.augmentedPrompt.length;
        sharedRunContextParts.push(this.augmentedPrompt);
      }
    }

    /** Memory context (user preferences/memories) */
    const memoryStart = Date.now();
    const withoutKeys = await this.awaitMemoryContextWithTimeout(this.useMemory());
    this.logSlowStage('loadMemoryContext', memoryStart);
    if (withoutKeys) {
      memoryContextChars = withoutKeys.length;
      const memoryContext = `${memoryInstructions}\n\n# Existing memory about the user:\n${withoutKeys}`;
      sharedRunContextParts.push(memoryContext);
    }

    const sharedRunContext = sharedRunContextParts.join('\n\n');

    /** @type {Record<string, number> | undefined} */
    let tokenCountMap;

    if (this.contextStrategy) {
      const contextStrategyStart = Date.now();
      ({ payload, promptTokens, tokenCountMap, messages } = await this.handleContextStrategy({
        orderedMessages,
        formattedMessages,
      }));
      this.logSlowStage('handleContextStrategy', contextStrategyStart);
    }

    for (let i = 0; i < messages.length; i++) {
      this.indexTokenCountMap[i] = messages[i].tokenCount;
    }

    const result = {
      tokenCountMap,
      prompt: payload,
      promptTokens,
      messages,
    };

    if (promptTokens >= 0 && typeof opts?.getReqData === 'function') {
      opts.getReqData({ promptTokens });
    }
    logKynsTrace(trace, 'client.buildMessages.ready', {
      latestFileContextChars,
      augmentedPromptChars,
      memoryContextChars,
      sharedRunContextChars: sharedRunContext.length,
      promptTokens,
      resultMessages: summarizeMessages(messages),
    });

    /**
     * Apply context to all agents.
     * Each agent gets: shared run context + their own base instructions + their own MCP instructions.
     *
     * NOTE: This intentionally mutates agent objects in place. The agentConfigs Map
     * holds references to config objects that will be passed to the graph runtime.
     */
    const ephemeralAgent = this.options.req.body.ephemeralAgent;
    const mcpManager = getMCPManager();
    await Promise.all(
      allAgents.map(({ agent, agentId }) =>
        applyContextToAgent({
          agent,
          agentId,
          logger,
          mcpManager,
          sharedRunContext,
          ephemeralAgent: agentId === this.options.agent.id ? ephemeralAgent : undefined,
        }),
      ),
    );

    return result;
  }

  /**
   * Creates a promise that resolves with the memory promise result or undefined after a timeout
   * @param {Promise<(TAttachment | null)[] | undefined>} memoryPromise - The memory promise to await
   * @param {number} timeoutMs - Timeout in milliseconds (default: 45000)
   * @returns {Promise<(TAttachment | null)[] | undefined>}
   */
  async awaitMemoryWithTimeout(memoryPromise, timeoutMs = 45000) {
    if (!memoryPromise) {
      return;
    }

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Memory processing timeout')), timeoutMs),
      );

      const attachments = await Promise.race([memoryPromise, timeoutPromise]);
      return attachments;
    } catch (error) {
      if (error.message === 'Memory processing timeout') {
        logger.warn(`[AgentClient] Memory processing timed out after ${timeoutMs}ms`);
      } else {
        logger.error('[AgentClient] Error processing memory:', error);
      }
      return;
    }
  }

  /**
   * Keeps slow memory lookup from blocking the start of the current turn.
   * @param {Promise<string | undefined> | undefined} memoryPromise
   * @param {number} timeoutMs
   * @returns {Promise<string | undefined>}
   */
  async awaitMemoryContextWithTimeout(memoryPromise, timeoutMs = MEMORY_CONTEXT_TIMEOUT_MS) {
    if (!memoryPromise) {
      return;
    }
    const trace = this.getTrace();

    let timeoutId;
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        logger.warn(`[AgentClient] Memory context timed out after ${timeoutMs}ms`);
        logKynsTrace(trace, 'client.memoryContext.timeout', {
          timeoutMs,
        });
        resolve(undefined);
      }, timeoutMs);
    });

    const guardedPromise = Promise.resolve(memoryPromise)
      .then((value) => {
        clearTimeout(timeoutId);
        logKynsTrace(trace, 'client.memoryContext.resolved', {
          timeoutMs,
          memoryContext: summarizeText(value),
        });
        return value;
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        logger.error('[AgentClient] Error loading memory context:', error);
        logKynsTrace(trace, 'client.memoryContext.error', {
          timeoutMs,
          error: summarizeError(error),
        });
        return;
      });

    return await Promise.race([guardedPromise, timeoutPromise]);
  }

  /**
   * @param {string} stage
   * @param {number} startTime
   * @param {number} thresholdMs
   */
  logSlowStage(stage, startTime, thresholdMs = SLOW_STAGE_THRESHOLD_MS) {
    const elapsedMs = Date.now() - startTime;
    if (elapsedMs < thresholdMs) {
      return;
    }

    logger.debug(`[AgentClient] ${stage} took ${elapsedMs}ms`);
  }

  sanitizeLangChainMessages(messages, { context, indexTokenCountMap, fallbackText } = {}) {
    const sanitizedMessages = [];
    const remappedIndexTokenCountMap = indexTokenCountMap ? {} : undefined;
    const droppedMessages = [];
    const sourceMessages = Array.isArray(messages) ? messages : [];

    for (let i = 0; i < sourceMessages.length; i++) {
      const message = sourceMessages[i];
      if (message == null || typeof message !== 'object' || typeof message._getType !== 'function') {
        droppedMessages.push({
          index: i,
          ...describeLangChainMessage(message),
        });
        continue;
      }

      const nextIndex = sanitizedMessages.length;
      sanitizedMessages.push(message);

      if (remappedIndexTokenCountMap && Object.hasOwn(indexTokenCountMap, i)) {
        remappedIndexTokenCountMap[nextIndex] = indexTokenCountMap[i];
      }
    }

    if (sanitizedMessages.length === 0 && typeof fallbackText === 'string' && fallbackText.trim()) {
      const fallbackContent = fallbackText.trim();
      sanitizedMessages.push(new HumanMessage(fallbackContent));
      if (remappedIndexTokenCountMap) {
        remappedIndexTokenCountMap[0] = this.getTokenCountForMessage({
          role: 'user',
          content: fallbackContent,
        });
      }
    }

    if (droppedMessages.length > 0) {
      logger.warn(`[AgentClient] Dropped malformed LangChain messages before ${context ?? 'processing'}`, {
        conversationId: this.conversationId,
        responseMessageId: this.responseMessageId,
        droppedCount: droppedMessages.length,
        droppedMessages,
      });
    }

    return {
      messages: sanitizedMessages,
      indexTokenCountMap: remappedIndexTokenCountMap,
    };
  }

  /**
   * @returns {Promise<string | undefined>}
   */
  async useMemory() {
    const trace = this.getTrace();
    const user = this.options.req.user;
    if (user.personalization?.memories === false) {
      logKynsTrace(trace, 'client.useMemory.skip', {
        reason: 'personalization_disabled',
      });
      return;
    }
    const hasAccess = await checkAccess({
      user,
      permissionType: PermissionTypes.MEMORIES,
      permissions: [Permissions.USE],
      getRoleByName,
    });

    if (!hasAccess) {
      logger.debug(
        `[api/server/controllers/agents/client.js #useMemory] User ${user.id} does not have USE permission for memories`,
      );
      logKynsTrace(trace, 'client.useMemory.skip', {
        reason: 'permission_denied',
      });
      return;
    }
    const appConfig = this.options.req.config;
    const memoryConfig = appConfig.memory;
    if (!memoryConfig || memoryConfig.disabled === true) {
      logKynsTrace(trace, 'client.useMemory.skip', {
        reason: 'memory_config_disabled',
      });
      return;
    }

    /** @type {Agent} */
    let prelimAgent;
    const allowedProviders = new Set(
      appConfig?.endpoints?.[EModelEndpoint.agents]?.allowedProviders,
    );
    try {
      if (memoryConfig.agent?.id != null && memoryConfig.agent.id !== this.options.agent.id) {
        prelimAgent = await loadAgent({
          req: this.options.req,
          agent_id: memoryConfig.agent.id,
          endpoint: EModelEndpoint.agents,
        });
      } else if (memoryConfig.agent?.id != null) {
        prelimAgent = this.options.agent;
      } else if (
        memoryConfig.agent?.id == null &&
        memoryConfig.agent?.model != null &&
        memoryConfig.agent?.provider != null
      ) {
        prelimAgent = { id: Constants.EPHEMERAL_AGENT_ID, ...memoryConfig.agent };
      }
    } catch (error) {
      logger.error(
        '[api/server/controllers/agents/client.js #useMemory] Error loading agent for memory',
        error,
      );
    }

    if (!prelimAgent) {
      logKynsTrace(trace, 'client.useMemory.skip', {
        reason: 'no_prelim_agent',
      });
      return;
    }

    const agent = await initializeAgent(
      {
        req: this.options.req,
        res: this.options.res,
        agent: prelimAgent,
        allowedProviders,
        endpointOption: {
          endpoint: !isEphemeralAgentId(prelimAgent.id)
            ? EModelEndpoint.agents
            : memoryConfig.agent?.provider,
        },
      },
      {
        getConvoFiles,
        getFiles: db.getFiles,
        getUserKey: db.getUserKey,
        updateFilesUsage: db.updateFilesUsage,
        getUserKeyValues: db.getUserKeyValues,
        getToolFilesByIds: db.getToolFilesByIds,
        getCodeGeneratedFiles: db.getCodeGeneratedFiles,
      },
    );

    if (!agent) {
      logger.warn(
        '[api/server/controllers/agents/client.js #useMemory] No agent found for memory',
        memoryConfig,
      );
      logKynsTrace(trace, 'client.useMemory.skip', {
        reason: 'memory_agent_not_found',
      });
      return;
    }

    const llmConfig = Object.assign(
      {
        provider: agent.provider,
        model: agent.model,
      },
      agent.model_parameters,
    );

    /** @type {import('@librechat/api').MemoryConfig} */
    const config = {
      validKeys: memoryConfig.validKeys,
      instructions: agent.instructions,
      llmConfig,
      tokenLimit: memoryConfig.tokenLimit,
    };

    const userId = this.options.req.user.id + '';
    const messageId = this.responseMessageId + '';
    const conversationId = this.conversationId + '';
    const streamId = this.options.req?._resumableStreamId || null;
    const [withoutKeys, processMemory] = await createMemoryProcessor({
      userId,
      config,
      messageId,
      streamId,
      conversationId,
      agentId: isEphemeralAgentId(this.options.agent.id) ? undefined : this.options.agent.id,
      agentName: this.options.agent.name,
      memoryMethods: {
        setMemory: db.setMemory,
        deleteMemory: db.deleteMemory,
        getFormattedMemories: db.getFormattedMemories,
      },
      res: this.options.res,
      user: createSafeUser(this.options.req.user),
    });

    this.processMemory = processMemory;
    logKynsTrace(trace, 'client.useMemory.ready', {
      memoryAgentId: agent.id,
      memoryAgentProvider: agent.provider,
      memoryAgentModel: agent.model ?? agent.model_parameters?.model,
      memoryContext: summarizeText(withoutKeys),
    });
    return withoutKeys;
  }

  /**
   * Filters out image URLs from message content
   * @param {BaseMessage} message - The message to filter
   * @returns {BaseMessage} - A new message with image URLs removed
   */
  filterImageUrls(message) {
    if (!message.content || typeof message.content === 'string') {
      return message;
    }

    if (Array.isArray(message.content)) {
      const filteredContent = message.content.filter(
        (part) => part.type !== ContentTypes.IMAGE_URL,
      );

      if (filteredContent.length === 1 && filteredContent[0].type === ContentTypes.TEXT) {
        const MessageClass = message.constructor;
        return new MessageClass({
          content: filteredContent[0].text,
          additional_kwargs: message.additional_kwargs,
        });
      }

      const MessageClass = message.constructor;
      return new MessageClass({
        content: filteredContent,
        additional_kwargs: message.additional_kwargs,
      });
    }

    return message;
  }

  /**
   * @param {BaseMessage[]} messages
   * @returns {Promise<void | (TAttachment | null)[]>}
   */
  async runMemory(messages) {
    try {
      if (this.processMemory == null) {
        return;
      }
      const { messages: sanitizedMessages } = this.sanitizeLangChainMessages(messages, {
        context: 'memory processing',
      });
      if (sanitizedMessages.length === 0) {
        return;
      }
      const appConfig = this.options.req.config;
      const memoryConfig = appConfig.memory;
      const messageWindowSize = memoryConfig?.messageWindowSize ?? 5;

      let messagesToProcess = [...sanitizedMessages];
      if (sanitizedMessages.length > messageWindowSize) {
        for (let i = sanitizedMessages.length - messageWindowSize; i >= 0; i--) {
          const potentialWindow = sanitizedMessages.slice(i, i + messageWindowSize);
          if (potentialWindow[0]?.role === 'user') {
            messagesToProcess = [...potentialWindow];
            break;
          }
        }

        if (messagesToProcess.length === sanitizedMessages.length) {
          messagesToProcess = [...sanitizedMessages.slice(-messageWindowSize)];
        }
      }

      const filteredMessages = messagesToProcess.map((msg) => this.filterImageUrls(msg));
      const bufferString = getBufferString(filteredMessages);
      const bufferMessage = new HumanMessage(`# Current Chat:\n\n${bufferString}`);
      return await this.processMemory([bufferMessage]);
    } catch (error) {
      logger.error('Memory Agent failed to process memory', error);
    }
  }

  removeToolFromAgentConfig(toolName) {
    if (!this.options.agent) {
      return;
    }

    if (Array.isArray(this.options.agent.tools)) {
      this.options.agent.tools = this.options.agent.tools.filter((tool) => tool !== toolName);
    }

    if (Array.isArray(this.options.agent.toolDefinitions)) {
      this.options.agent.toolDefinitions = this.options.agent.toolDefinitions.filter(
        (tool) => tool?.name !== toolName,
      );
    }

    if (this.options.agent.toolRegistry instanceof Map) {
      this.options.agent.toolRegistry.delete(toolName);
    }

    if (this.options.agent.toolContextMap?.[toolName] != null) {
      delete this.options.agent.toolContextMap[toolName];
    }
  }

  async prepareManualWebSearch(payload) {
    const ephemeralAgent = this.options.req.body?.ephemeralAgent;
    const webSearchConfig = this.options.req.config?.webSearch;
    if (ephemeralAgent?.web_search !== true || !webSearchConfig || !Array.isArray(payload)) {
      return payload;
    }

    try {
      const auth = await loadWebSearchAuth({
        userId: this.options.req.user.id,
        webSearchConfig,
        loadAuthValues,
        throwError: false,
      });

      if (!isWebSearchSufficientlyAuthenticated(auth)) {
        logger.warn('[prepareManualWebSearch] Web search auth insufficient, skipping');
        return payload;
      }

      let targetIndex = -1;
      for (let i = payload.length - 1; i >= 0; i--) {
        if (payload[i]?.role === 'user') {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex === -1) {
        return payload;
      }

      const targetMessage = payload[targetIndex];
      const query =
        typeof targetMessage?.content === 'string'
          ? targetMessage.content
          : targetMessage?.text ?? this.options.req.body?.text ?? '';

      if (!query.trim()) {
        return payload;
      }

      const searchTool = createSearchTool({
        ...auth.authResult,
        logger,
      });
      const rawResult = await searchTool.invoke({
        query: query.trim(),
        proMode: auth.authResult.scraperProvider != null,
      });
      const { content, artifact } = normalizeToolResult(rawResult);
      const normalizedContent =
        typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content
                .map((part) => (part?.type === ContentTypes.TEXT ? part.text ?? '' : ''))
                .filter(Boolean)
                .join('\n')
            : normalizeToolContent(content);

      if (!normalizedContent.trim()) {
        return payload;
      }

      const nextPayload = [...payload];
      nextPayload[targetIndex] = {
        ...targetMessage,
        role: targetMessage?.role ?? 'user',
        content: appendTextToMessageContent(
          targetMessage?.content ?? targetMessage?.text ?? '',
          `Web search context:\n${normalizedContent}`,
        ),
      };

      const searchData = artifact?.[Tools.web_search];
      if (searchData) {
        this.artifactPromises.push(
          Promise.resolve({
            type: Tools.web_search,
            messageId: this.responseMessageId,
            toolCallId: MANUAL_WEB_SEARCH_TOOL_ID,
            conversationId: this.conversationId,
            [Tools.web_search]: searchData,
          }),
        );
      }

      this.removeToolFromAgentConfig(Tools.web_search);
      return nextPayload.filter(Boolean);
    } catch (err) {
      logger.error('[prepareManualWebSearch] Web search failed, proceeding without search:', err);
      return payload;
    }
  }

  isKynsImageEndpoint() {
    const endpoint = this.options.endpoint;
    const agentEndpoint = this.options.agent?.endpoint;
    const bodyEndpoint = this.options.req?.body?.endpoint;
    const bodyEndpointOption = this.options.req?.body?.endpointOption?.endpoint;
    return (
      endpoint === 'KYNSImage' ||
      agentEndpoint === 'KYNSImage' ||
      bodyEndpoint === 'KYNSImage' ||
      bodyEndpointOption === 'KYNSImage'
    );
  }

  isKynsEndpoint() {
    const endpoint = this.options.endpoint;
    const agentEndpoint = this.options.agent?.endpoint;
    const bodyEndpoint = this.options.req?.body?.endpoint;
    const bodyEndpointOption = this.options.req?.body?.endpointOption?.endpoint;
    return (
      endpoint === 'KYNS' ||
      agentEndpoint === 'KYNS' ||
      bodyEndpoint === 'KYNS' ||
      bodyEndpointOption === 'KYNS'
    );
  }

  isExplicitKynsImageRequest() {
    const userText = this.options.req?.body?.text ?? '';
    if (!userText.trim()) {
      return false;
    }

    const capabilityQuestion =
      /^\s*(voc[eê]|voce|you)\s+(gera|gerar|cria|criar|faz|fazer|generate|create|make|draw|render|illustrate)\s+(imagens?|images?|imagem|image|arte|art|foto|picture)\??\s*$/i;
    if (capabilityQuestion.test(userText)) {
      return false;
    }

    const imageCommand =
      /^\s*(gere|gerar|gera|crie|criar|cria|fa[çc]a|fazer|faz|desenhe|desenhar|ilustre|ilustrar|renderize|renderizar|produza|produzir|make|create|generate|draw|render|illustrate)\b/i;
    const imageVerb =
      /\b(gere|gerar|gera|crie|criar|cria|fa[çc]a|faz|desenhe|desenhar|ilustre|ilustrar|renderize|renderizar|produza|produzir|make|create|generate|draw|render|illustrate)\b/i;
    const imageTarget =
      /\b(imagem|foto|fotografia|ilustra(?:ç|c)[aã]o|arte|artwork|poster|capa|banner|logo|wallpaper|avatar|retrato|portrait|scene|cen[áa]rio|character|personagem|image|picture)\b/i;
    const directImageDescriptor =
      /^\s*(uma?\s+)?(imagem|image|foto|arte|ilustra(?:ç|c)[aã]o)\s+(de|of)\b/i;
    const nonImageTarget =
      /\b(prompt|texto|copy|legenda|resumo|lista|t[ií]tulo|titulo|c[oó]digo|codigo|roteiro|plano|email)\b/i;

    return (
      directImageDescriptor.test(userText) ||
      (imageCommand.test(userText) && !nonImageTarget.test(userText)) ||
      (imageVerb.test(userText) && imageTarget.test(userText))
    );
  }

  shouldBypassToKynsImage() {
    return this.isKynsImageEndpoint() || (this.isKynsEndpoint() && this.isExplicitKynsImageRequest());
  }

  getKynsImageRequestedModel() {
    const userText = this.options.req?.body?.text ?? '';
    if (
      /\b(flux2klein|kyns image|alta qualidade|maximum quality|max quality|high quality|photoreal|fotorreal|fotorrealista)\b/i.test(
        userText,
      )
    ) {
      return 'flux2klein';
    }
    return 'zimage';
  }

  async executeKynsImageRequest() {
    const body = this.options.req?.body ?? {};
    const userText = body.text ?? '';
    if (!userText.trim()) {
      return 'Por favor, descreva a imagem que deseja gerar.';
    }

    const port = process.env.PORT || 3080;
    const spec = this.options.spec ?? body.spec ?? '';
    const model = this.isKynsImageEndpoint()
      ? spec.includes('turbo')
        ? 'zimage'
        : 'flux2klein'
      : this.getKynsImageRequestedModel();
    const requestUserId = this.user ?? this.options.req?.user?.id;
    const proxyApiKey = process.env.IMAGE_PROXY_KEY?.trim();
    logger.info(`[KYNSImage] spec=${spec} → model=${model}`);

    if (!proxyApiKey) {
      logger.error('[KYNSImage] IMAGE_PROXY_KEY is required for image proxy requests');
      return 'Geração de imagens não configurada. Contate o administrador.';
    }

    if (requestUserId == null) {
      logger.error('[KYNSImage] Missing user id for image proxy request');
      return 'Erro ao gerar imagem. Tente novamente.';
    }

    const requesterToken = jwt.sign({ sub: String(requestUserId) }, proxyApiKey, {
      audience: 'image-proxy-user',
      expiresIn: '5m',
    });

    const response = await fetch(`http://127.0.0.1:${port}/api/image-proxy/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${proxyApiKey}`,
        'X-KYNS-User-Token': requesterToken,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: userText }],
        model,
        userId: String(requestUserId),
      }),
    });

    if (!response.ok) {
      logger.error(`[KYNSImage] imageProxy returned ${response.status}`);
      if (response.status === 503) {
        return 'Geração de imagens não configurada. Contate o administrador.';
      }
      return 'Erro ao gerar imagem. Tente novamente.';
    }

    const data = await response.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.length > 0) {
      return content;
    }

    logger.error('[KYNSImage] Unexpected response from imageProxy:', data);
    return 'Erro ao gerar imagem. Tente novamente.';
  }

  /** @type {sendCompletion} */
  async sendCompletion(payload, opts = {}) {
    const trace = this.getTrace();
    if (this.shouldBypassToKynsImage()) {
      logKynsTrace(trace, 'client.sendCompletion.kynsImageBypass', {
        requestedModel: this.getKynsImageRequestedModel(),
      });
      logger.info('[KYNSImage] Bypass activated — skipping agent pipeline');
      try {
        const imageContent = await this.executeKynsImageRequest();
        this.contentParts.push({ type: ContentTypes.TEXT, text: imageContent });
      } catch (err) {
        logger.error('[KYNSImage] Error in executeKynsImageRequest:', err);
        this.contentParts.push({
          type: ContentTypes.ERROR,
          [ContentTypes.ERROR]: `Erro ao gerar imagem: ${err?.message ?? 'erro desconhecido'}`,
        });
      }
      const completion = filterMalformedContentParts(this.contentParts);
      logKynsTrace(trace, 'client.sendCompletion.kynsImageDone', {
        completion: summarizeContentParts(completion),
      });
      return { completion };
    }

    logKynsTrace(trace, 'client.sendCompletion.agentStart', {
      payloadCount: Array.isArray(payload) ? payload.length : undefined,
    });
    await this.chatCompletion({
      payload,
      onProgress: opts.onProgress,
      userMCPAuthMap: opts.userMCPAuthMap,
      abortController: opts.abortController,
    });

    const completion = filterMalformedContentParts(this.contentParts);
    logKynsTrace(trace, 'client.sendCompletion.agentDone', {
      completion: summarizeContentParts(completion),
      traceSnapshot: snapshotKynsTrace(trace),
    });
    return { completion };
  }

  /**
   * @param {Object} params
   * @param {string} [params.model]
   * @param {string} [params.context='message']
   * @param {AppConfig['balance']} [params.balance]
   * @param {AppConfig['transactions']} [params.transactions]
   * @param {UsageMetadata[]} [params.collectedUsage=this.collectedUsage]
   */
  async recordCollectedUsage({
    model,
    balance,
    transactions,
    context = 'message',
    collectedUsage = this.collectedUsage,
  }) {
    const result = await recordCollectedUsage(
      {
        spendTokens,
        spendStructuredTokens,
        pricing: { getMultiplier, getCacheMultiplier },
        bulkWriteOps: { insertMany: bulkInsertTransactions, updateBalance },
      },
      {
        user: this.user ?? this.options.req.user?.id,
        conversationId: this.conversationId,
        collectedUsage,
        model: model ?? this.model ?? this.options.agent.model_parameters.model,
        context,
        messageId: this.responseMessageId,
        balance,
        transactions,
        endpointTokenConfig: this.options.endpointTokenConfig,
      },
    );

    if (result) {
      this.usage = result;
    }
  }

  /**
   * Get stream usage as returned by this client's API response.
   * @returns {UsageMetadata} The stream usage object.
   */
  getStreamUsage() {
    return this.usage;
  }

  /**
   * @param {TMessage} responseMessage
   * @returns {number}
   */
  getTokenCountForResponse({ content }) {
    return this.getTokenCountForMessage({
      role: 'assistant',
      content,
    });
  }

  /**
   * Calculates the correct token count for the current user message based on the token count map and API usage.
   * Edge case: If the calculation results in a negative value, it returns the original estimate.
   * If revisiting a conversation with a chat history entirely composed of token estimates,
   * the cumulative token count going forward should become more accurate as the conversation progresses.
   * @param {Object} params - The parameters for the calculation.
   * @param {Record<string, number>} params.tokenCountMap - A map of message IDs to their token counts.
   * @param {string} params.currentMessageId - The ID of the current message to calculate.
   * @param {OpenAIUsageMetadata} params.usage - The usage object returned by the API.
   * @returns {number} The correct token count for the current user message.
   */
  calculateCurrentTokenCount({ tokenCountMap, currentMessageId, usage }) {
    const originalEstimate = tokenCountMap[currentMessageId] || 0;

    if (!usage || typeof usage[this.inputTokensKey] !== 'number') {
      return originalEstimate;
    }

    tokenCountMap[currentMessageId] = 0;
    const totalTokensFromMap = Object.values(tokenCountMap).reduce((sum, count) => {
      const numCount = Number(count);
      return sum + (isNaN(numCount) ? 0 : numCount);
    }, 0);
    const totalInputTokens = usage[this.inputTokensKey] ?? 0;

    const currentMessageTokens = totalInputTokens - totalTokensFromMap;
    return currentMessageTokens > 0 ? currentMessageTokens : originalEstimate;
  }

  /**
   * @param {object} params
   * @param {string | ChatCompletionMessageParam[]} params.payload
   * @param {Record<string, Record<string, string>>} [params.userMCPAuthMap]
   * @param {AbortController} [params.abortController]
   */
  async chatCompletion({ payload, userMCPAuthMap, abortController = null }) {
    const trace = this.getTrace();
    /** @type {Partial<GraphRunnableConfig>} */
    let config;
    /** @type {ReturnType<createRun>} */
    let run;
    /** @type {Promise<(TAttachment | null)[] | undefined>} */
    let memoryPromise;
    const appConfig = this.options.req.config;
    const balanceConfig = getBalanceConfig(appConfig);
    const transactionsConfig = getTransactionsConfig(appConfig);
    try {
      if (!abortController) {
        abortController = new AbortController();
      }

      /** @type {AppConfig['endpoints']['agents']} */
      const agentsEConfig = appConfig.endpoints?.[EModelEndpoint.agents];

      const createRunConfig = () => ({
        runName: 'AgentRun',
        configurable: {
          thread_id: this.conversationId,
          last_agent_index: this.agentConfigs?.size ?? 0,
          user_id: this.user ?? this.options.req.user?.id,
          hide_sequential_outputs: this.options.agent.hide_sequential_outputs,
          requestBody: {
            messageId: this.responseMessageId,
            conversationId: this.conversationId,
            parentMessageId: this.parentMessageId,
          },
          user: createSafeUser(this.options.req.user),
        },
        recursionLimit: agentsEConfig?.recursionLimit ?? DEFAULT_AGENT_RECURSION_LIMIT,
        signal: abortController.signal,
        streamMode: 'values',
        version: 'v2',
      });

      config = createRunConfig();

      payload = await this.prepareManualWebSearch(payload);
      payload = sanitizePayload(payload);
      const toolSet = buildToolSet(this.options.agent);
      let { messages: initialMessages, indexTokenCountMap } = formatAgentMessages(
        payload,
        this.indexTokenCountMap,
        toolSet,
      );
      ({ messages: initialMessages, indexTokenCountMap } = this.sanitizeLangChainMessages(
        initialMessages,
        {
          context: 'agent run',
          indexTokenCountMap,
          fallbackText: this.options.req?.body?.text,
        },
      ));
      logKynsTrace(trace, 'client.chatCompletion.initialMessages', {
        payloadCount: Array.isArray(payload) ? payload.length : undefined,
        initialMessages: summarizeMessages(initialMessages),
      });

      /**
       * @param {BaseMessage[]} messages
       */
      const runAgents = async (messages) => {
        config = createRunConfig();
        const agents = [this.options.agent];
        // Include additional agents when:
        // - agentConfigs has agents (from addedConvo parallel execution or agent handoffs)
        // - Agents without incoming edges become start nodes and run in parallel automatically
        if (this.agentConfigs && this.agentConfigs.size > 0) {
          agents.push(...this.agentConfigs.values());
        }

        if (agents[0].recursion_limit && typeof agents[0].recursion_limit === 'number') {
          config.recursionLimit = agents[0].recursion_limit;
        }

        if (
          agentsEConfig?.maxRecursionLimit &&
          config.recursionLimit > agentsEConfig?.maxRecursionLimit
        ) {
          config.recursionLimit = agentsEConfig?.maxRecursionLimit;
        }

        // TODO: needs to be added as part of AgentContext initialization
        // const noSystemModelRegex = [/\b(o1-preview|o1-mini|amazon\.titan-text)\b/gi];
        // const noSystemMessages = noSystemModelRegex.some((regex) =>
        //   agent.model_parameters.model.match(regex),
        // );
        // if (noSystemMessages === true && systemContent?.length) {
        //   const latestMessageContent = _messages.pop().content;
        //   if (typeof latestMessageContent !== 'string') {
        //     latestMessageContent[0].text = [systemContent, latestMessageContent[0].text].join('\n');
        //     _messages.push(new HumanMessage({ content: latestMessageContent }));
        //   } else {
        //     const text = [systemContent, latestMessageContent].join('\n');
        //     _messages.push(new HumanMessage(text));
        //   }
        // }
        // let messages = _messages;
        // if (agent.useLegacyContent === true) {
        //   messages = formatContentStrings(messages);
        // }
        // if (
        //   agent.model_parameters?.clientOptions?.defaultHeaders?.['anthropic-beta']?.includes(
        //     'prompt-caching',
        //   )
        // ) {
        //   messages = addCacheControl(messages);
        // }

        memoryPromise = this.runMemory(messages);
        logKynsTrace(trace, 'client.runAgents.beforeCreateRun', {
          messageSummary: summarizeMessages(messages),
          agentCount: agents.length,
          recursionLimit: config.recursionLimit,
        });

        const createRunStart = Date.now();
        run = await createRun({
          agents,
          messages,
          indexTokenCountMap,
          runId: this.responseMessageId,
          signal: abortController.signal,
          customHandlers: this.options.eventHandlers,
          requestBody: config.configurable.requestBody,
          user: createSafeUser(this.options.req?.user),
          tokenCounter: createTokenCounter(this.getEncoding()),
        });
        this.logSlowStage('createRun', createRunStart);
        logKynsTrace(trace, 'client.runAgents.afterCreateRun', {
          hasRun: Boolean(run),
          recursionLimit: config.recursionLimit,
        });

        if (!run) {
          throw new Error('Failed to create run');
        }

        this.run = run;

        const streamId = this.options.req?._resumableStreamId;
        if (streamId && run.Graph) {
          GenerationJobManager.setGraph(streamId, run.Graph);
        }

        if (userMCPAuthMap != null) {
          config.configurable.userMCPAuthMap = userMCPAuthMap;
        }

        /** @deprecated Agent Chain */
        config.configurable.last_agent_id = agents[agents.length - 1].id;
        logKynsTrace(trace, 'client.runAgents.beforeProcessStream', {
          lastAgentId: config.configurable.last_agent_id,
          hideSequentialOutputs: config.configurable.hide_sequential_outputs,
        });
        await run.processStream({ messages }, config, {
          callbacks: {
            [Callback.TOOL_ERROR]: logToolError,
          },
        });
        logKynsTrace(trace, 'client.runAgents.afterProcessStream', {
          contentParts: summarizeContentParts(this.contentParts),
          traceSnapshot: snapshotKynsTrace(trace),
        });

        config.signal = null;
      };

      const hideSequentialOutputs = config.configurable.hide_sequential_outputs;

      try {
        await runAgents(initialMessages);
      } catch (retryErr) {
        const isTransient =
          /Connection error|terminated|ECONNREFUSED|ECONNRESET|fetch failed|ETIMEDOUT|EngineCore|Received empty response|Empty streamed response/i.test(
            retryErr?.message ?? '',
          );
        if (isTransient && !hasVisibleTextContentParts(this.contentParts)) {
          const jitter = 2000 + Math.floor(Math.random() * 1000);
          logKynsTrace(trace, 'client.chatCompletion.transientRetry', {
            jitter,
            error: summarizeError(retryErr),
          });
          logger.warn(
            `[AgentClient] Transient error before content, retrying once in ${jitter}ms: ${retryErr?.message}`,
          );
          this.contentParts = [];
          await new Promise((resolve) => setTimeout(resolve, jitter));
          await runAgents(initialMessages);
        } else {
          throw retryErr;
        }
      }

      if (!hasVisibleTextContentParts(this.contentParts)) {
        const recoveredText = tryRecoverContentFromGraph(run);
        if (recoveredText) {
          logKynsTrace(trace, 'client.chatCompletion.emptyRecovered', {
            recoveredLength: recoveredText.length,
          });
          logger.info('[AgentClient] Recovered content from graph state after empty contentParts');
          this.contentParts = [];
          this.contentParts.push({ type: ContentTypes.TEXT, text: recoveredText });
        } else {
          const jitter = 1500 + Math.floor(Math.random() * 500);
          logKynsTrace(trace, 'client.chatCompletion.emptyRetry', {
            jitter,
            traceSnapshot: snapshotKynsTrace(trace),
          });
          logger.warn(
            `[AgentClient] Empty contentParts after successful processStream, retrying once in ${jitter}ms`,
          );
          this.contentParts = [];
          await new Promise((resolve) => setTimeout(resolve, jitter));
          await runAgents(initialMessages);
        }
      }

      /** @deprecated Agent Chain */
      if (hideSequentialOutputs) {
        this.contentParts = this.contentParts.filter((part, index) => {
          // Include parts that are either:
          // 1. At or after the finalContentStart index
          // 2. Of type tool_call
          // 3. Have tool_call_ids property
          return (
            index >= this.contentParts.length - 1 ||
            part.type === ContentTypes.TOOL_CALL ||
            part.tool_call_ids
          );
        });
      }
    } catch (err) {
      if (err instanceof KynsResponseFilteredError) {
        logKynsTrace(trace, 'client.chatCompletion.filtered', {
          reason: err.reason,
          traceSnapshot: snapshotKynsTrace(trace),
        });
        logger.warn('[AgentClient] Response interrupted by KYNS response guard', {
          reason: err.reason,
          userId: this.user ?? this.options.req.user?.id,
          conversationId: this.conversationId,
          messageId: this.responseMessageId,
        });
      } else {
        logKynsTrace(trace, 'client.chatCompletion.error', {
          error: summarizeError(err),
          traceSnapshot: snapshotKynsTrace(trace),
        });
        logger.error(
          '[api/server/controllers/agents/client.js #sendCompletion] Operation aborted',
          err,
        );
      }
      if (!(err instanceof KynsResponseFilteredError) && err?.stack) {
        logger.error('[sendCompletion] Stack trace:', err.stack);
      }
      if (!(err instanceof KynsResponseFilteredError) && !abortController.signal.aborted) {
        logger.error(
          '[api/server/controllers/agents/client.js #sendCompletion] Unhandled error type',
          err,
        );
        const rawMsg = err?.message ?? '';
        const stackHint = err?.stack
          ? '\n' + err.stack.split('\n').slice(0, 4).join('\n')
          : '';
        const isConnectionError =
          /Connection error|terminated|ECONNREFUSED|ECONNRESET|fetch failed|ETIMEDOUT|EngineCore|Received empty response|Empty streamed response/i.test(rawMsg);
        const userMessage = isConnectionError
          ? 'Falha de conexão com o servidor. Pode ser temporário — tente novamente em alguns instantes.'
          : `${rawMsg || 'Unknown error'}${stackHint}`;
        this.contentParts.push({
          type: ContentTypes.ERROR,
          [ContentTypes.ERROR]: userMessage,
        });
      }
    } finally {
      logKynsTrace(trace, 'client.chatCompletion.finally', {
        contentParts: summarizeContentParts(this.contentParts),
        traceSnapshot: snapshotKynsTrace(trace),
      });
      try {
        if (memoryPromise) {
          memoryPromise
            .then((attachments) => {
              if (attachments && attachments.length > 0) {
                logger.debug(
                  `[AgentClient] Memory completed in background with ${attachments.length} attachment(s)`,
                );
              }
            })
            .catch((err) => {
              logger.error('[AgentClient] Background memory processing error:', err);
            });
        }

        /** Skip token spending if aborted - the abort handler (abortMiddleware.js) handles it
        This prevents double-spending when user aborts via `/api/agents/chat/abort` */
        const wasAborted = abortController?.signal?.aborted;
        if (!wasAborted) {
          await this.recordCollectedUsage({
            context: 'message',
            balance: balanceConfig,
            transactions: transactionsConfig,
          });
        } else {
          logger.debug(
            '[api/server/controllers/agents/client.js #chatCompletion] Skipping token spending - handled by abort middleware',
          );
        }
      } catch (err) {
        logger.error(
          '[api/server/controllers/agents/client.js #chatCompletion] Error in cleanup phase',
          err,
        );
      }
      run = null;
      config = null;
      memoryPromise = null;
    }
  }

  /**
   *
   * @param {Object} params
   * @param {string} params.text
   * @param {string} params.conversationId
   */
  async titleConvo({ text, abortController }) {
    if (!this.run) {
      throw new Error('Run not initialized');
    }
    const { handleLLMEnd, collected: collectedMetadata } = createMetadataAggregator();
    const { req, agent } = this.options;

    if (req?.body?.isTemporary) {
      logger.debug(
        `[api/server/controllers/agents/client.js #titleConvo] Skipping title generation for temporary conversation`,
      );
      return;
    }

    const appConfig = req.config;
    let endpoint = agent.endpoint;

    /** @type {import('@librechat/agents').ClientOptions} */
    let clientOptions = {
      model: agent.model || agent.model_parameters.model,
    };

    let titleProviderConfig = getProviderConfig({ provider: endpoint, appConfig });

    /** @type {TEndpoint | undefined} */
    const endpointConfig =
      appConfig.endpoints?.all ??
      appConfig.endpoints?.[endpoint] ??
      titleProviderConfig.customEndpointConfig;
    if (!endpointConfig) {
      logger.debug(
        `[api/server/controllers/agents/client.js #titleConvo] No endpoint config for "${endpoint}"`,
      );
    }

    if (endpointConfig?.titleConvo === false) {
      logger.debug(
        `[api/server/controllers/agents/client.js #titleConvo] Title generation disabled for endpoint "${endpoint}"`,
      );
      return;
    }

    if (endpointConfig?.titleEndpoint && endpointConfig.titleEndpoint !== endpoint) {
      try {
        titleProviderConfig = getProviderConfig({
          provider: endpointConfig.titleEndpoint,
          appConfig,
        });
        endpoint = endpointConfig.titleEndpoint;
      } catch (error) {
        logger.warn(
          `[api/server/controllers/agents/client.js #titleConvo] Error getting title endpoint config for "${endpointConfig.titleEndpoint}", falling back to default`,
          error,
        );
        // Fall back to original provider config
        endpoint = agent.endpoint;
        titleProviderConfig = getProviderConfig({ provider: endpoint, appConfig });
      }
    }

    if (
      endpointConfig &&
      endpointConfig.titleModel &&
      endpointConfig.titleModel !== Constants.CURRENT_MODEL
    ) {
      clientOptions.model = endpointConfig.titleModel;
    }

    const options = await titleProviderConfig.getOptions({
      req,
      endpoint,
      model_parameters: clientOptions,
      db: {
        getUserKey: db.getUserKey,
        getUserKeyValues: db.getUserKeyValues,
      },
    });

    let provider = options.provider ?? titleProviderConfig.overrideProvider ?? agent.provider;
    if (
      endpoint === EModelEndpoint.azureOpenAI &&
      options.llmConfig?.azureOpenAIApiInstanceName == null
    ) {
      provider = Providers.OPENAI;
    } else if (
      endpoint === EModelEndpoint.azureOpenAI &&
      options.llmConfig?.azureOpenAIApiInstanceName != null &&
      provider !== Providers.AZURE
    ) {
      provider = Providers.AZURE;
    }

    /** @type {import('@librechat/agents').ClientOptions} */
    clientOptions = { ...options.llmConfig };
    if (options.configOptions) {
      clientOptions.configuration = options.configOptions;
    }

    if (clientOptions.maxTokens != null) {
      delete clientOptions.maxTokens;
    }
    if (clientOptions?.modelKwargs?.max_completion_tokens != null) {
      delete clientOptions.modelKwargs.max_completion_tokens;
    }
    if (clientOptions?.modelKwargs?.max_output_tokens != null) {
      delete clientOptions.modelKwargs.max_output_tokens;
    }

    clientOptions = Object.assign(
      Object.fromEntries(
        Object.entries(clientOptions).filter(([key]) => !omitTitleOptions.has(key)),
      ),
    );

    if (
      provider === Providers.GOOGLE &&
      (endpointConfig?.titleMethod === TitleMethod.FUNCTIONS ||
        endpointConfig?.titleMethod === TitleMethod.STRUCTURED)
    ) {
      clientOptions.json = true;
    }

    /** Resolve request-based headers for Custom Endpoints. Note: if this is added to
     *  non-custom endpoints, needs consideration of varying provider header configs.
     */
    if (clientOptions?.configuration?.defaultHeaders != null) {
      clientOptions.configuration.defaultHeaders = resolveHeaders({
        headers: clientOptions.configuration.defaultHeaders,
        user: createSafeUser(this.options.req?.user),
        body: {
          messageId: this.responseMessageId,
          conversationId: this.conversationId,
          parentMessageId: this.parentMessageId,
        },
      });
    }

    try {
      const titleResult = await this.run.generateTitle({
        provider,
        clientOptions,
        inputText: text,
        contentParts: this.contentParts,
        titleMethod: endpointConfig?.titleMethod,
        titlePrompt: endpointConfig?.titlePrompt,
        titlePromptTemplate: endpointConfig?.titlePromptTemplate,
        chainOptions: {
          signal: abortController.signal,
          callbacks: [
            {
              handleLLMEnd,
            },
          ],
          configurable: {
            thread_id: this.conversationId,
            user_id: this.user ?? this.options.req.user?.id,
          },
        },
      });

      const collectedUsage = collectedMetadata.map((item) => {
        let input_tokens, output_tokens;

        if (item.usage) {
          input_tokens =
            item.usage.prompt_tokens || item.usage.input_tokens || item.usage.inputTokens;
          output_tokens =
            item.usage.completion_tokens || item.usage.output_tokens || item.usage.outputTokens;
        } else if (item.tokenUsage) {
          input_tokens = item.tokenUsage.promptTokens;
          output_tokens = item.tokenUsage.completionTokens;
        }

        return {
          input_tokens: input_tokens,
          output_tokens: output_tokens,
        };
      });

      const balanceConfig = getBalanceConfig(appConfig);
      const transactionsConfig = getTransactionsConfig(appConfig);
      await this.recordCollectedUsage({
        collectedUsage,
        context: 'title',
        model: clientOptions.model,
        balance: balanceConfig,
        transactions: transactionsConfig,
        messageId: this.responseMessageId,
      }).catch((err) => {
        logger.error(
          '[api/server/controllers/agents/client.js #titleConvo] Error recording collected usage',
          err,
        );
      });

      return sanitizeTitle(titleResult.title);
    } catch (err) {
      logger.error('[api/server/controllers/agents/client.js #titleConvo] Error', err);
      return;
    }
  }

  /**
   * @param {object} params
   * @param {number} params.promptTokens
   * @param {number} params.completionTokens
   * @param {string} [params.model]
   * @param {OpenAIUsageMetadata} [params.usage]
   * @param {AppConfig['balance']} [params.balance]
   * @param {string} [params.context='message']
   * @returns {Promise<void>}
   */
  async recordTokenUsage({
    model,
    usage,
    balance,
    promptTokens,
    completionTokens,
    context = 'message',
  }) {
    try {
      await spendTokens(
        {
          model,
          context,
          balance,
          messageId: this.responseMessageId,
          conversationId: this.conversationId,
          user: this.user ?? this.options.req.user?.id,
          endpointTokenConfig: this.options.endpointTokenConfig,
        },
        { promptTokens, completionTokens },
      );

      if (
        usage &&
        typeof usage === 'object' &&
        'reasoning_tokens' in usage &&
        typeof usage.reasoning_tokens === 'number'
      ) {
        await spendTokens(
          {
            model,
            balance,
            context: 'reasoning',
            messageId: this.responseMessageId,
            conversationId: this.conversationId,
            user: this.user ?? this.options.req.user?.id,
            endpointTokenConfig: this.options.endpointTokenConfig,
          },
          { completionTokens: usage.reasoning_tokens },
        );
      }
    } catch (error) {
      logger.error(
        '[api/server/controllers/agents/client.js #recordTokenUsage] Error recording token usage',
        error,
      );
    }
  }

  getEncoding() {
    return 'o200k_base';
  }

  /**
   * Returns the token count of a given text. It also checks and resets the tokenizers if necessary.
   * @param {string} text - The text to get the token count for.
   * @returns {number} The token count of the given text.
   */
  getTokenCount(text) {
    const encoding = this.getEncoding();
    return Tokenizer.getTokenCount(text, encoding);
  }
}

module.exports = AgentClient;
