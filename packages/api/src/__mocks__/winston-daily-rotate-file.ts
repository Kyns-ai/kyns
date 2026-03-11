import winston from 'winston';

class DailyRotateFile extends winston.transports.File {
  constructor(options?: object) {
    super(options);
  }
}

(winston.transports as Record<string, unknown>).DailyRotateFile = DailyRotateFile;

export default DailyRotateFile;
module.exports = DailyRotateFile;
