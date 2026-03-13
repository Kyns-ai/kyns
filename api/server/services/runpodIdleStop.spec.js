const {
  isRunpodPodUrl,
  shouldManageRunpodPodLifecycle,
} = require('./runpodIdleStop');

describe('runpodIdleStop', () => {
  test('detects RunPod pod proxy urls', () => {
    expect(isRunpodPodUrl('https://abc123-8000.proxy.runpod.net/v1')).toBe(true);
  });

  test('does not treat RunPod serverless url as pod url', () => {
    expect(isRunpodPodUrl('https://api.runpod.ai/v2/endpoint/openai/v1')).toBe(false);
  });

  test('only manages KYNS lifecycle when pod env is configured', () => {
    const env = {
      RUNPOD_API_KEY: 'rpa_test',
      RUNPOD_POD_ID: 'pod-123',
      OPENAI_REVERSE_PROXY: 'https://abc123-8000.proxy.runpod.net/v1',
    };

    expect(shouldManageRunpodPodLifecycle({ endpoint: 'KYNS' }, env)).toBe(true);
    expect(shouldManageRunpodPodLifecycle({ endpoint: 'KYNSImage' }, env)).toBe(false);
  });

  test('does not manage lifecycle without pod configuration', () => {
    const env = {
      RUNPOD_API_KEY: 'rpa_test',
      OPENAI_REVERSE_PROXY: 'https://api.runpod.ai/v2/endpoint/openai/v1',
    };

    expect(shouldManageRunpodPodLifecycle({ endpoint: 'KYNS' }, env)).toBe(false);
  });
});
