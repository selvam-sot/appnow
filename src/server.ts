import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import { connectToDatabase } from './config/database';
import winston from 'winston';
import { generalLimiter } from './middlewares/rateLimiter.middleware';
import { xssSanitize } from './middlewares/sanitize.middleware';
import { setupSwagger } from './config/swagger';
import { auditAdmin, auditAllMutations } from './middlewares/audit.middleware';

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
app.use(express.json({ limit: '10kb' })); // Limit body size

const corsOptions = {
  origin: [
    'http://localhost:8081',
    'http://192.168.0.88:8081',
    'exp://192.168.0.88:8081',
    'http://192.168.0.88:3000',
    'http://localhost:3000',
    'http://localhost:3001', // Admin panel
    'http://localhost:8082', // Vendor app
    'http://192.168.0.88:8082',
    'exp://192.168.0.88:8082',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

// Security middleware
app.use(helmet()); // Set security HTTP headers
// Note: express-mongo-sanitize removed due to Node.js 20+ making req.query read-only
// Our xssSanitize middleware handles NoSQL injection prevention by filtering $ operators
app.use(hpp()); // Prevent HTTP Parameter Pollution
app.use(xssSanitize); // Sanitize user input against XSS and NoSQL injection

// Rate limiting - apply to all API routes (only in production)
if (process.env.NODE_ENV === 'production') {
  app.use('/api/', generalLimiter);
}
// In development, rate limiting is disabled for faster testing

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

// Setup Swagger API documentation
setupSwagger(app);
logger.info('Swagger documentation available at /api-docs');

// API routes
try {
  const adminRoutes = require('./routes/admin').default;
  const userRoutes = require('./routes/user').default;
  const vendorRoutes = require('./routes/vendor').default;

  // Apply audit logging to admin routes (all methods)
  app.use('/api/v1/admin', auditAdmin, adminRoutes);

  // Apply audit logging to customer routes (mutations only)
  app.use('/api/v1/customer', auditAllMutations, userRoutes);

  // Apply audit logging to vendor routes (mutations only)
  app.use('/api/v1/vendor', auditAllMutations, vendorRoutes);

  logger.info('Routes loaded successfully');

  // Start appointment reminder scheduler
  const { startReminderScheduler } = require('./services/scheduler.service');
  startReminderScheduler();
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
