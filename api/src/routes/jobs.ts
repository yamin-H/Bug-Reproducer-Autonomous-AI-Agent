import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import jobQueue from "../queues/jobQueue";
import redis from "../lib/redis";

const router = Router();

const GITHUB_ISSUE_URL_PATTERN = /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/;

function isValidGithubIssueUrl(url: string): boolean {
    return GITHUB_ISSUE_URL_PATTERN.test(url);
}

/** Validate request body for creating a job. */
function validateCreateJob(body: any): string | null {
    if (!body || !body.issueUrl) return "issueUrl is required";
    if (!isValidGithubIssueUrl(body.issueUrl)) return "Invalid GitHub issue URL";
    if (!body.githubToken) return "githubToken is required";
    if (typeof body.githubToken !== "string" || body.githubToken.length < 10) {
        return "githubToken appears to be invalid";
    }
    return null;
}

// ─── POST /api/jobs — Create a new job ───────────────────────────────
router.post("/", async (req: Request, res: Response) => {
    const validationError = validateCreateJob(req.body);
    if (validationError) {
        res.status(400).json({ error: validationError });
        return;
    }

    const { issueUrl, githubToken } = req.body;

    try {
        const job = await prisma.job.create({
            data: { issueUrl, status: "PENDING" },
        });

        await jobQueue.add("process-issue", {
            jobId: job.id,
            issueUrl,
            githubToken,
        });

        console.log(`[Jobs] Created job: ${job.id} and pushed to queue`);
        res.status(201).json({
            jobId: job.id,
            status: job.status,
            createdAt: job.createdAt,
        });
    } catch (error) {
        console.error("[Jobs] Error creating job:", error);
        res.status(500).json({ error: "Failed to create job" });
    }
});

// ─── GET /api/jobs/:id — Get job status ──────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const job = await prisma.job.findUnique({
            where: { id },
        });

        if (!job) {
            res.status(404).json({ error: "Job not found" });
            return;
        }

        res.json(job);
    } catch (error) {
        console.error("[Jobs] Error fetching job:", error);
        res.status(500).json({ error: "Failed to fetch job" });
    }
});

// ─── GET /api/jobs/:id/stream — SSE log stream ───────────────────────
router.get("/:id/stream", async (req: Request, res: Response) => {
    const { id } = req.params;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    console.log(`[SSE] Client connected for job: ${id}`);
    const channel = `job:${id}:logs`;

    // Reuse the existing Redis client for subscribing.
    // ioredis supports simultaneous pub/sub on the same connection.
    // We use a duplicate so we don't interfere with the main client's db selection.
    const subscriber = redis.duplicate();

    try {
        await subscriber.subscribe(channel);
        console.log(`[SSE] Subscribed to Redis channel: ${channel}`);
    } catch (err) {
        console.error(`[SSE] Failed to subscribe:`, err);
        res.write(`data: ${JSON.stringify({ step: "error", status: "error", detail: "Failed to connect to log stream" })}\n\n`);
        res.end();
        return;
    }

    subscriber.on("message", (ch, message) => {
        try {
            res.write(`data: ${message}\n\n`);
        } catch {
            // Client may have disconnected
            subscriber.unsubscribe(channel).catch(() => {});
            subscriber.quit().catch(() => {});
        }
    });

    const heartbeat = setInterval(() => {
        try {
            res.write(`data: ${JSON.stringify({ step: "heartbeat", status: "ping" })}\n\n`);
        } catch {
            clearInterval(heartbeat);
        }
    }, 30000);

    req.on("close", async () => {
        console.log(`[SSE] Client disconnected for job: ${id}`);
        clearInterval(heartbeat);
        try {
            await subscriber.unsubscribe(channel);
            await subscriber.quit();
        } catch {
            // Ignore cleanup errors
        }
    });
});

// ─── POST /api/jobs/:id/complete — Called by Python agent ────────────
router.post("/:id/complete", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { status, prUrl, testCode, fixCode, fixedFilePath, errorMessage } = req.body;

    console.log(`[Jobs] Job ${id} completed with status: ${status}`);

    if (!status || !["SUCCESS", "FAILED"].includes(status)) {
        res.status(400).json({ error: "status must be SUCCESS or FAILED" });
        return;
    }

    try {
        const job = await prisma.job.update({
            where: { id },
            data: {
                status: status === "SUCCESS" ? "SUCCESS" : "FAILED",
                prUrl: prUrl || null,
                testCode: testCode || null,
                fixCode: fixCode || null,
                fixedFilePath: fixedFilePath || null,
                errorMessage: errorMessage || null,
            },
        });

        // Publish completion event via the existing Redis client
        await redis.publish(
            `job:${id}:logs`,
            JSON.stringify({
                step: "Job complete",
                status: status === "SUCCESS" ? "done" : "error",
                detail: prUrl || errorMessage || "",
                timestamp: Date.now(),
            })
        );

        res.json({ success: true, job });
    } catch (error) {
        console.error(`[Jobs] Error completing job ${id}:`, error);
        res.status(500).json({ error: "Failed to update job" });
    }
});

export default router;
