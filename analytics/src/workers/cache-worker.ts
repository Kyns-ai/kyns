import { getDAU, getWAU, getMAU, getRetentionRates, getCohortAnalysis, getEngagementStats } from '../lib/queries/retention'
import { getFeatureUsage, getFeatureRetentionCorrelation } from '../lib/queries/features'
import { getCharacterStats, getCharacterRetention } from '../lib/queries/characters'
import { getCostSummary } from '../lib/queries/cost'
import { getActivationFunnel, getTimeToFirstMessage, getActivationRate } from '../lib/queries/funnel'
import { getConversationStats, getTopFirstMessageWords, getMessageLengthDistribution } from '../lib/queries/behavior'
import { getWeeklyChurn } from '../lib/queries/growth'
import { getDailyErrorRate } from '../lib/queries/quality'

async function runAllAggregations() {
  const start = Date.now()
  console.log('[CacheWorker] Starting aggregations...')

  const tasks = [
    getDAU(30).catch((e) => console.error('[CacheWorker] DAU failed:', e)),
    getDAU(90).catch((e) => console.error('[CacheWorker] DAU-90 failed:', e)),
    getWAU(12).catch((e) => console.error('[CacheWorker] WAU failed:', e)),
    getMAU(6).catch((e) => console.error('[CacheWorker] MAU failed:', e)),
    getRetentionRates().catch((e) => console.error('[CacheWorker] Retention failed:', e)),
    getCohortAnalysis().catch((e) => console.error('[CacheWorker] Cohort failed:', e)),
    getEngagementStats(7).catch((e) => console.error('[CacheWorker] Engagement failed:', e)),
    getFeatureUsage().catch((e) => console.error('[CacheWorker] Features failed:', e)),
    getFeatureRetentionCorrelation().catch((e) => console.error('[CacheWorker] Feature retention failed:', e)),
    getCharacterStats(30).catch((e) => console.error('[CacheWorker] Characters failed:', e)),
    getCharacterRetention(30).catch((e) => console.error('[CacheWorker] Char retention failed:', e)),
    getCostSummary(30).catch((e) => console.error('[CacheWorker] Cost failed:', e)),
    getActivationFunnel(30).catch((e) => console.error('[CacheWorker] Funnel failed:', e)),
    getTimeToFirstMessage().catch((e) => console.error('[CacheWorker] Time-to-first failed:', e)),
    getConversationStats(30).catch((e) => console.error('[CacheWorker] Convo stats failed:', e)),
    getTopFirstMessageWords().catch((e) => console.error('[CacheWorker] Words failed:', e)),
    getMessageLengthDistribution().catch((e) => console.error('[CacheWorker] Msg length failed:', e)),
    getWeeklyChurn(8).catch((e) => console.error('[CacheWorker] Churn failed:', e)),
    getDailyErrorRate(14).catch((e) => console.error('[CacheWorker] Error rate failed:', e)),
  ]

  await Promise.all(tasks)
  console.log(`[CacheWorker] Done in ${Date.now() - start}ms`)
}

export function runCacheWorker() {
  // Delay first run by 10s to let server warm up
  setTimeout(async () => {
    await runAllAggregations()
    // Refresh every 5 minutes
    setInterval(() => {
      runAllAggregations().catch((e) => console.error('[CacheWorker] Error:', e))
    }, 5 * 60 * 1000)
  }, 10_000)
}
