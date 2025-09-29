import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { connectToDatabase } from './config/database';
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

// Initialize express app
const app = express();

// Connect to database
connectToDatabase();

// Middleware
app.use(express.json());

const corsOptions = {
  origin: [
    'http://localhost:8081',
    'http://192.168.0.88:8081',
    'exp://192.168.0.88:8081',
    'http://192.168.0.88:3000',
    'http://localhost:3000',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.get('/', (_req: Request, res: Response) => {
  res.json({ 
    message: 'Welcome to Appointment Management System',
    status: 'Server is running',
    version: '1.0.0'
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    message: 'Application running in health condition',
    status: 'Server is running',
    version: '1.0.0'
  });
});

// API routes
try {
  const adminRoutes = require('./routes/admin').default;  
  const userRoutes = require('./routes/user').default;  
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/customer', userRoutes);
  logger.info('Routes loaded successfully');
} catch (error) {
  logger.error('Error loading routes:', error);
}

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({
    success: false,
    error: 'Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Handle 404 routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: 'The requested resource was not found on this server'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
