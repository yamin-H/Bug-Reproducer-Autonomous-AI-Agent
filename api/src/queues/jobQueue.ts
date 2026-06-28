import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

const connection = {
    host: "localhost",
    port: 6379
};

const jobQueue = new Queue("bug-reproducer", {
    connection
});

export default jobQueue;