import { getCollection } from './mongodb'

export async function logDashboardError(message: string, details?: Record<string, unknown>): Promise<void> {
  try {
    const col = await getCollection('kyns_error_logs')
    await col.insertOne({
      source: 'analytics_dashboard',
      level: 'error',
      message: String(message).slice(0, 1000),
      stack: null,
      metadata: details ?? null,
      createdAt: new Date(),
    })
  } catch {
    // Silent — avoid infinite error loops
  }
}
