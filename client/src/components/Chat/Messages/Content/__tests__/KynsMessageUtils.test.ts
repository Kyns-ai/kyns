import { isKynsDeepMessage } from '../KynsMessageUtils';

describe('isKynsDeepMessage', () => {
  it('detects the deep spec even when the endpoint is KYNS', () => {
    expect(
      isKynsDeepMessage({
        endpoint: 'KYNS',
        spec: 'kyns-deep',
      }),
    ).toBe(true);
  });

  it('detects legacy KYNSDeep conversations without a spec', () => {
    expect(
      isKynsDeepMessage({
        endpoint: 'KYNSDeep',
      }),
    ).toBe(true);
  });

  it('does not mark normal KYNS messages as deep', () => {
    expect(
      isKynsDeepMessage({
        endpoint: 'KYNS',
        spec: 'kyns',
        sender: 'KYNS',
      }),
    ).toBe(false);
  });
});
