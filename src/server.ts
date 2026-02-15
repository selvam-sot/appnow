import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import { connectToDatabase } from './config/database';
import logger from './config/logger';
import corsOptions from './config/cors';
import { generalLimiter } from './middlewares/rateLimiter.middleware';
import { xssSanitize } from './middlewares/sanitize.middleware';
import { setupSwagger } from './config/swagger';
import { auditAdmin, auditAllMutations } from './middlewares/audit.middleware';
import adminRoutes from './routes/admin';
import userRoutes from './routes/user';
import vendorRoutes from './routes/vendor';
import { startNotificationScheduler } from './services/notification-scheduler.service';
import { autoCompleteAppointments } from './services/scheduler.service';

const app = express();
connectToDatabase();

// Middleware
app.use(express.json({ limit: '10kb' }));
app.use(cors(corsOptions));
app.use(helmet());
app.use(hpp());
app.use(xssSanitize);
if (process.env.NODE_ENV === 'production') app.use('/api/', generalLimiter);
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Swagger
setupSwagger(app);

// API routes
app.use('/api/v1/admin', auditAdmin, adminRoutes);
app.use('/api/v1/customer', auditAllMutations, userRoutes);
app.use('/api/v1/vendor', auditAllMutations, vendorRoutes);

// Schedulers
startNotificationScheduler();
autoCompleteAppointments();
setInterval(autoCompleteAppointments, 15 * 60 * 1000);

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({
    success: false,
    error: 'Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
