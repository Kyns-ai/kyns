const { logger } = require('@librechat/data-schemas');

const RUNPOD_POD_HOST = '.proxy.runpod.net';
const DEFAULT_IDLE_TIMEOUT_MINUTES = 10;
const CHECK_INTERVAL_MS = 60 * 1000;
const IDLE_TIMEOUT_MS = getIdleTimeoutMs();

let activeChatRequests = 0;
let lastActivityAt = Date.now();
let stopInFlight = null;
let intervalStarted = false;

function getIdleTimeoutMs() {
  const rawMinutes = Number(process.env.RUNPOD_IDLE_TIMEOUT_MINUTES);
  if (!Number.isFinite(rawMinutes) || rawMinutes <= 0) {
    return DEFAULT_IDLE_TIMEOUT_MINUTES * 60 * 1000;
  }

  return rawMinutes * 60 * 1000;
}

function isRunpodPodUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }

  try {
    const url = new URL(value);
    return url.hostname.endsWith(RUNPOD_POD_HOST);
  } catch {
    return false;
  }
}

function shouldManageRunpodPodLifecycle(endpointOption, env = process.env) {
  if (!env.RUNPOD_API_KEY || !env.RUNPOD_POD_ID) {
    return false;
  }

  if (!isRunpodPodUrl(env.OPENAI_REVERSE_PROXY)) {
    return false;
  }

  return endpointOption?.endpoint === 'KYNS';
}

async function stopRunpodPod() {
  const res = await fetch(`https://rest.runpod.io/v1/pods/${process.env.RUNPOD_POD_ID}/stop`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RunPod stop failed: ${res.status} ${body}`);
  }
}

function startMonitor() {
  if (intervalStarted || !process.env.RUNPOD_POD_ID) {
    return;
  }

  intervalStarted = true;

  const timer = setInterval(async () => {
    if (activeChatRequests > 0) {
      return;
    }

    const idleForMs = Date.now() - lastActivityAt;
    if (idleForMs < IDLE_TIMEOUT_MS) {
      return;
    }

    if (stopInFlight != null) {
      return;
    }

    stopInFlight = stopRunpodPod()
      .then(() => {
        logger.info('[RunPodIdleStop] Pod stop requested after idle timeout', {
          idleForMs,
          timeoutMs: IDLE_TIMEOUT_MS,
          podId: process.env.RUNPOD_POD_ID,
        });
      })
      .catch((error) => {
        logger.error('[RunPodIdleStop] Failed to stop idle pod', error);
      })
      .finally(() => {
        stopInFlight = null;
        lastActivityAt = Date.now();
      });

    await stopInFlight;
  }, CHECK_INTERVAL_MS);

  timer.unref?.();
}

function trackRunpodChatActivity(endpointOption) {
  if (!shouldManageRunpodPodLifecycle(endpointOption)) {
    return () => {};
  }

  startMonitor();
  activeChatRequests += 1;
  lastActivityAt = Date.now();

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    activeChatRequests = Math.max(0, activeChatRequests - 1);
    lastActivityAt = Date.now();
  };
}

module.exports = {
  isRunpodPodUrl,
  trackRunpodChatActivity,
  shouldManageRunpodPodLifecycle,
};
