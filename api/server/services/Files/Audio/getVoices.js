const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const { TTSProviders, extractEnvVariable } = require('librechat-data-provider');
const { getAppConfig } = require('~/server/services/Config');
const { getProvider } = require('./TTSService');

const OPENAI_DEFAULT_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

/**
 * When the provider exposes a custom /voices endpoint (e.g. Chatterbox), query it
 * and merge any uploaded custom voices with the OpenAI-compatible defaults.
 * @param {string} baseUrl
 * @param {string | undefined} apiKey
 * @returns {Promise<string[]>}
 */
async function fetchRemoteVoices(baseUrl, apiKey) {
  try {
    const origin = new URL(baseUrl).origin;
    const headers = {};
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const { data } = await axios.get(`${origin}/voices`, { headers, timeout: 5000 });
    const remoteNames = (data?.voices ?? []).map((v) => v.name ?? v).filter(Boolean);
    return [...new Set([...OPENAI_DEFAULT_VOICES, ...remoteNames])];
  } catch {
    return OPENAI_DEFAULT_VOICES;
  }
}

/**
 * Retrieves the available voices for the current TTS provider.
 * When voices is configured as ['ALL'], resolves to real voice names from
 * the provider, falling back to standard OpenAI voice identifiers.
 * @param {Object} req
 * @param {Object} res
 */
async function getVoices(req, res) {
  try {
    const appConfig =
      req.config ??
      (await getAppConfig({
        role: req.user?.role,
      }));

    const ttsSchema = appConfig?.speech?.tts;
    if (!ttsSchema) {
      throw new Error('Configuration or TTS schema is missing');
    }

    const provider = await getProvider(appConfig);
    let voices;

    switch (provider) {
      case TTSProviders.OPENAI:
        voices = ttsSchema.openai?.voices;
        break;
      case TTSProviders.AZURE_OPENAI:
        voices = ttsSchema.azureOpenAI?.voices;
        break;
      case TTSProviders.ELEVENLABS:
        voices = ttsSchema.elevenlabs?.voices;
        break;
      case TTSProviders.LOCALAI:
        voices = ttsSchema.localai?.voices;
        break;
      default:
        throw new Error('Invalid provider');
    }

    const isAllOnly =
      Array.isArray(voices) && voices.length === 1 && voices[0].toUpperCase() === 'ALL';

    if (isAllOnly) {
      const providerSchema = ttsSchema[provider];
      const url = providerSchema?.url;
      const apiKey = providerSchema?.apiKey ? extractEnvVariable(providerSchema.apiKey) : undefined;
      voices = url ? await fetchRemoteVoices(url, apiKey) : OPENAI_DEFAULT_VOICES;
      logger.debug(`[getVoices] Resolved ALL to ${voices.length} voices from ${provider}`);
    } else {
      voices = Array.isArray(voices)
        ? [...new Set(voices.filter((v) => v && v.toUpperCase() !== 'ALL'))]
        : [];
    }

    res.json(voices);
  } catch (error) {
    res.status(500).json({ error: `Failed to get voices: ${error.message}` });
  }
}

module.exports = getVoices;
