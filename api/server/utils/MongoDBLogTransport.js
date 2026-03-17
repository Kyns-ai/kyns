const Transport = require('winston-transport');
const os = require('os');

const COLLECTION_NAME = 'kyns_error_logs';
const STACK_MAX_LENGTH = 3000;
const MESSAGE_MAX_LENGTH = 1000;

class MongoDBLogTransport extends Transport {
  constructor(opts = {}) {
    super(opts);
    this._getDb = opts.getDb || null;
  }

  log(info, callback) {
    setImmediate(() => this.emit('logged', info));

    try {
      const db = this._getDb?.();
      if (!db) {
        return callback();
      }

      const stack = typeof info.stack === 'string'
        ? info.stack.slice(0, STACK_MAX_LENGTH)
        : null;

      const { level, message, timestamp, stack: _s, ...rest } = info;

      const metadata = Object.keys(rest).length > 0 ? rest : null;

      db.collection(COLLECTION_NAME).insertOne({
        source: 'backend',
        level: String(level),
        message: String(message || '').slice(0, MESSAGE_MAX_LENGTH),
        stack,
        metadata,
        hostname: os.hostname(),
        pid: process.pid,
        createdAt: new Date(),
      }).catch(() => {});
    } catch {
      // Never let logging break the application
    }

    callback();
  }
}

module.exports = MongoDBLogTransport;
