import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import jobRouter from "./routes/jobs";
import "./worker/jobWorker";
import { rateLimiter } from "./lib/rateLimiter";

dotenv.config();

const app = express();

// ─── CORS Configuration ────────────────────────────────────────────
const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL, "http://localhost:3000"]
    : ["http://localhost:3000"];

// Normalize origins by removing trailing slashes
const normalizedAllowed = allowedOrigins.map(url => url.replace(/\/$/, ""));

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. server-to-server, health checks)
        if (!origin) return callback(null, true);

        const normalizedOrigin = origin.replace(/\/$/, "");
        if (normalizedAllowed.includes(normalizedOrigin)) return callback(null, true);

        callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
}));

// ─── Body parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ─── Request logging middleware ────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
    const start = Date.now();
    _res.on("finish", () => {
        const duration = Date.now() - start;
        console.log(`[${req.method}] ${req.originalUrl} → ${_res.statusCode} (${duration}ms)`);
    });
    next();
});

// ─── Rate limiting ─────────────────────────────────────────────────
// Limit POST /api/jobs to 10 requests per IP per minute
app.use("/api/jobs", rateLimiter({ maxRequests: 10, windowMs: 60_000 }));

// ─── Routes ───────────────────────────────────────────────────────
app.use("/api/jobs", jobRouter);

app.get("/health", (_req: Request, res: Response) => {
    res.json({
        status: "ok",
        service: "bug-reproducer-api",
        uptime: process.uptime(),
    });
});

// ─── 404 handler ──────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
});

// ─── Global error handler ──────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[Error]", err.message);

    if (err.message.startsWith("CORS:")) {
        res.status(403).json({ error: err.message });
        return;
    }

    // Express body-parser errors include a `type` property
    const bodyParserErr = err as any;
    if (bodyParserErr.type === "entity.parse.failed") {
        res.status(400).json({ error: "Invalid JSON in request body" });
        return;
    }

    res.status(500).json({
        error: process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message,
    });
});

// ─── Start server ──────────────────────────────────────────────────
const port = process.env.PORT || 3001;

app.listen(port, () => {
    console.log(`[Server] Bug Reproducer API running on port ${port}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
