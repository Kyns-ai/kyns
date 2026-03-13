import { Schema } from 'mongoose';
import type { IMemoryEntry } from '~/types/memory';

const MemoryEntrySchema: Schema<IMemoryEntry> = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true,
  },
  scope: {
    type: String,
    enum: ['user', 'agent'],
    default: 'user',
    required: true,
  },
  agentId: {
    type: String,
    default: '',
  },
  key: {
    type: String,
    required: true,
    validate: {
      validator: (v: string) => /^[a-z_]+$/.test(v),
      message: 'Key must only contain lowercase letters and underscores',
    },
  },
  value: {
    type: String,
    required: true,
  },
  tokenCount: {
    type: Number,
    default: 0,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

MemoryEntrySchema.index(
  { userId: 1, scope: 1, agentId: 1, key: 1 },
  { unique: true, name: 'memory_scope_key_unique' },
);

export default MemoryEntrySchema;
