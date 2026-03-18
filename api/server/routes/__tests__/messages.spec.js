const express = require('express');
const request = require('supertest');

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('librechat-data-provider', () => ({
  ContentTypes: {
    TEXT: 'text',
  },
}));

jest.mock('@librechat/api', () => ({
  unescapeLaTeX: jest.fn((text) => text),
  countTokens: jest.fn(() => 0),
}));

jest.mock('~/models', () => ({
  saveConvo: jest.fn(),
  getMessage: jest.fn(),
  saveMessage: jest.fn(),
  getMessages: jest.fn(),
  updateMessage: jest.fn(),
  deleteMessages: jest.fn(),
}));

jest.mock('~/server/services/Artifacts/update', () => ({
  findAllArtifacts: jest.fn(),
  replaceArtifactContent: jest.fn(),
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => {
    req.user = { id: 'user-123' };
    next();
  },
  validateMessageReq: (_req, _res, next) => next(),
}));

jest.mock('~/models/Conversation', () => ({
  getConvosQueried: jest.fn(),
}));

jest.mock('~/db/models', () => ({
  Message: {},
}));

describe('Messages Routes', () => {
  const { deleteMessages } = require('~/models');
  const messagesRoute = require('../messages');
  const app = express();

  app.use(express.json());
  app.use('/api/messages', messagesRoute);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes message deletion to the authenticated user', async () => {
    deleteMessages.mockResolvedValue({ deletedCount: 1 });

    const response = await request(app).delete('/api/messages/convo-123/msg-123');

    expect(response.status).toBe(204);
    expect(deleteMessages).toHaveBeenCalledWith({
      messageId: 'msg-123',
      user: 'user-123',
    });
  });
});
