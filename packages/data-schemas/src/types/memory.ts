import type { Types, Document } from 'mongoose';

export type MemoryScope = 'user' | 'agent';

// Base memory interfaces
export interface IMemoryEntry extends Document {
  userId: Types.ObjectId;
  scope: MemoryScope;
  agentId?: string;
  key: string;
  value: string;
  tokenCount?: number;
  updated_at?: Date;
}

export interface IMemoryEntryLean {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  scope: MemoryScope;
  agentId?: string;
  key: string;
  value: string;
  tokenCount?: number;
  updated_at?: Date;
  __v?: number;
}

interface MemoryScopeParams {
  scope?: MemoryScope;
  agentId?: string | null;
}

// Method parameter interfaces
export interface SetMemoryParams extends MemoryScopeParams {
  userId: string | Types.ObjectId;
  key: string;
  value: string;
  tokenCount?: number;
}

export interface DeleteMemoryParams extends MemoryScopeParams {
  userId: string | Types.ObjectId;
  key: string;
}

export interface GetFormattedMemoriesParams extends MemoryScopeParams {
  userId: string | Types.ObjectId;
  includeUserScope?: boolean;
}

// Result interfaces
export interface MemoryResult {
  ok: boolean;
}

export interface FormattedMemoriesResult {
  withKeys: string;
  withoutKeys: string;
  totalTokens?: number;
}
