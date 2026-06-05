import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis, { Redis } from 'ioredis';
import logger from './logger';

/**
 * Background job queue using BullMQ + Redis.
 *
 * Required env var: REDIS_URL  (e.g. redis://default:password@host:6379)
 *
 * If REDIS_URL is not set, queue operations are no-ops — useful for local dev
 * and during initial rollout. Production MUST have Redis configured.
 */

let connection: Redis | null = null;
const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();

export function isQueueEnabled(): boolean {
  return !!process.env.REDIS_URL;
}

function getConnection(): Redis | null {
  if (connection) return connection;
  if (!process.env.REDIS_URL) return null;

  connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null, // BullMQ requirement
    enableReadyCheck: true,
  });

  connection.on('error', (err) => {
    logger.error(`[Queue] Redis error: ${err.message}`);
  });
  connection.on('connect', () => {
    logger.info('[Queue] Redis connected');
  });

  return connection;
}

/**
 * Get or create a named queue. Returns null if Redis is not configured.
 */
export function getQueue(name: string): Queue | null {
  if (queues.has(name)) return queues.get(name)!;
  const conn = getConnection();
  if (!conn) return null;

  const queue = new Queue(name, {
    connection: conn,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 1000 }, // Keep last 1000 successful jobs
      removeOnFail: { count: 5000 }, // Keep last 5000 failed jobs for debugging
    },
  });
  queues.set(name, queue);
  return queue;
}

/**
 * Register a worker for a named queue. The worker processes jobs as they arrive.
 */
export function registerWorker<T = any>(
  name: string,
  processor: (job: Job<T>) => Promise<void>,
  concurrency = 1,
): Worker | null {
  if (workers.has(name)) return workers.get(name)!;
  const conn = getConnection();
  if (!conn) return null;

  const worker = new Worker<T>(name, processor, { connection: conn, concurrency });
  worker.on('completed', (job) => {
    logger.info(`[Queue:${name}] Job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    logger.error(
      `[Queue:${name}] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}): ${err.message}`,
    );
  });
  workers.set(name, worker);
  return worker;
}

/**
 * Helper to enqueue a job. Returns true if enqueued, false if queue is disabled.
 */
export async function enqueue<T = any>(
  queueName: string,
  jobName: string,
  data: T,
  opts?: { delay?: number; jobId?: string },
): Promise<boolean> {
  const queue = getQueue(queueName);
  if (!queue) {
    logger.warn(`[Queue] REDIS_URL not set — job ${queueName}/${jobName} dropped`);
    return false;
  }
  await queue.add(jobName, data as any, opts);
  return true;
}

/**
 * Graceful shutdown — close all queues and workers.
 */
export async function shutdownQueues(): Promise<void> {
  for (const worker of workers.values()) {
    await worker.close();
  }
  for (const queue of queues.values()) {
    await queue.close();
  }
  if (connection) {
    await connection.quit();
  }
}

// Export a typed queue events helper for monitoring
export function getQueueEvents(name: string): QueueEvents | null {
  const conn = getConnection();
  if (!conn) return null;
  return new QueueEvents(name, { connection: conn });
}
