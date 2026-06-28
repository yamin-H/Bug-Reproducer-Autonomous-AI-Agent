import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const url = new URL(redisUrl);

const connection = {
    host: url.hostname,
    port: parseInt(url.port),
    password: url.password || undefined,
    tls: redisUrl.startsWith("rediss://") ? {} : undefined
};

const jobQueue = new Queue("bug-reproducer", {
    connection
});

export default jobQueue;
