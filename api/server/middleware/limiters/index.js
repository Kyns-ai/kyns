const createTTSLimiters = require('./ttsLimiters');
const createSTTLimiters = require('./sttLimiters');

const { loginLimiter, loginAccountLimiter } = require('./loginLimiter');
const importLimiters = require('./importLimiters');
const uploadLimiters = require('./uploadLimiters');
const forkLimiters = require('./forkLimiters');
const registerLimiter = require('./registerLimiter');
const toolCallLimiter = require('./toolCallLimiter');
const messageLimiters = require('./messageLimiters');
const verifyEmailLimiter = require('./verifyEmailLimiter');
const resetPasswordLimiter = require('./resetPasswordLimiter');
const verifyTempTwoFactorLimiter = require('./verifyTempTwoFactorLimiter');

module.exports = {
  ...uploadLimiters,
  ...importLimiters,
  ...messageLimiters,
  ...forkLimiters,
  loginLimiter,
  loginAccountLimiter,
  registerLimiter,
  toolCallLimiter,
  createTTSLimiters,
  createSTTLimiters,
  verifyEmailLimiter,
  resetPasswordLimiter,
  verifyTempTwoFactorLimiter,
};
