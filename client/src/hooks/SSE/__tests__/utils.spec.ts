import { safeParseSSEData } from '../utils';

describe('safeParseSSEData', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns parsed data for valid JSON payloads', () => {
    const result = safeParseSSEData<{ text: string }>('{"text":"ok"}', 'message');

    expect(result).toEqual({ text: 'ok' });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('returns null for invalid JSON payloads without throwing', () => {
    expect(() => safeParseSSEData('{', 'message')).not.toThrow();
    expect(safeParseSSEData('{', 'message')).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('returns null when the payload is missing', () => {
    expect(safeParseSSEData(undefined, 'message')).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
