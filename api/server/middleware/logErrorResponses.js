const mongoose = require('mongoose');

const COLLECTION_NAME = 'kyns_error_logs';

/**
 * Middleware that logs HTTP 4xx/5xx responses to MongoDB for the analytics dashboard.
 * Follows the same non-blocking pattern as trackResponseTime.js.
 * Only tracks /api/ routes.
 */
const logErrorResponses = (req, res, next) => {
  if (!req.url.startsWith('/api/')) {
    return next();
  }

  const onFinish = () => {
    res.removeListener('finish', onFinish);
    res.removeListener('close', onFinish);

    if (res.statusCode < 400) {
      return;
    }

    const path = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : req.url.split('?')[0].replace(/[a-f0-9]{24}/g, ':id');

    try {
      const db = mongoose.connection?.db;
      if (db) {
        db.collection(COLLECTION_NAME).insertOne({
          source: 'backend_http',
          level: res.statusCode >= 500 ? 'error' : 'warn',
          message: `HTTP ${res.statusCode} ${req.method} ${path}`,
          httpStatus: res.statusCode,
          httpMethod: req.method,
          path,
          userId: req.user?.id ?? req.user?._id ?? null,
          ip: req.ip ?? null,
          createdAt: new Date(),
        }).catch(() => {});
      }
    } catch {
      // Never let analytics tracking break a request
    }
  };

  res.on('finish', onFinish);
  res.on('close', onFinish);
  next();
};

module.exports = logErrorResponses;
