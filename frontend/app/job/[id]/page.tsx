"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/error-boundary";

interface Log {
    step: string;
    status: "running" | "done" | "error" | "ping";
    detail: string;
    timestamp: number;
}

interface Job {
    id: string;
    issueUrl: string;
    status: string;
    prUrl?: string;
    testCode?: string;
    fixCode?: string;
    fixedFilePath?: string;
    errorMessage?: string;
}

function getStatusBadge(status: string) {
    switch (status) {
        case "PENDING":
            return (
                <Badge variant="secondary" className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 border-none">
                    Pending
                </Badge>
            );
        case "RUNNING":
            return (
                <Badge variant="outline" className="border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30">
                    Running
                </Badge>
            );
        case "SUCCESS":
            return (
                <Badge className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/60 border-none">
                    Success
                </Badge>
            );
        case "FAILED":
            return (
                <Badge variant="destructive" className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/60 border-none">
                    Failed
                </Badge>
            );
        default:
            return null;
    }
}

function formatTimestamp(ts: number): string {
    if (!ts || typeof ts !== "number") return "";
    const date = new Date(ts * 1000);
    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function JobContent() {
    const params = useParams();
    const jobId = params.id as string;
    const [logs, setLogs] = useState<Log[]>([]);
    const [job, setJob] = useState<Job | null>(null);
    const [connected, setConnected] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

    // Fetch initial job data
    useEffect(() => {
        let cancelled = false;
        const fetchJob = async () => {
            try {
                const res = await fetch(`${baseUrl}/api/jobs/${jobId}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (!cancelled) setJob(data);
            } catch {
                if (!cancelled) setFetchError("Failed to load job data");
            }
        };
        fetchJob();
        return () => { cancelled = true; };
    }, [baseUrl, jobId]);

    // Refresh job data
    const refreshJob = useCallback(async () => {
        try {
            const res = await fetch(`${baseUrl}/api/jobs/${jobId}`);
            if (res.ok) {
                const data = await res.json();
                setJob(data);
            }
        } catch {
            // Silently fail — log stream is the main source
        }
    }, [baseUrl, jobId]);

    // SSE connection for live logs
    useEffect(() => {
        let eventSource: EventSource | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

        const connect = () => {
            eventSource = new EventSource(`${baseUrl}/api/jobs/${jobId}/stream`);
            setConnected(true);
            setFetchError(null);

            eventSource.onmessage = (event) => {
                try {
                    const log: Log = JSON.parse(event.data);
                    if (log.status === "ping") return;

                    setLogs((prev) => {
                        const existingIndex = prev.findIndex((l) => l.step === log.step);
                        if (existingIndex !== -1) {
                            const updated = [...prev];
                            updated[existingIndex] = log;
                            return updated;
                        }
                        return [...prev, log];
                    });

                    if (log.step === "Job complete") {
                        setTimeout(refreshJob, 1000);
                    }
                } catch {
                    // Skip malformed messages
                }
            };

            eventSource.onerror = () => {
                setConnected(false);
                eventSource?.close();
                // Attempt reconnect after 3s
                reconnectTimer = setTimeout(connect, 3000);
            };
        };

        connect();

        return () => {
            if (eventSource) eventSource.close();
            if (reconnectTimer) clearTimeout(reconnectTimer);
        };
    }, [baseUrl, jobId, refreshJob]);

    if (fetchError && !job) {
        return (
            <main className="min-h-screen bg-[#F5F5F7] dark:bg-slate-900 p-6 relative overflow-hidden font-sans">
                <div className="max-w-3xl mx-auto mt-12">
                    <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-3xl rounded-2xl p-8 border border-white/60 dark:border-slate-700/60 text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Could not load job</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{fetchError}</p>
                        <Button
                            onClick={refreshJob}
                            className="bg-[#007AFF] hover:bg-[#0066D6] text-white"
                            aria-label="Retry loading job"
                        >
                            Retry
                        </Button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#F5F5F7] dark:bg-slate-900 p-6 relative overflow-hidden font-sans">
            {/* Background glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/40 dark:bg-blue-800/20 blur-[100px] rounded-full pointer-events-none" aria-hidden="true" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-200/40 dark:bg-purple-800/20 blur-[100px] rounded-full pointer-events-none" aria-hidden="true" />

            <div className="max-w-3xl mx-auto space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
                {/* Header */}
                <div className="flex items-center justify-between bg-white/70 dark:bg-slate-800/70 backdrop-blur-3xl p-5 rounded-2xl border border-white/60 dark:border-slate-700/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                            Bug Reproducer
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                            Job ID: {jobId}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {connected && (
                            <span
                                className="flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800"
                                aria-label="Live connection active"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                                Live
                            </span>
                        )}
                        {!connected && logs.length > 0 && (
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-full">
                                Disconnected
                            </span>
                        )}
                        {job && getStatusBadge(job.status)}
                    </div>
                </div>

                {/* Target Issue */}
                {job && (
                    <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-3xl p-4 rounded-xl border border-white/60 dark:border-slate-700/60 shadow-sm">
                        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                            Target Issue
                        </p>
                        <a
                            href={job.issueUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-[#007AFF] dark:text-blue-400 hover:text-[#0066D6] dark:hover:text-blue-300 hover:underline transition-colors flex items-center gap-1"
                        >
                            {job.issueUrl}
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    </div>
                )}

                {/* Terminal Window */}
                <div className="bg-slate-900 dark:bg-slate-950 rounded-xl overflow-hidden shadow-[0_20px_50px_rgb(0,0,0,0.2)] border border-slate-700 dark:border-slate-800">
                    <div className="flex items-center justify-between px-4 py-3 bg-[#E5E5EA] dark:bg-slate-800 border-b border-[#D1D1D6] dark:border-slate-700">
                        <div className="flex gap-2" aria-hidden="true">
                            <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
                            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                            <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 font-sans tracking-wide">
                            agent-terminal
                        </span>
                        <div className="w-12" /> {/* Spacer */}
                    </div>
                    <div
                        className="p-5 min-h-[300px] max-h-[500px] overflow-y-auto font-mono text-[13px] leading-relaxed text-slate-300"
                        role="log"
                        aria-label="Agent execution log"
                        aria-live="polite"
                    >
                        {logs.length === 0 ? (
                            <div className="flex items-center gap-2 text-slate-500">
                                <span className="animate-pulse" aria-hidden="true">●</span>
                                Waiting for agent to start...
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {logs.map((log, index) => (
                                    <div key={index} className="animate-in slide-in-from-left-2 fade-in duration-200">
                                        <div className="flex items-start gap-2">
                                            <span className="text-blue-400 font-bold shrink-0" aria-hidden="true">➜</span>
                                            <span className="text-purple-400 font-bold shrink-0" aria-hidden="true">bug-reproducer</span>
                                            <span
                                                className={
                                                    log.status === "done"
                                                        ? "text-green-400"
                                                        : log.status === "error"
                                                            ? "text-red-400"
                                                            : "text-slate-100"
                                                }
                                            >
                                                {log.step}
                                            </span>
                                            <span className="text-[10px] text-slate-600 ml-auto pt-1 shrink-0">
                                                {formatTimestamp(log.timestamp)}
                                            </span>
                                        </div>
                                        {log.detail && (
                                            <div className="pl-5 text-slate-400 text-xs mt-0.5 whitespace-pre-wrap">
                                                {log.detail}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Success result */}
                {job?.status === "SUCCESS" && job.prUrl && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-green-50 dark:bg-green-900/30 px-6 py-4 border-b border-green-100 dark:border-green-800 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center text-green-600 dark:text-green-300">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-semibold text-green-800 dark:text-green-300">
                                Fix Generated Successfully
                            </h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        Pull Request Ready
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        The agent has pushed the code and opened a PR.
                                    </p>
                                </div>
                                <a
                                    href={job.prUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Review pull request on GitHub"
                                >
                                    <Button className="w-full sm:w-auto bg-[#27C93F] hover:bg-[#20A934] text-white font-medium shadow-sm transition-colors rounded-lg">
                                        Review PR on GitHub
                                    </Button>
                                </a>
                            </div>

                            {job.fixedFilePath && (
                                <div>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                        Fixed File
                                    </p>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                        {job.fixedFilePath}
                                    </p>
                                </div>
                            )}

                            {job.testCode && (
                                <div>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                        Generated Failing Test
                                    </p>
                                    <pre className="text-[13px] text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap border border-slate-200 dark:border-slate-700 font-mono shadow-inner">
                                        {job.testCode}
                                    </pre>
                                </div>
                            )}

                            {job.fixCode && (
                                <div>
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                        Proposed Fix Code
                                    </p>
                                    <pre className="text-[13px] text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap border border-slate-200 dark:border-slate-700 font-mono shadow-inner">
                                        {job.fixCode}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Failure result */}
                {job?.status === "FAILED" && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-6 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 dark:text-red-400 shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                                    Job Failed
                                </h2>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {job.errorMessage ||
                                        "The agent encountered an unexpected error and could not automatically reproduce or fix this bug. Check the terminal logs above for details."}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function JobPage() {
    return (
        <ErrorBoundary>
            <JobContent />
        </ErrorBoundary>
    );
}
