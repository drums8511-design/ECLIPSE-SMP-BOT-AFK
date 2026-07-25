/**
 * logger.js — Winston console + rotating daily log files
 */
const winston     = require('winston');
const DailyRotate = require('winston-daily-rotate-file');
const path        = require('path');
const fs          = require('fs');
const { logging } = require('./config');

fs.mkdirSync(logging.logDir, { recursive: true });

const { combine, timestamp, colorize, printf, splat } = winston.format;
const lineFormat = printf(({ level, message, timestamp: ts }) =>
  `[${ts}] [${level.toUpperCase().padEnd(5)}] ${message}`);

const logger = winston.createLogger({
  level: logging.level,
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), splat(), lineFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize({ all: true }), timestamp({ format: 'HH:mm:ss' }), splat(), lineFormat),
    }),
    new DailyRotate({ filename: path.join(logging.logDir, 'bot-%DATE%.log'), datePattern: 'YYYY-MM-DD', maxFiles: '14d', zippedArchive: true }),
    new DailyRotate({ level: 'error', filename: path.join(logging.logDir, 'error-%DATE%.log'), datePattern: 'YYYY-MM-DD', maxFiles: '30d', zippedArchive: true }),
  ],
});

module.exports = logger;
