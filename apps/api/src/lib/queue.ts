import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../env.js";
import type { TryOnJobPayload } from "../modules/ai/try-on/try-on.types.js";

let _redisConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!_redisConnection) {
    _redisConnection = new Redis(env.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) {
          return null; // Stop reconnecting after 3 attempts
        }
        return Math.min(times * 100, 1000);
      },
    });

    _redisConnection.on("error", (err) => {
      // Don't crash process immediately on connection drop
      console.warn("[redis] connection error:", err.message);
    });
  }
  return _redisConnection;
}

export const TRY_ON_QUEUE_NAME = "try-on-jobs";

let _tryOnQueue: Queue<TryOnJobPayload> | null = null;

export function getTryOnQueue(): Queue<TryOnJobPayload> {
  if (!_tryOnQueue) {
    _tryOnQueue = new Queue<TryOnJobPayload>(TRY_ON_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return _tryOnQueue;
}
