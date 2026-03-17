import { getCollection } from '../mongodb'

export interface PlatformConfig {
  freeLimits: { messagesPerDay: number; imagesPerDay: number; deepPerDay: number }
  welcomeMessage: string
  termsOfUse: string
  privacyPolicy: string
  maintenanceMode: boolean
  maintenanceMessage: string
  openRegistration: boolean
  nsfwEnabled: boolean
  watermark: { enabled: boolean; text: string; position: string; opacity: number }
  alertWebhook: string
  alertEmail: string
  alertThresholds: {
    errorRatePercent: number
    dailyCostUsd: number
    notifyOnSignup: boolean
    notifyOnThinkingLeak: boolean
  }
}

const DEFAULTS: PlatformConfig = {
  freeLimits: { messagesPerDay: 30, imagesPerDay: 5, deepPerDay: 3 },
  welcomeMessage: 'Bem-vindo ao KYNS!',
  termsOfUse: '',
  privacyPolicy: '',
  maintenanceMode: false,
  maintenanceMessage: 'O sistema está em manutenção. Voltamos em breve!',
  openRegistration: true,
  nsfwEnabled: true,
  watermark: { enabled: false, text: 'KYNS.ai', position: 'bottom-right', opacity: 0.5 },
  alertWebhook: '',
  alertEmail: '',
  alertThresholds: {
    errorRatePercent: 5,
    dailyCostUsd: 10,
    notifyOnSignup: false,
    notifyOnThinkingLeak: true,
  },
}

export async function getAllConfig(): Promise<PlatformConfig> {
  const col = await getCollection<{ key: string; value: unknown }>('kyns_config')
  const docs = await col.find({}).toArray()
  const map = new Map(docs.map((d) => [d.key, d.value]))

  const result: PlatformConfig = { ...DEFAULTS }
  for (const [key, value] of map.entries()) {
    (result as Record<keyof PlatformConfig, unknown>)[key as keyof PlatformConfig] = value
  }
  return result
}

export async function setConfigKey(key: string, value: unknown): Promise<void> {
  const col = await getCollection('kyns_config')
  await col.updateOne(
    { key },
    { $set: { key, value, updatedAt: new Date() } },
    { upsert: true }
  )
}

export async function updateConfig(updates: Partial<PlatformConfig>): Promise<void> {
  await Promise.all(
    Object.entries(updates).map(([key, value]) => setConfigKey(key, value))
  )
}

export async function getConfigKey<T>(key: keyof PlatformConfig): Promise<T> {
  const col = await getCollection<{ key: string; value: T }>('kyns_config')
  const doc = await col.findOne({ key })
  if (doc) return doc.value
  return (DEFAULTS as Record<keyof PlatformConfig, unknown>)[key] as T
}
