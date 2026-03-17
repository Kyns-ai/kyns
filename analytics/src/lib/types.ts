export interface MongoUser {
  name?: string
  email?: string
  provider?: string
  createdAt: Date
  updatedAt?: Date
  expiresAt?: Date
  role?: string
  emailVerified?: boolean
  [key: string]: unknown
}

export interface MongoMessage {
  messageId?: string
  conversationId?: string
  user?: string
  text?: string
  isCreatedByUser?: boolean
  endpoint?: string
  model?: string
  error?: boolean
  createdAt?: Date
  files?: unknown[]
  attachments?: unknown[]
  [key: string]: unknown
}

export interface MongoConversation {
  conversationId?: string
  user?: string
  endpoint?: string
  model?: string
  agent_id?: string
  chatGptLabel?: string
  createdAt?: Date
  isArchived?: boolean
  [key: string]: unknown
}

export interface MongoTransaction {
  user?: unknown
  conversationId?: string
  messageId?: string
  tokenType?: string
  model?: string
  rawAmount?: number
  tokenValue?: number
  rate?: number
  createdAt?: Date
  [key: string]: unknown
}

export interface MongoAgent {
  id: string
  name: string
  [key: string]: unknown
}
