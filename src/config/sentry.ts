import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import logger from './logger';

/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Must be called BEFORE any other require/import that you want instrumented,
 * and before Express app is created.
 *
 * Required env vars:
 *   SENTRY_DSN - your Sentry project DSN (https://sentry.io/settings/projects/<project>/keys/)
 *
 * Optional env vars:
 *   SENTRY_ENVIRONMENT - defaults to NODE_ENV
 *   SENTRY_TRACES_SAMPLE_RATE - 0.0-1.0, defaults to 0.1 in production, 1.0 in dev
 *   SENTRY_RELEASE - release tag (commit SHA, version, etc.)
 */
export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.warn('[Sentry] SENTRY_DSN not set — error tracking disabled');
    return false;
  }

  const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
  const isProd = environment === 'production';
  const tracesSampleRate = process.env.SENTRY_TRACES_SAMPLE_RATE
    ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
    : isProd
      ? 0.1
      : 1.0;

  Sentry.init({
    dsn,
    environment,
    release: process.env.SENTRY_RELEASE,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate,
    profilesSampleRate: isProd ? 0.1 : 1.0,
    // Filter out noise: validation errors, expected 4xx, etc.
    beforeSend(event, hint) {
      const err: any = hint.originalException;
      // Skip operational AppErrors that are expected (4xx) — only report 5xx and unexpected crashes
      if (err?.isOperational === true && err?.statusCode && err.statusCode < 500) {
        return null;
      }
      return event;
    },
    // Redact sensitive headers
    beforeSendTransaction(event) {
      if (event.request?.headers) {
        const safeHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(event.request.headers)) {
          const lower = k.toLowerCase();
          if (
            lower === 'authorization' ||
            lower === 'cookie' ||
            lower.includes('token') ||
            lower.includes('secret')
          ) {
            safeHeaders[k] = '[redacted]';
          } else {
            safeHeaders[k] = String(v);
          }
        }
        event.request.headers = safeHeaders;
      }
      return event;
    },
  });

  logger.info(`[Sentry] Initialized — environment=${environment}, sampleRate=${tracesSampleRate}`);
  return true;
}

export { Sentry };
