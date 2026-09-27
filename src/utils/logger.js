// ============================================
// Winston Logger
// ============================================

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure logs dir exists
const logDir = path.resolve(process.cwd(), config.LOG_DIR);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: logFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
  exitOnError: false,
});

// Console in non-production
if (!config.IS_PRODUCTION) {
  logger.add(new winston.transports.Console({ format: consoleFormat }));
}

// ============================================
// Helper functions
// ============================================
const logInfo = (message, data = null) => {
  if (data) logger.info(message, data);
  else logger.info(message);
};

const logError = (error, context = null) => {
  if (error instanceof Error) {
    logger.error(error.message, { stack: error.stack, context });
  } else {
    logger.error(error, { context });
  }
};

const logWarn = (message, data = null) => {
  logger.warn(message, data);
};

const logDebug = (message, data = null) => {
  logger.debug(message, data);
};

module.exports = {
  logger,
  logInfo,
  logError,
  logWarn,
  logDebug,
};