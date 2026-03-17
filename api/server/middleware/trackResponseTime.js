const mongoose = require('mongoose');

/**
 * Middleware that tracks API response times and stores them in MongoDB
 * for analytics dashboards. Only tracks /api/ routes.
 * Non-blocking — failures are silently ignored to avoid impacting requests.
 */
const trackResponseTime = (req, res, next) => {
  if (!req.url.startsWith('/api/')) {
    return next();
  }

  const start = Date.now();

  const onFinish = () => {
    res.removeListener('finish', onFinish);
    res.removeListener('close', onFinish);

    const durationMs = Date.now() - start;

    // Only track requests that take meaningful time (skip health checks etc.)
    if (durationMs < 5) {
      return;
    }

    // Normalize path: remove IDs to group similar endpoints
    const path = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : req.url.split('?')[0].replace(/[a-f0-9]{24}/g, ':id');

    const record = {
      path,
      method: req.method,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?.id ?? req.user?._id ?? null,
      createdAt: new Date(),
    };

    try {
      const db = mongoose.connection?.db;
      if (db) {
        db.collection('kyns_response_times').insertOne(record).catch(() => {});
      }
    } catch {
      // Never let analytics tracking break a request
    }
  };

  res.on('finish', onFinish);
  res.on('close', onFinish);
  next();
};

module.exports = trackResponseTime;
