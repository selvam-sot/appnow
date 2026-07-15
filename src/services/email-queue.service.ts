import type { Job } from 'bullmq';
import { enqueue, registerWorker, isQueueEnabled } from '../config/queue';
import { sendEmail } from './email.service';
import logger from '../config/logger';

/**
 * Background email queue. Wraps `sendEmail` so the request cycle isn't
 * blocked on SMTP round-trips (which can be 1-5s under load).
 *
 * Falls back to synchronous send when REDIS_URL isn't configured so
 * local dev and initial rollout continue to work without Redis.
 */

const EMAIL_QUEUE = 'emails';

export interface QueuedEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Enqueue an email. Returns true if the job was queued, false if Redis
 * is disabled AND the sync fallback also fails.
 */
export async function queueEmail(payload: QueuedEmail): Promise<boolean> {
  if (isQueueEnabled()) {
    return enqueue(EMAIL_QUEUE, 'send', payload, {
      // Idempotency: same recipient + subject within a minute = same job.
      // Prevents duplicate reminder emails when multiple triggers fire.
      jobId: `${payload.to}:${payload.subject}:${Math.floor(Date.now() / 60000)}`,
    });
  }

  // Redis not configured — send synchronously so mail still goes out.
  try {
    await sendEmail(payload);
    return true;
  } catch (err: any) {
    logger.error(`[email-queue] sync fallback failed: ${err.message}`);
    return false;
  }
}

/**
 * Start the email worker. No-op if Redis isn't configured.
 * Should be called once at server startup, alongside the webhook worker.
 */
export function startEmailWorker(): void {
  const worker = registerWorker<QueuedEmail>(
    EMAIL_QUEUE,
    async (job: Job<QueuedEmail>) => {
      await sendEmail(job.data);
    },
    5, // 5 concurrent SMTP sends is plenty; SendGrid limit is ~100/s
  );
  if (worker) {
    logger.info('[email-queue] Worker started (concurrency=5)');
  } else {
    logger.warn('[email-queue] Worker not started (REDIS_URL not set)');
  }
}
