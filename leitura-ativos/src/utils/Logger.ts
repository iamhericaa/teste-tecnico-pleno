import winston from 'winston';

const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

function formatError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
}

export const logger = {
  info(context: string, message: string, data?: unknown): void {
    winstonLogger.info(message, {
      context,
      ...(data !== undefined ? { data } : {}),
    });
  },

  error(context: string, message: string, error?: unknown): void {
    winstonLogger.error(message, {
      context,
      ...(error !== undefined ? { error: formatError(error) } : {}),
    });
  },
};

export class Logger {
  static info(context: string, message: string, data?: unknown): void {
    logger.info(context, message, data);
  }

  static error(context: string, message: string, error?: unknown): void {
    logger.error(context, message, error);
  }
}

export default logger;
