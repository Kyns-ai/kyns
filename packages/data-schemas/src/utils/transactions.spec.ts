jest.mock('~/config/winston', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
  },
}));

import { getTransactionSupport } from './transactions';

describe('getTransactionSupport', () => {
  it('returns the cached value when transaction support is already known', async () => {
    const fakeMongoose = {
      startSession: jest.fn(),
    } as unknown as typeof import('mongoose');

    await expect(getTransactionSupport(fakeMongoose, true)).resolves.toBe(true);
    await expect(getTransactionSupport(fakeMongoose, false)).resolves.toBe(false);
    expect(fakeMongoose.startSession).not.toHaveBeenCalled();
  });

  it('checks MongoDB transaction support when the cache is empty', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const session = {
      startTransaction: jest.fn(),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const fakeMongoose = {
      startSession: jest.fn().mockResolvedValue(session),
      connection: {
        db: {
          collection: jest.fn(() => ({ findOne })),
        },
      },
    } as unknown as typeof import('mongoose');

    await expect(getTransactionSupport(fakeMongoose, null)).resolves.toBe(true);
    expect(fakeMongoose.startSession).toHaveBeenCalledTimes(1);
    expect(session.startTransaction).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledTimes(1);
    expect(session.abortTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});
