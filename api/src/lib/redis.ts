/** Shared Redis client and connection configuration. */

import Redis from "ioredis";
import dotenv from "dotenv";
import type { ConnectionOptions } from "bullmq";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const url = new URL(REDIS_URL);

/** BullMQ-compatible connection config (parsed from REDIS_URL). */
export const bullConnection: ConnectionOptions = {
    host: url.hostname,
    port: parseInt(url.port || "6379"),
    password: url.password || undefined,
    tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
};

/** Singleton Redis client for the application.
 *  Do NOT call `new Redis()` directly — reuse this instance.
 *  For BullMQ, use `bullConnection` instead of a separate Redis client. */
const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

redis.on("connect", () => {
    console.log("[Redis] Connected");
});

redis.on("error", (err) => {
    console.error("[Redis] Error:", err);
});

export default redis;
