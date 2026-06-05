import 'dotenv/config';

// Initialize Sentry FIRST — before any other imports so it can instrument them.
import { initSentry, Sentry } from './config/sentry';
initSentry();

import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import mongoose from 'mongoose';
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
import { startWebhookWorker } from './services/webhook-queue.service';
import { shutdownQueues } from './config/queue';

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

// Liveness probe — process is up and accepting requests
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe — process is ready to serve requests (DB connected, etc.)
// Use this for Azure/Kubernetes/load-balancer health checks.
app.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: 'ok' | 'error'; message?: string }> = {};

  // MongoDB / Cosmos connectivity
  try {
    const state = mongoose.connection.readyState;
    // 1 = connected, 2 = connecting, 0 = disconnected, 3 = disconnecting
    if (state !== 1) {
      checks.database = { status: 'error', message: `readyState=${state}` };
    } else {
      // Ping to confirm the connection is actually alive
      await mongoose.connection.db?.admin().ping();
      checks.database = { status: 'ok' };
    }
  } catch (err: any) {
    checks.database = { status: 'error', message: err?.message || 'ping failed' };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not-ready',
    checks,
    timestamp: new Date().toISOString(),
  });
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

// Background queue worker (Redis-backed). No-op if REDIS_URL not set.
startWebhookWorker();

// Graceful shutdown — flush queues before process exits
const shutdown = async (signal: string) => {
  logger.info(`[Server] Received ${signal}, shutting down gracefully`);
  await shutdownQueues();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Error handler - respects AppError.statusCode and exposes useful messages
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err?.statusCode || err?.status || 500;
  const isOperational = err?.isOperational === true;
  const message = err?.message || 'Something went wrong';

  // Always log the full error server-side
  logger.error(`[${req.method} ${req.path}] ${statusCode} - ${message}`);
  if (err?.stack && statusCode >= 500) {
    logger.error(err.stack);
  }

  // Report unexpected (5xx) errors to Sentry. Operational 4xx errors are filtered out.
  if (statusCode >= 500) {
    Sentry.captureException(err, {
      tags: { method: req.method, path: req.path, statusCode: String(statusCode) },
      extra: { userId: (req as any).user?._id, vendorId: (req as any).vendorId },
    });
  }

  res.status(statusCode).json({
    success: false,
    error: statusCode >= 500 ? 'Server Error' : message,
    // For operational AppErrors (4xx), always expose the message.
    // For 5xx, only expose in development.
    message:
      isOperational || statusCode < 500
        ? message
        : process.env.NODE_ENV === 'development'
          ? message
          : 'Something went wrong',
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
