import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";
import config from "@/config";
import errors = format.errors;

const env = process.env.NODE_ENV || "development";

const customFormat = format.printf(
  ({ level, message, timestamp, service, stack, ...temp }) => {
    const logMessage = {
      asctime: timestamp,
      level: level.toUpperCase(),
      service: service,
      message: message,
      stack: stack,
    };
    return JSON.stringify(logMessage);
  }
);

// Create a daily rotate transport for all logs
const allLogsTransport = new transports.DailyRotateFile({
  filename: config.log.allLogsPath.replace(".log", "-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxFiles: "1d", // Keep logs for 3 days
  maxSize: "20m", // Rotate if file size exceeds 20MB
  zippedArchive: true, // Compress rotated files
});

// Create a daily rotate transport for error logs
const errorLogsTransport = new transports.DailyRotateFile({
  filename: config.log.errorLogsPath.replace(".log", "-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxFiles: "1d", // Keep logs for 10 days
  maxSize: "20m", // Rotate if file size exceeds 20MB
  zippedArchive: true, // Compress rotated files
  level: "error", // Only log errors
});

const logger = createLogger({
  level: "info",
  defaultMeta: { service: "Backend Server" },
  format: format.combine(
    format.splat(),
    format.json(),
    errors({ stack: true }),
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    customFormat
  ),
  transports: [allLogsTransport, errorLogsTransport],
  exitOnError: false,
});

if (env !== "production") {
  logger.add(
    new transports.Console({
      format: format.combine(format.colorize({ all: true })),
    })
  );
}

export default logger;
