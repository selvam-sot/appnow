import logger from '../config/logger';
import { enqueue, isQueueEnabled, registerWorker } from '../config/queue';
import { recordPayoutForAppointment, processPayoutTransfer } from './vendor-payout.service';

const QUEUE_NAME = 'webhooks';

export interface StripeWebhookJobData {
  type: string;
  eventId: string;
  payload: any;
}

export interface PayoutJobData {
  appointmentId: string;
}

export interface PayoutTransferJobData {
  payoutId: string;
}

/**
 * Enqueue a Stripe webhook for retryable async processing.
 * Returns true if queued, false if Redis is unavailable (caller should process
 * synchronously as a fallback).
 */
export async function enqueueStripeWebhook(data: StripeWebhookJobData): Promise<boolean> {
  return enqueue<StripeWebhookJobData>(QUEUE_NAME, 'stripe-webhook', data, {
    jobId: `stripe_${data.eventId}`, // BullMQ dedupes by jobId
  });
}

/**
 * Enqueue a payout record creation (after appointment payment succeeds).
 */
export async function enqueuePayoutRecord(appointmentId: string): Promise<boolean> {
  return enqueue<PayoutJobData>(QUEUE_NAME, 'record-payout', { appointmentId });
}

/**
 * Enqueue an actual Stripe Transfer to a vendor's connected account.
 */
export async function enqueuePayoutTransfer(payoutId: string): Promise<boolean> {
  return enqueue<PayoutTransferJobData>(QUEUE_NAME, 'transfer-payout', { payoutId });
}

/**
 * Start the worker that processes queued jobs. Call once on server startup.
 * No-op when REDIS_URL isn't configured.
 */
export function startWebhookWorker(): void {
  if (!isQueueEnabled()) {
    logger.warn('[WebhookQueue] Disabled — REDIS_URL not set. Webhooks will be processed synchronously.');
    return;
  }

  registerWorker(QUEUE_NAME, async (job) => {
    logger.info(`[WebhookQueue] Processing job ${job.id} (${job.name})`);

    switch (job.name) {
      case 'record-payout': {
        const { appointmentId } = job.data as PayoutJobData;
        await recordPayoutForAppointment(appointmentId);
        break;
      }
      case 'transfer-payout': {
        const { payoutId } = job.data as PayoutTransferJobData;
        await processPayoutTransfer(payoutId);
        break;
      }
      case 'stripe-webhook': {
        // Reserved for async webhook processing — extend as you migrate
        // payment.controller.ts webhook handling here for retryability.
        logger.info(`[WebhookQueue] Stripe event ${(job.data as any).type} handled`);
        break;
      }
      default:
        logger.warn(`[WebhookQueue] Unknown job name: ${job.name}`);
    }
  }, 2); // concurrency = 2 jobs at a time

  logger.info('[WebhookQueue] Worker started');
}
