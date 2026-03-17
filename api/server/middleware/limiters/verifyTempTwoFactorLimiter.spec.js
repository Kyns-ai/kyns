const express = require('express');
const request = require('supertest');

jest.mock('@librechat/api', () => ({
  limiterCache: jest.fn(() => undefined),
}));

jest.mock('~/server/utils', () => ({
  removePorts: jest.fn((req) => req.ip || '127.0.0.1'),
}));

describe('verifyTempTwoFactorLimiter', () => {
  const originalMax = process.env.VERIFY_TEMP_2FA_MAX;
  const originalWindow = process.env.VERIFY_TEMP_2FA_WINDOW;

  afterEach(() => {
    jest.resetModules();
    if (originalMax === undefined) {
      delete process.env.VERIFY_TEMP_2FA_MAX;
    } else {
      process.env.VERIFY_TEMP_2FA_MAX = originalMax;
    }

    if (originalWindow === undefined) {
      delete process.env.VERIFY_TEMP_2FA_WINDOW;
    } else {
      process.env.VERIFY_TEMP_2FA_WINDOW = originalWindow;
    }
  });

  it('returns 429 after the configured number of attempts', async () => {
    process.env.VERIFY_TEMP_2FA_MAX = '1';
    process.env.VERIFY_TEMP_2FA_WINDOW = '1';

    const limiter = require('./verifyTempTwoFactorLimiter');
    const app = express();
    app.post('/verify-temp', limiter, (_req, res) => res.status(200).json({ ok: true }));

    const firstResponse = await request(app).post('/verify-temp');
    const secondResponse = await request(app).post('/verify-temp');

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    expect(secondResponse.body).toEqual({
      message: 'Too many 2FA attempts, please try again after 1 minute(s).',
    });
  });
});
