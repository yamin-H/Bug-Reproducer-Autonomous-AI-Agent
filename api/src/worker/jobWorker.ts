import { Worker } from "bullmq";
import { prisma } from "../lib/prisma";
import dotenv from "dotenv";

dotenv.config();

const connection = {
    host: "localhost",
    port: 6379
};

const PYTHON_AGENT_URL = process.env.PYTHON_AGENT_URL || "http://localhost:8000";

const worker = new Worker("bug-reproducer", async (job) => {
    const { jobId, issueUrl, githubToken } = job.data;
    console.log(`[Worker] Picked up job: ${jobId}`);

    await prisma.job.update({
        where: { id: jobId },
        data: { status: "RUNNING" }
    });

    try {
        console.log(`[Worker] Calling Python agent for job: ${jobId}`);
        const response = await fetch(`${PYTHON_AGENT_URL}/run`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                job_id: jobId,
                issue_url: issueUrl,
                github_token: githubToken
            })
        });

        if (!response.ok) {
            throw new Error(`Python agent returned ${response.status}`);
        }
        console.log(`[Worker] Python agent accepted job: ${jobId}`);

    } catch (error) {
        console.error(`[Worker] Error calling Python agent:`, error);
        await prisma.job.update({
            where: { id: jobId },
            data: {
                status: "FAILED",
                errorMessage: "Failed to call Python agent"
            }
        });
    }
}, {
    connection
});

worker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
    console.error(`[Worker] Job ${job?.id} failed:`, error);
});

console.log("[Worker] Waiting for jobs...");

export default worker;