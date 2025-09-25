import winston, { format } from 'winston';

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

export default winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.splat(),
    format.colorize(),
    format.timestamp(),
    format.printf(
      ({ timestamp, level, module, message }) =>
        `[${timestamp}] ${level}${module ? ' [' + module + ']' : ''}: ${message}`,
    ),
  ),
  transports: [new winston.transports.Console()],
});
