import { Queue } from "bullmq";
import { bullConnection } from "../lib/redis";

const jobQueue = new Queue("bug-reproducer", {
    connection: bullConnection,
});

export default jobQueue;
