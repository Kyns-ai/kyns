const {
  KYNS_PROJECT_PAUSED_REASON,
  scanRequestWithContext,
} = require('~/server/services/safety/kynsPlatform');

function kynsSafetyText(req, _res, next) {
  if (process.env.KYNS_PROJECT_PAUSED !== 'false') {
    req.kynsSafetyBlock = { blocked: true, reason: KYNS_PROJECT_PAUSED_REASON };
    next();
    return;
  }

  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  req.kynsSafetyBlock = scanRequestWithContext(text, messages);
  next();
}

module.exports = kynsSafetyText;
