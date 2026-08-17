import { Redis } from "ioredis";
import { loadEnv } from "@emp/config";

let connection: Redis | undefined;

/** Shared BullMQ connection. `maxRetriesPerRequest: null` is required by BullMQ. */
export function getRedisConnection(): Redis {
  if (!connection) {
    connection = new Redis(loadEnv().REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}
