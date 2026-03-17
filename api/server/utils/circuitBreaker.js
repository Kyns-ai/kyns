const { logger } = require('@librechat/data-schemas');

const STATE_CLOSED = 'CLOSED';
const STATE_OPEN = 'OPEN';
const STATE_HALF_OPEN = 'HALF_OPEN';

class CircuitBreaker {
  constructor({ name, failureThreshold = 5, resetTimeoutMs = 60_000 }) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.state = STATE_CLOSED;
    this.failures = 0;
    this.lastFailureTime = 0;
  }

  isOpen() {
    if (this.state === STATE_OPEN) {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = STATE_HALF_OPEN;
        logger.info(`[CircuitBreaker:${this.name}] Half-open — allowing probe request`);
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess() {
    if (this.state === STATE_HALF_OPEN) {
      logger.info(`[CircuitBreaker:${this.name}] Probe succeeded — closing circuit`);
    }
    this.failures = 0;
    this.state = STATE_CLOSED;
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = STATE_OPEN;
      logger.warn(
        `[CircuitBreaker:${this.name}] Circuit opened after ${this.failures} failures — blocking requests for ${this.resetTimeoutMs / 1000}s`,
      );
    }
  }

  getState() {
    return this.state;
  }
}

const runpodCircuit = new CircuitBreaker({
  name: 'RunPod',
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
});

module.exports = { CircuitBreaker, runpodCircuit };
