import { Types } from 'mongoose';
import logger from '~/config/winston';
import type * as t from '~/types';

const USER_SCOPE: t.MemoryScope = 'user';
const AGENT_SCOPE: t.MemoryScope = 'agent';

/**
 * Formats a date in YYYY-MM-DD format
 */
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

function resolveMemoryScope({
  scope,
  agentId,
}: {
  scope?: t.MemoryScope;
  agentId?: string | null;
}): { scope: t.MemoryScope; agentId: string } {
  if (scope === AGENT_SCOPE && agentId?.trim()) {
    return {
      scope: AGENT_SCOPE,
      agentId: agentId.trim(),
    };
  }

  return {
    scope: USER_SCOPE,
    agentId: '',
  };
}

function buildMemoryQuery({
  userId,
  key,
  scope,
  agentId,
}: {
  userId: string | Types.ObjectId;
  key?: string;
  scope?: t.MemoryScope;
  agentId?: string | null;
}) {
  const resolvedScope = resolveMemoryScope({ scope, agentId });
  if (resolvedScope.scope === USER_SCOPE) {
    const query: {
      userId: string | Types.ObjectId;
      key?: string;
      $or: Array<Record<string, unknown>>;
    } = {
      userId,
      $or: [{ scope: USER_SCOPE, agentId: '' }, { scope: { $exists: false } }],
    };

    if (key != null) {
      query.key = key;
    }

    return query;
  }

  const query: {
    userId: string | Types.ObjectId;
    scope: t.MemoryScope;
    agentId: string;
    key?: string;
  } = {
    userId,
    scope: resolvedScope.scope,
    agentId: resolvedScope.agentId,
  };

  if (key != null) {
    query.key = key;
  }

  return query;
}

function buildMemoryDocument({
  userId,
  key,
  scope,
  agentId,
}: {
  userId: string | Types.ObjectId;
  key: string;
  scope?: t.MemoryScope;
  agentId?: string | null;
}) {
  const resolvedScope = resolveMemoryScope({ scope, agentId });
  return {
    userId,
    key,
    scope: resolvedScope.scope,
    agentId: resolvedScope.agentId,
  };
}

function sortMemories(memories: t.IMemoryEntryLean[]): t.IMemoryEntryLean[] {
  return memories.sort((a, b) => new Date(a.updated_at!).getTime() - new Date(b.updated_at!).getTime());
}

function getTotalTokens(memories: t.IMemoryEntryLean[]): number {
  return memories.reduce((sum, memory) => sum + (memory.tokenCount || 0), 0);
}

function formatMemoryLines(memories: t.IMemoryEntryLean[], includeKeys: boolean): string {
  return memories
    .map((memory, index) => {
      const date = formatDate(new Date(memory.updated_at!));
      if (includeKeys) {
        const tokenInfo = memory.tokenCount ? ` [${memory.tokenCount} tokens]` : '';
        return `${index + 1}. [${date}]. ["key": "${memory.key}"]${tokenInfo}. ["value": "${memory.value}"]`;
      }

      return `${index + 1}. [${date}]. ${memory.value}`;
    })
    .join('\n\n');
}

function formatMemorySections({
  userMemories,
  agentMemories,
  includeKeys,
}: {
  userMemories: t.IMemoryEntryLean[];
  agentMemories: t.IMemoryEntryLean[];
  includeKeys: boolean;
}): string {
  const sections = [
    userMemories.length > 0
      ? `# Shared user memory\n${formatMemoryLines(userMemories, includeKeys)}`
      : '',
    agentMemories.length > 0
      ? `# Character-specific memory\n${formatMemoryLines(agentMemories, includeKeys)}`
      : '',
  ].filter(Boolean);

  return sections.join('\n\n');
}

// Factory function that takes mongoose instance and returns the methods
export function createMemoryMethods(mongoose: typeof import('mongoose')) {
  async function getScopedMemories({
    userId,
    scope,
    agentId,
  }: {
    userId: string | Types.ObjectId;
    scope?: t.MemoryScope;
    agentId?: string | null;
  }): Promise<t.IMemoryEntryLean[]> {
    const MemoryEntry = mongoose.models.MemoryEntry;
    return (await MemoryEntry.find(buildMemoryQuery({ userId, scope, agentId })).lean()) as t.IMemoryEntryLean[];
  }

  /**
   * Creates a new memory entry for a user
   * Throws an error if a memory with the same key already exists
   */
  async function createMemory({
    userId,
    key,
    value,
    tokenCount = 0,
    scope,
    agentId,
  }: t.SetMemoryParams): Promise<t.MemoryResult> {
    try {
      if (key?.toLowerCase() === 'nothing') {
        return { ok: false };
      }

      const MemoryEntry = mongoose.models.MemoryEntry;
      const query = buildMemoryQuery({ userId, key, scope, agentId });
      const document = buildMemoryDocument({ userId, key, scope, agentId });
      const existingMemory = await MemoryEntry.findOne(query);
      if (existingMemory) {
        throw new Error('Memory with this key already exists');
      }

      await MemoryEntry.create({
        ...document,
        updated_at: new Date(),
        value,
        tokenCount,
      });

      return { ok: true };
    } catch (error) {
      throw new Error(
        `Failed to create memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Sets or updates a memory entry for a user
   */
  async function setMemory({
    userId,
    key,
    value,
    tokenCount = 0,
    scope,
    agentId,
  }: t.SetMemoryParams): Promise<t.MemoryResult> {
    try {
      if (key?.toLowerCase() === 'nothing') {
        return { ok: false };
      }

      const MemoryEntry = mongoose.models.MemoryEntry;
      const query = buildMemoryQuery({ userId, key, scope, agentId });
      const document = buildMemoryDocument({ userId, key, scope, agentId });
      await MemoryEntry.findOneAndUpdate(
        query,
        {
          ...document,
          value,
          tokenCount,
          updated_at: new Date(),
        },
        {
          upsert: true,
          new: true,
        },
      );

      return { ok: true };
    } catch (error) {
      throw new Error(
        `Failed to set memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Deletes a specific memory entry for a user
   */
  async function deleteMemory({
    userId,
    key,
    scope,
    agentId,
  }: t.DeleteMemoryParams): Promise<t.MemoryResult> {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      const result = await MemoryEntry.findOneAndDelete(buildMemoryQuery({ userId, key, scope, agentId }));
      return { ok: !!result };
    } catch (error) {
      throw new Error(
        `Failed to delete memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Gets all memory entries for a user
   */
  async function getAllUserMemories(
    userId: string | Types.ObjectId,
  ): Promise<t.IMemoryEntryLean[]> {
    try {
      return await getScopedMemories({ userId, scope: USER_SCOPE });
    } catch (error) {
      throw new Error(
        `Failed to get all memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Gets and formats all memories for a user in two different formats
   */
  async function getFormattedMemories({
    userId,
    agentId,
    includeUserScope = true,
  }: t.GetFormattedMemoriesParams): Promise<t.FormattedMemoriesResult> {
    try {
      const [userMemories, scopedAgentMemories] = await Promise.all([
        includeUserScope ? getScopedMemories({ userId, scope: USER_SCOPE }) : Promise.resolve([]),
        agentId?.trim()
          ? getScopedMemories({ userId, scope: AGENT_SCOPE, agentId })
          : Promise.resolve([]),
      ]);
      const agentMemories = sortMemories(scopedAgentMemories);
      const sortedUserMemories = sortMemories(userMemories);

      if (sortedUserMemories.length === 0 && agentMemories.length === 0) {
        return { withKeys: '', withoutKeys: '', totalTokens: 0 };
      }

      const totalTokens = agentId?.trim()
        ? getTotalTokens(agentMemories)
        : getTotalTokens(sortedUserMemories);
      const withKeys = formatMemorySections({
        userMemories: sortedUserMemories,
        agentMemories,
        includeKeys: true,
      });
      const withoutKeys = formatMemorySections({
        userMemories: sortedUserMemories,
        agentMemories,
        includeKeys: false,
      });

      return { withKeys, withoutKeys, totalTokens };
    } catch (error) {
      logger.error('Failed to get formatted memories:', error);
      return { withKeys: '', withoutKeys: '', totalTokens: 0 };
    }
  }

  return {
    setMemory,
    createMemory,
    deleteMemory,
    getAllUserMemories,
    getFormattedMemories,
  };
}

export type MemoryMethods = ReturnType<typeof createMemoryMethods>;
