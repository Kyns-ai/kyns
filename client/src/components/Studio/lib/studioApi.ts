import axios from 'axios';

const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 600000;

export async function submitJob(
  endpoint: string,
  params: Record<string, string | number | boolean>,
): Promise<string> {
  const resp = await axios.post(
    '/api/studio/generate',
    { endpoint, params },
    { timeout: 30000 },
  );
  return resp.data.requestId;
}

export async function pollResult(
  requestId: string,
): Promise<{ status: string; output?: Record<string, string> }> {
  const resp = await axios.get(`/api/studio/status/${requestId}`, { timeout: 20000 });
  return resp.data;
}

export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await axios.post('/api/studio/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return resp.data.fileUrl;
}

export async function generateAndPoll(
  endpoint: string,
  params: Record<string, string | number | boolean>,
  onStatusChange?: (status: string) => void,
): Promise<Record<string, string>> {
  const requestId = await submitJob(endpoint, params);
  onStatusChange?.('processing');
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    const result = await pollResult(requestId);
    onStatusChange?.(result.status);
    if (result.status === 'completed' && result.output) {
      return result.output;
    }
    if (result.status === 'failed') {
      throw new Error(result.output?.error ?? 'Generation failed');
    }
  }
  throw new Error('Timeout: generation took more than 10 minutes');
}
