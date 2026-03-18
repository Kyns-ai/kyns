const { scanRequestWithContext } = require('~/server/services/safety/kynsPlatform');

function kynsSafetyText(req, _res, next) {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  req.kynsSafetyBlock = scanRequestWithContext(text, messages);
  next();
}

module.exports = kynsSafetyText;
