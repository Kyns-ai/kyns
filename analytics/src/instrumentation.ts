export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { ensureIndexes } = await import('./lib/mongodb')
  const { runCacheWorker } = await import('./workers/cache-worker')

  try {
    await ensureIndexes()
    console.log('[Analytics] MongoDB indexes ensured')
  } catch (err) {
    console.error('[Analytics] Failed to ensure indexes:', err)
  }

  runCacheWorker()
}
