import mongoose from 'mongoose';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ],
});

// Connect to MongoDB (Azure Cosmos DB with MongoDB API)
export const connectToDatabase = async (): Promise<void> => {
  try {
    if (!process.env.COSMOS_DB_CONNECTION_STRING) {
      throw new Error('COSMOS_DB_CONNECTION_STRING is not defined in environment variables');
    }

    // Important: These options are crucial for Azure Cosmos DB
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: false, // Important for Cosmos DB
      serverSelectionTimeoutMS: 30000, // Longer timeout for Azure
      socketTimeoutMS: 75000, // Longer timeout for Azure
      keepAlive: true,
      keepAliveInitialDelay: 300000, // Helps with connection stability
    };

    // Log that we're attempting to connect (useful for debugging)
    logger.info(`Attempting to connect to Azure Cosmos DB: ${process.env.COSMOS_DB_NAME}`);
    
    await mongoose.connect(process.env.COSMOS_DB_CONNECTION_STRING, options);
    
    logger.info('Successfully connected to Azure Cosmos DB');
  } catch (error) {
    logger.error(`Error connecting to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Log detailed error for troubleshooting
    logger.error(`Full error: ${JSON.stringify(error)}`);
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB connection error: ${err}`);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

// Handle application termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed due to app termination');
  process.exit(0);
});