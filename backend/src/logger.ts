import pino from 'pino';

// Create a pino logger instance, logs to console by default
export const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      singleLine: false,
      ignore: 'pid,hostname',
    },
  },
});
