export function safeParseSSEData<T>(data: string | null | undefined, eventName: string): T | null {
  if (typeof data !== 'string') {
    console.error(`[useSSE] Missing ${eventName} event payload`);
    return null;
  }

  try {
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`[useSSE] Failed to parse ${eventName} event payload`, error);
    return null;
  }
}
