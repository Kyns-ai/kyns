/**
 * Wrap parseCompactConvo: the REAL function runs, but jest can observe
 * calls and return values. Must be declared before require('./buildEndpointOption')
 * so the destructured reference in the middleware captures the wrapper.
 */
jest.mock('librechat-data-provider', () => {
  const actual = jest.requireActual('librechat-data-provider');
  return {
    ...actual,
    parseCompactConvo: jest.fn((...args) => actual.parseCompactConvo(...args)),
  };
});

const { EModelEndpoint, parseCompactConvo } = require('librechat-data-provider');

const mockBuildOptions = jest.fn((...args) => {
  const hasReqArgument = typeof args[0] === 'object' && args[0] != null && 'body' in args[0];
  const endpoint = hasReqArgument ? args[1] : args[0];
  const parsedBody = hasReqArgument ? args[2] : args[1];

  return {
    ...parsedBody,
    endpoint,
  };
});

jest.mock('~/server/services/Endpoints/azureAssistants', () => ({
  buildOptions: mockBuildOptions,
}));
jest.mock('~/server/services/Endpoints/assistants', () => ({
  buildOptions: mockBuildOptions,
}));
jest.mock('~/server/services/Endpoints/agents', () => ({
  buildOptions: mockBuildOptions,
}));

jest.mock('~/models', () => ({
  updateFilesUsage: jest.fn(),
}));

const mockGetEndpointsConfig = jest.fn();
jest.mock('~/server/services/Config', () => ({
  getEndpointsConfig: (...args) => mockGetEndpointsConfig(...args),
}));

jest.mock('@librechat/api', () => ({
  handleError: jest.fn(),
}));

const buildEndpointOption = require('./buildEndpointOption');

const createReq = (body, config = {}, baseUrl = '/api/chat') => ({
  body,
  config,
  baseUrl,
});

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('buildEndpointOption - defaultParamsEndpoint parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should pass defaultParamsEndpoint to parseCompactConvo and preserve maxOutputTokens', async () => {
    mockGetEndpointsConfig.mockResolvedValue({
      AnthropicClaude: {
        type: EModelEndpoint.custom,
        customParams: {
          defaultParamsEndpoint: EModelEndpoint.anthropic,
        },
      },
    });

    const req = createReq(
      {
        endpoint: 'AnthropicClaude',
        endpointType: EModelEndpoint.custom,
        model: 'anthropic/claude-opus-4.5',
        temperature: 0.7,
        maxOutputTokens: 8192,
        topP: 0.9,
        maxContextTokens: 50000,
      },
      { modelSpecs: null },
    );

    await buildEndpointOption(req, createRes(), jest.fn());

    expect(parseCompactConvo).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultParamsEndpoint: EModelEndpoint.anthropic,
      }),
    );

    const parsedResult = parseCompactConvo.mock.results[0].value;
    expect(parsedResult.maxOutputTokens).toBe(8192);
    expect(parsedResult.topP).toBe(0.9);
    expect(parsedResult.temperature).toBe(0.7);
    expect(parsedResult.maxContextTokens).toBe(50000);
  });

  it('should strip maxOutputTokens when no defaultParamsEndpoint is configured', async () => {
    mockGetEndpointsConfig.mockResolvedValue({
      MyOpenRouter: {
        type: EModelEndpoint.custom,
      },
    });

    const req = createReq(
      {
        endpoint: 'MyOpenRouter',
        endpointType: EModelEndpoint.custom,
        model: 'gpt-4o',
        temperature: 0.7,
        maxOutputTokens: 8192,
        max_tokens: 4096,
      },
      { modelSpecs: null },
    );

    await buildEndpointOption(req, createRes(), jest.fn());

    expect(parseCompactConvo).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultParamsEndpoint: undefined,
      }),
    );

    const parsedResult = parseCompactConvo.mock.results[0].value;
    expect(parsedResult.maxOutputTokens).toBeUndefined();
    expect(parsedResult.max_tokens).toBe(4096);
    expect(parsedResult.temperature).toBe(0.7);
  });

  it('should strip bedrock region from custom endpoint without defaultParamsEndpoint', async () => {
    mockGetEndpointsConfig.mockResolvedValue({
      MyEndpoint: {
        type: EModelEndpoint.custom,
      },
    });

    const req = createReq(
      {
        endpoint: 'MyEndpoint',
        endpointType: EModelEndpoint.custom,
        model: 'gpt-4o',
        temperature: 0.7,
        region: 'us-east-1',
      },
      { modelSpecs: null },
    );

    await buildEndpointOption(req, createRes(), jest.fn());

    const parsedResult = parseCompactConvo.mock.results[0].value;
    expect(parsedResult.region).toBeUndefined();
    expect(parsedResult.temperature).toBe(0.7);
  });

  it('should pass defaultParamsEndpoint when re-parsing enforced model spec', async () => {
    mockGetEndpointsConfig.mockResolvedValue({
      AnthropicClaude: {
        type: EModelEndpoint.custom,
        customParams: {
          defaultParamsEndpoint: EModelEndpoint.anthropic,
        },
      },
    });

    const modelSpec = {
      name: 'claude-opus-4.5',
      preset: {
        endpoint: 'AnthropicClaude',
        endpointType: EModelEndpoint.custom,
        model: 'anthropic/claude-opus-4.5',
        temperature: 0.7,
        maxOutputTokens: 8192,
        maxContextTokens: 50000,
      },
    };

    const req = createReq(
      {
        endpoint: 'AnthropicClaude',
        endpointType: EModelEndpoint.custom,
        spec: 'claude-opus-4.5',
        model: 'anthropic/claude-opus-4.5',
      },
      {
        modelSpecs: {
          enforce: true,
          list: [modelSpec],
        },
      },
    );

    await buildEndpointOption(req, createRes(), jest.fn());

    const enforcedCall = parseCompactConvo.mock.calls[1];
    expect(enforcedCall[0]).toEqual(
      expect.objectContaining({
        defaultParamsEndpoint: EModelEndpoint.anthropic,
      }),
    );

    const enforcedResult = parseCompactConvo.mock.results[1].value;
    expect(enforcedResult.maxOutputTokens).toBe(8192);
    expect(enforcedResult.temperature).toBe(0.7);
    expect(enforcedResult.maxContextTokens).toBe(50000);
  });

  it('should fall back to OpenAI schema when getEndpointsConfig fails', async () => {
    mockGetEndpointsConfig.mockRejectedValue(new Error('Config unavailable'));

    const req = createReq(
      {
        endpoint: 'AnthropicClaude',
        endpointType: EModelEndpoint.custom,
        model: 'anthropic/claude-opus-4.5',
        temperature: 0.7,
        maxOutputTokens: 8192,
        max_tokens: 4096,
      },
      { modelSpecs: null },
    );

    await buildEndpointOption(req, createRes(), jest.fn());

    expect(parseCompactConvo).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultParamsEndpoint: undefined,
      }),
    );

    const parsedResult = parseCompactConvo.mock.results[0].value;
    expect(parsedResult.maxOutputTokens).toBeUndefined();
    expect(parsedResult.max_tokens).toBe(4096);
  });

  it('should enforce model spec and sync promptPrefix on agent route for custom endpoints', async () => {
    mockGetEndpointsConfig.mockResolvedValue({
      KYNS: {
        type: EModelEndpoint.custom,
      },
    });

    const modelSpec = {
      name: 'kyns',
      preset: {
        endpoint: 'KYNS',
        endpointType: EModelEndpoint.custom,
        model: 'llmfan46/Qwen3.5-27B-heretic-v2',
        promptPrefix: 'Fresh prompt from model spec',
      },
    };

    const req = createReq(
      {
        endpoint: 'KYNS',
        endpointType: EModelEndpoint.custom,
        spec: 'kyns',
        promptPrefix: 'Stale prompt from saved conversation',
      },
      {
        modelSpecs: {
          enforce: true,
          list: [modelSpec],
        },
      },
      '/api/agents/chat',
    );

    await buildEndpointOption(req, createRes(), jest.fn());

    expect(parseCompactConvo).toHaveBeenCalledTimes(2);
    expect(parseCompactConvo.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        conversation: expect.objectContaining({
          endpoint: 'KYNS',
          promptPrefix: 'Fresh prompt from model spec',
        }),
      }),
    );
    expect(req.body.promptPrefix).toBe('Fresh prompt from model spec');
  });

  it('should normalize legacy KYNSDeep requests to the KYNS endpoint', async () => {
    mockGetEndpointsConfig.mockResolvedValue({
      KYNS: {
        type: EModelEndpoint.custom,
      },
    });

    const modelSpec = {
      name: 'kyns-deep',
      preset: {
        endpoint: 'KYNS',
        endpointType: EModelEndpoint.custom,
        model: 'llmfan46/Qwen3.5-27B-heretic-v2',
        modelLabel: 'KYNS Deep',
      },
    };

    const req = createReq(
      {
        endpoint: 'KYNSDeep',
        endpointType: EModelEndpoint.custom,
        spec: 'kyns-deep',
      },
      {
        modelSpecs: {
          enforce: true,
          list: [modelSpec],
        },
      },
      '/api/agents/chat',
    );
    const next = jest.fn();

    await buildEndpointOption(req, createRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.body.endpoint).toBe('KYNS');
    expect(req.body.endpointOption.endpoint).toBe('KYNS');
  });

  it('should accept legacy KYNSDeep model spec endpoints when enforcing kyns-deep', async () => {
    mockGetEndpointsConfig.mockResolvedValue({
      KYNS: {
        type: EModelEndpoint.custom,
      },
    });

    const modelSpec = {
      name: 'kyns-deep',
      preset: {
        endpoint: 'KYNSDeep',
        endpointType: EModelEndpoint.custom,
        model: 'llmfan46/Qwen3.5-27B-heretic-v2',
        modelLabel: 'KYNS Deep',
      },
    };

    const req = createReq(
      {
        endpoint: 'KYNSDeep',
        endpointType: EModelEndpoint.custom,
        spec: 'kyns-deep',
      },
      {
        modelSpecs: {
          enforce: true,
          list: [modelSpec],
        },
      },
      '/api/agents/chat',
    );
    const next = jest.fn();

    await buildEndpointOption(req, createRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.body.endpoint).toBe('KYNS');
    expect(req.body.endpointOption.endpoint).toBe('KYNS');
  });

  it('should enable hidden thinking for the kyns-deep spec', async () => {
    mockGetEndpointsConfig.mockResolvedValue({
      KYNS: {
        type: EModelEndpoint.custom,
      },
    });

    const req = createReq(
      {
        endpoint: 'KYNS',
        endpointType: EModelEndpoint.custom,
        spec: 'kyns-deep',
        model: 'llmfan46/Qwen3.5-27B-heretic-v2',
      },
      { modelSpecs: null },
      '/api/agents/chat',
    );

    await buildEndpointOption(req, createRes(), jest.fn());

    expect(req.body.endpointOption.reasoning_effort).toBe('high');
    expect(req.body.endpointOption.chat_template_kwargs).toEqual({
      enable_thinking: true,
    });
  });
});
