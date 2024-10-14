import { createLogger, format, transports } from 'winston';

const { combine, timestamp, printf, colorize } = format;

// Define the format directly within the logger configuration
const logger = createLogger({
  level: 'info',
  format: combine(
    colorize({ all: true }), // Apply color to the entire message
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    printf(({ level, message, timestamp, stack }) => {
      return `${timestamp} [${level}]: ${stack || message}`;
    })
  ),
  transports: [
    // Console transport with colorized output
    new transports.Console(),
    // File transports (without colorized output)
    new transports.File({ filename: 'combined.log' }),
    new transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

export default logger;
