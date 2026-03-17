import { connectDb, withRetry, getCollection } from '../lib/mongodb'
import { getDAU, getWAU, getMAU, getRetentionRates, getCohortAnalysis, getEngagementStats } from '../lib/queries/retention'
import { getFeatureUsage, getFeatureRetentionCorrelation } from '../lib/queries/features'
import { getCharacterStats, getCharacterRetention } from '../lib/queries/characters'
import { getCostSummary } from '../lib/queries/cost'
import { getActivationFunnel, getTimeToFirstMessage, getActivationRate } from '../lib/queries/funnel'
import { getConversationStats, getTopFirstMessageWords, getMessageLengthDistribution } from '../lib/queries/behavior'
import { getWeeklyChurn } from '../lib/queries/growth'
import { getDailyErrorRate } from '../lib/queries/quality'
import { getErrorLogStats } from '../lib/queries/error-logs'
import { getInfrastructureStatus, logUptimeCheck } from '../lib/queries/admin-infrastructure'

async function safeRun<T>(label: string, fn: () => Promise<T>): Promise<void> {
  try {
    await withRetry(fn)
  } catch (e) {
    console.error(`[CacheWorker] ${label} failed:`, (e as Error).message ?? e)
  }
}

async function runAllAggregations() {
  const start = Date.now()
  console.log('[CacheWorker] Starting aggregations...')

  try {
    await connectDb()
    console.log('[CacheWorker] MongoDB connected')
  } catch (e) {
    console.error('[CacheWorker] MongoDB connection failed:', (e as Error).message)
    return
  }

  await safeRun('Uptime', async () => {
    const infra = await getInfrastructureStatus()
    for (const ep of infra.endpoints) {
      await logUptimeCheck(ep.name, ep.status === 'online', ep.latencyMs)
    }
  })

  await Promise.all([
    safeRun('DAU', () => getDAU(30)),
    safeRun('DAU-90', () => getDAU(90)),
    safeRun('WAU', () => getWAU(12)),
    safeRun('MAU', () => getMAU(6)),
    safeRun('Retention', () => getRetentionRates()),
    safeRun('Cohort', () => getCohortAnalysis()),
    safeRun('Engagement', () => getEngagementStats(7)),
    safeRun('Features', () => getFeatureUsage()),
    safeRun('Feature retention', () => getFeatureRetentionCorrelation()),
    safeRun('Characters', () => getCharacterStats(30)),
    safeRun('Char retention', () => getCharacterRetention(30)),
    safeRun('Cost', () => getCostSummary(30)),
    safeRun('Funnel', () => getActivationFunnel(30)),
    safeRun('Time-to-first', () => getTimeToFirstMessage()),
    safeRun('Activation', () => getActivationRate(30)),
    safeRun('Convo stats', () => getConversationStats(30)),
    safeRun('Words', () => getTopFirstMessageWords()),
    safeRun('Msg length', () => getMessageLengthDistribution()),
    safeRun('Churn', () => getWeeklyChurn(8)),
    safeRun('Error rate', () => getDailyErrorRate(14)),
    safeRun('Error log stats', () => getErrorLogStats()),
  ])

  await safeRun('Alerts', checkAndSendAlerts)

  console.log(`[CacheWorker] Done in ${Date.now() - start}ms`)
}

async function checkAndSendAlerts(): Promise<void> {
  const col = await getCollection<{ key: string; value: unknown }>('kyns_config')
  const webhookDoc = await col.findOne({ key: 'alertWebhook' })
  const webhook = webhookDoc?.value as string | undefined
  if (!webhook || webhook.trim() === '') return

  const threshDoc = await col.findOne({ key: 'alertThresholds' })
  const thresholds = (threshDoc?.value ?? {}) as {
    errorRatePercent?: number
    dailyCostUsd?: number
    notifyOnThinkingLeak?: boolean
  }

  const alerts: string[] = []

  const messages = await getCollection('messages')
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 3600_000)
  const [totalMsgs, errorMsgs] = await Promise.all([
    messages.countDocuments({ createdAt: { $gte: oneDayAgo }, isCreatedByUser: false }),
    messages.countDocuments({ createdAt: { $gte: oneDayAgo }, isCreatedByUser: false, error: true }),
  ])

  if (totalMsgs > 0 && thresholds.errorRatePercent) {
    const errorRate = (errorMsgs / totalMsgs) * 100
    if (errorRate > thresholds.errorRatePercent) {
      alerts.push(`Error rate: ${errorRate.toFixed(1)}% (threshold: ${thresholds.errorRatePercent}%)`)
    }
  }

  if (thresholds.notifyOnThinkingLeak) {
    const leaks = await messages.countDocuments({
      createdAt: { $gte: oneDayAgo },
      isCreatedByUser: false,
      text: { $regex: '<think>|</think>|Thinking Process:', $options: 'i' },
    })
    if (leaks > 0) {
      alerts.push(`Thinking leaks detected: ${leaks} in last 24h`)
    }
  }

  if (alerts.length === 0) return

  const body = {
    text: `KYNS Alert: ${alerts.join(' | ')}`,
    embeds: [{
      title: 'KYNS Analytics Alert',
      description: alerts.map((a) => `- ${a}`).join('\n'),
      color: 0xef4444,
      timestamp: now.toISOString(),
    }],
  }

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error(`[Alerts] Webhook failed: ${res.status}`)
    }
  } catch (e) {
    console.error('[Alerts] Webhook error:', (e as Error).message)
  }
}

export function runCacheWorker() {
  setTimeout(async () => {
    await runAllAggregations()
    setInterval(() => {
      runAllAggregations().catch((e) => console.error('[CacheWorker] Error:', e))
    }, 5 * 60 * 1000)
  }, 15_000)
}
