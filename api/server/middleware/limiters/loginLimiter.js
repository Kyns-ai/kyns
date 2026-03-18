const rateLimit = require('express-rate-limit');
const { limiterCache } = require('@librechat/api');
const { ViolationTypes } = require('librechat-data-provider');
const { removePorts } = require('~/server/utils');
const { logViolation } = require('~/cache');

const { LOGIN_WINDOW = 5, LOGIN_MAX = 7, LOGIN_VIOLATION_SCORE: score } = process.env;
const windowMs = LOGIN_WINDOW * 60 * 1000;
const max = LOGIN_MAX;
const windowInMinutes = windowMs / 60000;
const message = `Too many login attempts, please try again after ${windowInMinutes} minutes.`;

const handler = async (req, res) => {
  const type = ViolationTypes.LOGINS;
  const errorMessage = {
    type,
    max,
    windowInMinutes,
  };

  await logViolation(req, res, type, errorMessage, score);
  return res.status(429).json({ message });
};

const loginLimiter = rateLimit({
  windowMs,
  max,
  handler,
  keyGenerator: removePorts,
  store: limiterCache('login_limiter'),
});

const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email || removePorts(req);
  },
  store: limiterCache('login_account_limiter'),
  handler: (_req, res) =>
    res.status(429).json({ message: 'Too many attempts for this account. Try again later.' }),
});

module.exports = { loginLimiter, loginAccountLimiter };
