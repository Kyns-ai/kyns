const { logger } = require('@librechat/data-schemas');
const { getAppConfig } = require('~/server/services/Config');

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstile(req, res, next) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    return next();
  }

  try {
    const appConfig = await getAppConfig();
    const siteKey = appConfig?.turnstileConfig?.siteKey;
    if (!siteKey) {
      return next();
    }
  } catch {
    return next();
  }

  const token = req.body?.turnstileToken;
  if (!token) {
    logger.warn('[verifyTurnstile] Missing CAPTCHA token');
    return res.status(400).json({ message: 'CAPTCHA verification required.' });
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: req.ip ?? '',
      }),
    });

    const result = await response.json();
    if (!result.success) {
      logger.warn('[verifyTurnstile] CAPTCHA verification failed', {
        codes: result['error-codes'],
      });
      return res.status(403).json({ message: 'CAPTCHA verification failed.' });
    }

    return next();
  } catch (error) {
    logger.error('[verifyTurnstile] Error contacting Cloudflare', error);
    return next();
  }
}

module.exports = verifyTurnstile;
