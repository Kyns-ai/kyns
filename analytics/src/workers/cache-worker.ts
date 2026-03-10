import { withRetry } from '../lib/mongodb'
import { getDAU, getWAU, getMAU, getRetentionRates, getCohortAnalysis, getEngagementStats } from '../lib/queries/retention'
import { getFeatureUsage, getFeatureRetentionCorrelation } from '../lib/queries/features'
import { getCharacterStats, getCharacterRetention } from '../lib/queries/characters'
import { getCostSummary } from '../lib/queries/cost'
import { getActivationFunnel, getTimeToFirstMessage, getActivationRate } from '../lib/queries/funnel'
import { getConversationStats, getTopFirstMessageWords, getMessageLengthDistribution } from '../lib/queries/behavior'
import { getWeeklyChurn } from '../lib/queries/growth'
import { getDailyErrorRate } from '../lib/queries/quality'

async function safeRun<T>(label: string, fn: () => Promise<T>): Promise<void> {
  try {
    await withRetry(fn)
  } catch (e) {
    console.error(`[CacheWorker] ${label} failed:`, e)
  }
}

async function runAllAggregations() {
  const start = Date.now()
  console.log('[CacheWorker] Starting aggregations...')

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
  ])

  console.log(`[CacheWorker] Done in ${Date.now() - start}ms`)
}

export function runCacheWorker() {
  setTimeout(async () => {
    await runAllAggregations()
    setInterval(() => {
      runAllAggregations().catch((e) => console.error('[CacheWorker] Error:', e))
    }, 5 * 60 * 1000)
  }, 10_000)
}
