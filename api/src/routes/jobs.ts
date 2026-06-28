import { Router, Request, Response } from "express";
import { prisma } from '../lib/prisma';
import jobQueue from "../queues/jobQueue";
import Redis from "ioredis";

const router = Router();


function isValidGithubIssueUrl(url: string) {
    const pattern = /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/;
    return pattern.test(url);
}

router.post("/", async (req: Request, res: Response) => {
    const { issueUrl, githubToken } = req.body;

    if (!issueUrl) {
        res.status(400).json({ error: "issueUrl is required" });
        return;
    }

    if (!isValidGithubIssueUrl(issueUrl)) {
        res.status(400).json({ error: "Invalid GitHub issue URL" });
        return;
    }

    if (!githubToken) {
        res.status(400).json({ error: "githubToken is required" });
        return;
    }

    // Save job to database
    const job = await prisma.job.create({
        data: {
            issueUrl,
            status: "PENDING"
        }
    });

    // Push to BullMQ queue
    await jobQueue.add("process-issue", {
        jobId: job.id,
        issueUrl,
        githubToken
    });

    console.log(`[Jobs] Created job: ${job.id} and pushed to queue`);

    res.status(201).json({
        jobId: job.id,
        status: job.status,
        createdAt: job.createdAt
    });
});

router.get("/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const job = await prisma.job.findUnique({
        where: { id }
    });

    if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
    }

    res.json(job);
});

router.get("/:id/stream", async (req: Request, res: Response) => {
    const { id } = req.params;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    console.log(`[SSE] Client connected for job: ${id}`);
    const subscriber = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    const channel = `job:${id}:logs`;

    await subscriber.subscribe(channel);
    console.log(`[SSE] Subscribed to Redis channel: ${channel}`);

    subscriber.on("message", (ch, message) => {
        res.write(`data: ${message}\n\n`);
    });

    const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({ step: "heartbeat", status: "ping" })}\n\n`);
    }, 30000);

    req.on("close", () => {
        console.log(`[SSE] Client disconnected for job: ${id}`);
        clearInterval(heartbeat);
        subscriber.unsubscribe(channel);
        subscriber.quit();
    });
});

router.post("/:id/complete", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { status, prUrl, testCode, fixCode, fixedFilePath, errorMessage } = req.body;

    console.log(`[Jobs] Job ${id} completed with status: ${status}`);

    const job = await prisma.job.update({
        where: { id: id },
        data: {
            status: status === "SUCCESS" ? "SUCCESS" : "FAILED",
            prUrl: prUrl || null,
            testCode: testCode || null,
            fixCode: fixCode || null,
            fixedFilePath: fixedFilePath || null,
            errorMessage: errorMessage || null,
        }
    });

    const Redis = (await import("ioredis")).default;
    const publisher = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    
    await publisher.publish(
        `job:${id}:logs`,
        JSON.stringify({
            step: "Job complete",
            status: status === "SUCCESS" ? "done" : "error",
            detail: prUrl || errorMessage || "",
            timestamp: Date.now()
        })
    );

    await publisher.quit();

    res.json({ success: true, job });
});


export default router;