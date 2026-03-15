const bcrypt = require('bcryptjs');

jest.mock('@librechat/data-schemas', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
  DEFAULT_SESSION_EXPIRY: 900000,
  DEFAULT_REFRESH_TOKEN_EXPIRY: 604800000,
}));

jest.mock('librechat-data-provider', () => ({
  ErrorTypes: { AUTH_FAILED: 'AUTH_FAILED' },
  SystemRoles: { USER: 'USER', ADMIN: 'ADMIN' },
  errorsToString: jest.fn(),
}));

jest.mock('@librechat/api', () => ({
  isEnabled: jest.fn((val) => val === 'true' || val === true),
  getBalanceConfig: jest.fn((config) => config?.balance ?? null),
  checkEmailConfig: jest.fn(),
  isEmailDomainAllowed: jest.fn(),
  math: jest.fn((val, fallback) => (val ? Number(val) : fallback)),
  shouldUseSecureCookie: jest.fn(() => false),
}));

jest.mock('~/models', () => ({
  findUser: jest.fn(),
  findToken: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  countUsers: jest.fn(),
  getUserById: jest.fn(),
  findSession: jest.fn(),
  createToken: jest.fn(),
  deleteTokens: jest.fn(),
  deleteSession: jest.fn(),
  createSession: jest.fn(),
  generateToken: jest.fn(),
  deleteUserById: jest.fn(),
  generateRefreshToken: jest.fn(),
}));

jest.mock('~/db/models', () => ({
  Balance: { findOneAndUpdate: jest.fn() },
}));

jest.mock('~/strategies/validators', () => ({
  registerSchema: { safeParse: jest.fn() },
}));

jest.mock('~/server/services/Config', () => ({
  getAppConfig: jest.fn(),
}));

jest.mock('~/server/utils', () => ({
  sendEmail: jest.fn(),
}));

const {
  checkEmailConfig,
  getBalanceConfig,
  isEmailDomainAllowed,
} = require('@librechat/api');
const {
  countUsers,
  createToken,
  createUser,
  deleteTokens,
  findToken,
  findUser,
  updateUser,
} = require('~/models');
const { Balance } = require('~/db/models');
const { registerSchema } = require('~/strategies/validators');
const { getAppConfig } = require('~/server/services/Config');
const { sendEmail } = require('~/server/utils');
const {
  registerUser,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} = require('./AuthService');

describe('AuthService email flow', () => {
  const balanceConfig = {
    enabled: true,
    startBalance: 100000,
    autoRefillEnabled: true,
    refillIntervalValue: 1,
    refillIntervalUnit: 'days',
    refillAmount: 100000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    registerSchema.safeParse.mockReturnValue({ error: null });
    isEmailDomainAllowed.mockReturnValue(true);
    getAppConfig.mockResolvedValue({ balance: balanceConfig });
    getBalanceConfig.mockReturnValue(balanceConfig);
  });

  it('holds start balance until a local user verifies their email', async () => {
    checkEmailConfig.mockReturnValue(true);
    countUsers.mockResolvedValue(1);
    findUser.mockResolvedValue(null);
    createUser.mockResolvedValue({
      _id: 'user-1',
      email: 'kyne2e@example.com',
      emailVerified: false,
    });

    const result = await registerUser({
      email: 'kyne2e@example.com',
      password: 'SenhaSegura123!',
      name: 'KYNS Teste',
      username: 'kynsteste',
    });

    expect(result.status).toBe(200);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'kyne2e@example.com',
        role: 'USER',
      }),
      undefined,
      false,
      true,
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Verifique seu e-mail',
        template: 'verifyEmail.handlebars',
      }),
    );
    expect(createToken).toHaveBeenCalledTimes(1);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('provisions the configured balance when email verification succeeds', async () => {
    const rawToken = 'verify-token-123';
    const hashedToken = bcrypt.hashSync(rawToken, 10);

    findUser.mockResolvedValue({
      _id: 'user-1',
      email: 'kyne2e@example.com',
      emailVerified: false,
    });
    findToken.mockResolvedValue({
      userId: 'user-1',
      token: hashedToken,
      email: 'kyne2e@example.com',
    });
    updateUser.mockResolvedValue({
      _id: 'user-1',
      email: 'kyne2e@example.com',
      emailVerified: true,
    });

    const result = await verifyEmail({
      body: {
        email: encodeURIComponent('kyne2e@example.com'),
        token: rawToken,
      },
    });

    expect(result).toEqual({
      message: 'Email verification was successful',
      status: 'success',
    });
    expect(Balance.findOneAndUpdate).toHaveBeenCalledWith(
      { user: 'user-1' },
      {
        $setOnInsert: expect.objectContaining({
          user: 'user-1',
          tokenCredits: 100000,
          autoRefillEnabled: true,
          refillIntervalValue: 1,
          refillIntervalUnit: 'days',
          refillAmount: 100000,
          lastRefill: expect.any(Date),
        }),
      },
      { upsert: true, new: true },
    );
    expect(deleteTokens).toHaveBeenCalledWith({ token: hashedToken });
  });

  it('sends the password reset request email with the production subject', async () => {
    checkEmailConfig.mockReturnValue(true);
    findUser.mockResolvedValue({
      _id: 'user-1',
      email: 'kyne2e@example.com',
      name: 'KYNS Teste',
    });

    await requestPasswordReset({
      body: { email: 'kyne2e@example.com' },
      ip: '127.0.0.1',
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Redefina sua senha',
        template: 'requestPasswordReset.handlebars',
      }),
    );
  });

  it('acknowledges password reset requests without returning a link when email is disabled', async () => {
    checkEmailConfig.mockReturnValue(false);
    findUser.mockResolvedValue({
      _id: 'user-1',
      email: 'kyne2e@example.com',
      name: 'KYNS Teste',
    });

    const result = await requestPasswordReset({
      body: { email: 'kyne2e@example.com' },
      ip: '127.0.0.1',
    });

    expect(result).toEqual({
      message: 'Se existir uma conta com esse e-mail, enviaremos um link para redefinir sua senha.',
    });
    expect(deleteTokens).not.toHaveBeenCalled();
    expect(createToken).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends the password reset confirmation email with the production subject', async () => {
    const rawToken = 'reset-token-123';

    findToken.mockResolvedValue({
      userId: 'user-1',
      token: bcrypt.hashSync(rawToken, 10),
    });
    updateUser.mockResolvedValue({
      _id: 'user-1',
      email: 'kyne2e@example.com',
      name: 'KYNS Teste',
    });
    checkEmailConfig.mockReturnValue(true);

    await resetPassword('user-1', rawToken, 'NovaSenhaSegura123!');

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Sua senha foi alterada',
        template: 'passwordReset.handlebars',
      }),
    );
  });
});
