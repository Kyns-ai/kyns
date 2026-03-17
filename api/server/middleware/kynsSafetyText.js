const { scanTextForKynsPolicy } = require('~/server/services/safety/kynsPlatform');

function kynsSafetyText(req, _res, next) {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  req.kynsSafetyBlock = scanTextForKynsPolicy(text);
  next();
}

module.exports = kynsSafetyText;
