const rateLimit = require('express-rate-limit');
const { limiterCache } = require('@librechat/api');
const { removePorts } = require('~/server/utils');

const {
  VERIFY_TEMP_2FA_WINDOW = 5,
  VERIFY_TEMP_2FA_MAX = 10,
} = process.env;

const windowMs = VERIFY_TEMP_2FA_WINDOW * 60 * 1000;
const max = VERIFY_TEMP_2FA_MAX;
const windowInMinutes = windowMs / 60000;
const message = `Too many 2FA attempts, please try again after ${windowInMinutes} minute(s).`;

const verifyTempTwoFactorLimiter = rateLimit({
  windowMs,
  max,
  handler: (_req, res) => res.status(429).json({ message }),
  keyGenerator: removePorts,
  store: limiterCache('verify_temp_2fa_limiter'),
});

module.exports = verifyTempTwoFactorLimiter;
