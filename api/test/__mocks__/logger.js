jest.mock('winston', () => {
  const noopFormat = () => ({ transform: (info) => info });
  const mockFormatFunction = jest.fn((fn) => () => ({ transform: fn || ((info) => info) }));

  mockFormatFunction.colorize = jest.fn(() => noopFormat);
  mockFormatFunction.combine = jest.fn(() => noopFormat);
  mockFormatFunction.label = jest.fn(() => noopFormat);
  mockFormatFunction.timestamp = jest.fn(() => noopFormat);
  mockFormatFunction.printf = jest.fn(() => noopFormat);
  mockFormatFunction.errors = jest.fn(() => noopFormat);
  mockFormatFunction.splat = jest.fn(() => noopFormat);
  mockFormatFunction.json = jest.fn(() => noopFormat);
  return {
    format: mockFormatFunction,
    createLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    }),
    transports: {
      Console: jest.fn(),
      DailyRotateFile: jest.fn(),
      File: jest.fn(),
    },
    addColors: jest.fn(),
  };
});

jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => {
    return {
      level: 'error',
      filename: '../logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: 'format',
    };
  });
});

jest.mock('~/config', () => {
  return {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    },
  };
});

jest.mock('~/config/parsers', () => {
  return {
    redactMessage: jest.fn(),
    redactFormat: jest.fn(),
    debugTraverse: jest.fn(),
  };
});
