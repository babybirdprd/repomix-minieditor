import pino from 'pino';
import fs from 'fs';
import path from 'path';

// Ensure logs directory exists
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// Write logs to logs/ai.log file as well as pretty-print to console
const logFilePath = path.join(logDir, 'ai.log');

export const logger = pino({
  level: 'info',
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          singleLine: false,
          ignore: 'pid,hostname',
        },
        level: 'info',
      },
      {
        target: 'pino/file',
        options: { destination: logFilePath },
        level: 'info',
      },
    ],
  },
});
