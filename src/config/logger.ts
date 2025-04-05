import winston from 'winston';

// Define the custom format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    // We can safely access properties even if TypeScript doesn't recognize them
    // Winston adds timestamp during format.timestamp() but TypeScript doesn't know this
    const timestamp = info.timestamp || new Date().toISOString();
    return `${timestamp} [${info.level}]: ${info.message}`;
  })
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: customFormat,
  transports: [
    // Console transport for all environments
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      ),
    }),
    
    // File transports for production environment
    ...(process.env.NODE_ENV === 'production'
      ? [
          // Error logs
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
          // Combined logs
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

export default logger;