const { handleError } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const {
  EndpointURLs,
  EModelEndpoint,
  isAgentsEndpoint,
  parseCompactConvo,
  getDefaultParamsEndpoint,
} = require('librechat-data-provider');
const azureAssistants = require('~/server/services/Endpoints/azureAssistants');
const assistants = require('~/server/services/Endpoints/assistants');
const { getEndpointsConfig } = require('~/server/services/Config');
const agents = require('~/server/services/Endpoints/agents');
const {
  ensureKynsTrace,
  logKynsTrace,
  summarizeParsedBody,
  summarizeEndpointOption,
} = require('~/server/utils/kynsTrace');
const { updateFilesUsage } = require('~/models');

const buildFunction = {
  [EModelEndpoint.agents]: agents.buildOptions,
  [EModelEndpoint.assistants]: assistants.buildOptions,
  [EModelEndpoint.azureAssistants]: azureAssistants.buildOptions,
};

const KYNS_DEEP_SPEC = 'kyns-deep';

const getEffectiveEndpoint = (endpoint, spec) =>
  endpoint === 'KYNSDeep' || spec === KYNS_DEEP_SPEC ? 'KYNS' : endpoint;

const applySpecOverrides = (parsedBody) => {
  if (parsedBody?.spec !== KYNS_DEEP_SPEC) {
    return parsedBody;
  }

  return {
    ...parsedBody,
    reasoning_effort:
      parsedBody.reasoning_effort == null || parsedBody.reasoning_effort === ''
        ? 'high'
        : parsedBody.reasoning_effort,
    max_tokens:
      parsedBody.max_tokens == null || parsedBody.max_tokens === '' ? 2048 : parsedBody.max_tokens,
    chat_template_kwargs: {
      ...(parsedBody.chat_template_kwargs ?? {}),
      enable_thinking: false,
    },
  };
};

async function buildEndpointOption(req, res, next) {
  const { endpoint: requestedEndpoint, endpointType } = req.body;
  const endpoint = getEffectiveEndpoint(requestedEndpoint, req.body?.spec);
  const trace = ensureKynsTrace(req, {
    userId: req.user?.id,
    requestedEndpoint,
    requestedSpec: req.body?.spec,
    conversationId: req.body?.conversationId,
  });

  let endpointsConfig;
  try {
    endpointsConfig = await getEndpointsConfig(req);
  } catch (error) {
    logger.error('Error fetching endpoints config in buildEndpointOption', error);
  }

  const defaultParamsEndpoint = getDefaultParamsEndpoint(endpointsConfig, endpoint);

  let parsedBody;
  try {
    parsedBody = parseCompactConvo({
      endpoint,
      endpointType,
      conversation: {
        ...req.body,
        endpoint,
      },
      defaultParamsEndpoint,
    });
  } catch (error) {
    logger.error(`Error parsing compact conversation for endpoint ${endpoint}`, error);
    logger.debug({
      'Error parsing compact conversation': { endpoint, endpointType, conversation: req.body },
    });
    return handleError(res, { text: 'Error parsing conversation' });
  }

  const appConfig = req.config;
  const isAgentRoute = req.baseUrl.startsWith(EndpointURLs[EModelEndpoint.agents]);
  const isAgentEndpoint = isAgentsEndpoint(endpoint);

  if (!isAgentEndpoint && appConfig.modelSpecs?.list && appConfig.modelSpecs?.enforce) {
    /** @type {{ list: TModelSpec[] }}*/
    const { list } = appConfig.modelSpecs;
    const { spec } = parsedBody;

    if (!spec) {
      return handleError(res, { text: 'No model spec selected' });
    }

    const currentModelSpec = list.find((s) => s.name === spec);
    if (!currentModelSpec) {
      return handleError(res, { text: 'Invalid model spec' });
    }

    const normalizedSpecEndpoint = getEffectiveEndpoint(currentModelSpec.preset.endpoint, spec);
    if (endpoint !== normalizedSpecEndpoint) {
      return handleError(res, { text: 'Model spec mismatch' });
    }

    try {
      currentModelSpec.preset.spec = spec;
      currentModelSpec.preset.endpoint = endpoint;
      parsedBody = parseCompactConvo({
        endpoint,
        endpointType,
        conversation: currentModelSpec.preset,
        defaultParamsEndpoint,
      });
      if (currentModelSpec.iconURL != null && currentModelSpec.iconURL !== '') {
        parsedBody.iconURL = currentModelSpec.iconURL;
      }
    } catch (error) {
      logger.error(`Error parsing model spec for endpoint ${endpoint}`, error);
      return handleError(res, { text: 'Error parsing model spec' });
    }
  } else if (parsedBody.spec && appConfig.modelSpecs?.list) {
    // Non-enforced mode: if spec is selected, derive iconURL from model spec
    const modelSpec = appConfig.modelSpecs.list.find((s) => s.name === parsedBody.spec);
    if (modelSpec?.iconURL) {
      parsedBody.iconURL = modelSpec.iconURL;
    }
  }

  parsedBody = applySpecOverrides(parsedBody);
  logKynsTrace(trace, 'buildEndpointOption.parsedBody', {
    endpoint,
    endpointType,
    parsedBody: summarizeParsedBody(parsedBody),
  });

  try {
    const isAgents = isAgentEndpoint || isAgentRoute;
    const builder = isAgents
      ? (...args) => buildFunction[EModelEndpoint.agents](req, ...args)
      : buildFunction[endpointType ?? endpoint];

    // TODO: use object params
    req.body = req.body || {}; // Express 5: ensure req.body exists
    req.body.endpoint = endpoint;
    if (parsedBody.promptPrefix !== undefined) {
      req.body.promptPrefix = parsedBody.promptPrefix;
    }
    if (parsedBody.modelLabel !== undefined) {
      req.body.modelLabel = parsedBody.modelLabel;
    }
    req.body.endpointOption = await builder(endpoint, parsedBody, endpointType);
    logKynsTrace(trace, 'buildEndpointOption.endpointOption', {
      isAgents,
      endpointOption: summarizeEndpointOption(req.body.endpointOption),
    });

    if (req.body.files && !isAgents) {
      req.body.endpointOption.attachments = updateFilesUsage(req.body.files);
    }

    next();
  } catch (error) {
    logger.error(
      `Error building endpoint option for endpoint ${endpoint} with type ${endpointType}`,
      error,
    );
    return handleError(res, { text: 'Error building endpoint option' });
  }
}

module.exports = buildEndpointOption;
