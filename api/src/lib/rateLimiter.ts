/** Simple in-memory rate limiter for Express.
 *  Limits requests from the same IP within a sliding window.
 *  In production, use a Redis-backed rate limiter instead.
 */

import { Request, Response, NextFunction } from "express";

interface RateEntry {
    count: number;
    resetAt: number;
}

const ipMap = new Map<string, RateEntry>();

// Clean up stale entries every 60 seconds
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of ipMap.entries()) {
        if (entry.resetAt <= now) ipMap.delete(ip);
    }
}, 60_000);

interface RateLimiterOptions {
    /** Max requests allowed in the window. */
    maxRequests: number;
    /** Window duration in milliseconds. */
    windowMs: number;
    /** HTTP status code to return on limit. */
    statusCode?: number;
}

export function rateLimiter(options: RateLimiterOptions) {
    const { maxRequests, windowMs, statusCode = 429 } = options;

    return (req: Request, res: Response, next: NextFunction) => {
        const ip = req.ip || req.socket.remoteAddress || "unknown";
        const now = Date.now();
        const entry = ipMap.get(ip);

        if (!entry || entry.resetAt <= now) {
            // New window
            ipMap.set(ip, { count: 1, resetAt: now + windowMs });
            next();
            return;
        }

        entry.count += 1;

        if (entry.count > maxRequests) {
            res.status(statusCode).json({
                error: `Too many requests. Try again in ${Math.ceil((entry.resetAt - now) / 1000)}s.`,
            });
            return;
        }

        next();
    };
}
