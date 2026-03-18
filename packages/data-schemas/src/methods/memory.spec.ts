import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type * as t from '~/types';
import memorySchema from '~/schema/memory';
import { createMemoryMethods } from './memory';

jest.mock('~/config/winston', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

let mongoServer: MongoMemoryServer;
let MemoryEntry: mongoose.Model<t.IMemoryEntry>;
let methods: ReturnType<typeof createMemoryMethods>;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  MemoryEntry =
    mongoose.models.MemoryEntry || mongoose.model<t.IMemoryEntry>('MemoryEntry', memorySchema);
  methods = createMemoryMethods(mongoose);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('memory methods scope handling', () => {
  test('stores the same key separately for different characters', async () => {
    const userId = new mongoose.Types.ObjectId();

    await methods.setMemory({
      userId,
      key: 'preferences',
      value: 'User likes calm conversations.',
      scope: 'agent',
      agentId: 'luna',
    });
    await methods.setMemory({
      userId,
      key: 'preferences',
      value: 'User likes teasing banter.',
      scope: 'agent',
      agentId: 'isis',
    });

    const memories = await MemoryEntry.find({ userId }).sort({ agentId: 1 }).lean();

    expect(memories).toHaveLength(2);
    expect(memories[0]).toMatchObject({
      scope: 'agent',
      agentId: 'isis',
      key: 'preferences',
      value: 'User likes teasing banter.',
    });
    expect(memories[1]).toMatchObject({
      scope: 'agent',
      agentId: 'luna',
      key: 'preferences',
      value: 'User likes calm conversations.',
    });
  });

  test('getFormattedMemories combines shared and character-specific memory for the active character', async () => {
    const userId = new mongoose.Types.ObjectId();

    await methods.setMemory({
      userId,
      key: 'identity',
      value: 'The user is a designer.',
      tokenCount: 5,
    });
    await methods.setMemory({
      userId,
      key: 'preferences',
      value: 'The user likes slow-burn romance.',
      scope: 'agent',
      agentId: 'luna',
      tokenCount: 7,
    });
    await methods.setMemory({
      userId,
      key: 'preferences',
      value: 'The user likes rivalry dynamics.',
      scope: 'agent',
      agentId: 'isis',
      tokenCount: 6,
    });

    const formatted = await methods.getFormattedMemories({
      userId,
      agentId: 'luna',
    });

    expect(formatted.withKeys).toContain('# Shared user memory');
    expect(formatted.withKeys).toContain('# Character-specific memory');
    expect(formatted.withKeys).toContain('The user is a designer.');
    expect(formatted.withKeys).toContain('The user likes slow-burn romance.');
    expect(formatted.withKeys).not.toContain('The user likes rivalry dynamics.');
    expect(formatted.totalTokens).toBe(7);
  });

  test('getAllUserMemories keeps the global memory panel limited to shared memories', async () => {
    const userId = new mongoose.Types.ObjectId();

    await methods.setMemory({
      userId,
      key: 'identity',
      value: 'The user is a designer.',
    });
    await methods.setMemory({
      userId,
      key: 'preferences',
      value: 'The user likes slow-burn romance.',
      scope: 'agent',
      agentId: 'luna',
    });

    const memories = await methods.getAllUserMemories(userId);

    expect(memories).toHaveLength(1);
    expect(memories[0]).toMatchObject({
      scope: 'user',
      agentId: '',
      key: 'identity',
    });
  });
});
