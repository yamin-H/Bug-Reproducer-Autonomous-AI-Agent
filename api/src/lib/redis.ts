import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null
});

redis.on("connect", () => {
    console.log("[Redis] Connected");
});

redis.on("error", (err) => {
    console.error("[Redis] Error:", err);
});

export default redis;