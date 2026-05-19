import winston from "winston";

const logLevel = process.env.LOG_LEVEL || "info";
const ignoredKeys = new Set(["level", "message", "timestamp"]);

function formatMetadata(info: winston.Logform.TransformableInfo): string {
  const metadata = Object.fromEntries(
    Object.entries(info).filter(([key]) => !ignoredKeys.has(key))
  );

  if (Object.keys(metadata).length === 0) {
    return "";
  }

  return ` ${JSON.stringify(metadata)}`;
}

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.colorize(),
    winston.format.printf((info) => {
      return `${info.timestamp} [${info.level}]: ${info.message}${formatMetadata(info)}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
  ]
});

export default logger;
