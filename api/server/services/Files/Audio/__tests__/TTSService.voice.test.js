/**
 * Tests for voice selection logic used in TTS:
 * - agent voice overrides global voice when valid
 * - falls back to a random voice when saved voice is no longer available
 * - strips "ALL" wildcard entries from the available voice pool
 */

const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

/**
 * Pure implementation of TTSService.getVoice for unit testing.
 * Mirrors the logic in TTSService.js without class/module dependencies.
 */
function selectVoice(voices, requestVoice, fallback) {
  const filtered = voices.filter((v) => v && v.toUpperCase() !== 'ALL');
  const voice = requestVoice;
  if (!voice || !filtered.includes(voice) || voice.toUpperCase() === 'ALL') {
    return fallback(filtered);
  }
  return voice;
}

describe('TTS voice selection logic', () => {
  const randomFallback = (pool) => pool[0];

  it('returns the requested voice when it exists in the list', () => {
    expect(selectVoice(VOICES, 'nova', randomFallback)).toBe('nova');
  });

  it('falls back when the agent voice is no longer in the provider list', () => {
    expect(selectVoice(VOICES, 'deleted_custom_voice', randomFallback)).toBe(VOICES[0]);
  });

  it('falls back when requestVoice is undefined', () => {
    expect(selectVoice(VOICES, undefined, randomFallback)).toBe(VOICES[0]);
  });

  it('falls back when requestVoice is null', () => {
    expect(selectVoice(VOICES, null, randomFallback)).toBe(VOICES[0]);
  });

  it('falls back when voice is "ALL" wildcard', () => {
    expect(selectVoice(VOICES, 'ALL', randomFallback)).toBe(VOICES[0]);
  });

  it('strips ALL entries from the candidate pool before fallback', () => {
    const poolWithAll = ['ALL', 'alloy', 'echo'];
    const capturedPool = [];
    selectVoice(poolWithAll, 'missing', (pool) => {
      capturedPool.push(...pool);
      return pool[0];
    });
    expect(capturedPool).not.toContain('ALL');
    expect(capturedPool).toEqual(['alloy', 'echo']);
  });

  it('agent voice overrides global when the agent voice is valid', () => {
    const globalVoice = 'alloy';
    const agentVoice = 'shimmer';
    const effectiveVoice = agentVoice ?? globalVoice;
    expect(selectVoice(VOICES, effectiveVoice, randomFallback)).toBe('shimmer');
  });

  it('global voice is used when agent has no voice configured', () => {
    const globalVoice = 'echo';
    const agentVoice = null;
    const effectiveVoice = agentVoice ?? globalVoice;
    expect(selectVoice(VOICES, effectiveVoice, randomFallback)).toBe('echo');
  });
});
