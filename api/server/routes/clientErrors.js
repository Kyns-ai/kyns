const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const COLLECTION_NAME = 'kyns_error_logs';

const router = express.Router();

const clientErrorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: false,
  legacyHeaders: false,
});

router.post('/', clientErrorLimiter, (req, res) => {
  const { message, stack, source, url, userAgent, componentStack } = req.body ?? {};

  if (typeof message !== 'string' || message.length === 0) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const db = mongoose.connection?.db;
    if (db) {
      db.collection(COLLECTION_NAME).insertOne({
        source: 'frontend',
        level: 'error',
        message: String(message).slice(0, 1000),
        stack: typeof stack === 'string' ? stack.slice(0, 3000) : null,
        metadata: {
          frontendSource: typeof source === 'string' ? source.slice(0, 500) : null,
          url: typeof url === 'string' ? url.slice(0, 500) : null,
          userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 300) : null,
          componentStack: typeof componentStack === 'string' ? componentStack.slice(0, 2000) : null,
        },
        userId: req.user?.id ?? null,
        createdAt: new Date(),
      }).catch(() => {});
    }
  } catch {
    // Silent — never fail on error reporting
  }

  res.status(204).end();
});

module.exports = router;
