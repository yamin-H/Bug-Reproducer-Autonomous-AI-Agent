"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

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

export default function JobPage() {
    const params = useParams();
    const jobId = params.id as string;
    const [logs, setLogs] = useState<Log[]>([]);
    const [job, setJob] = useState<Job | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const fetchJob = async () => {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${jobId}`);
            const data = await res.json();
            setJob(data);
        };
        fetchJob();
    }, [jobId]);

    useEffect(() => {
        const eventSource = new EventSource(
            `${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${jobId}/stream`
        );

        setConnected(true);

        eventSource.onmessage = (event) => {
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
                setTimeout(async () => {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${jobId}`);
                    const data = await res.json();
                    setJob(data);
                }, 1000);
            }
        };

        eventSource.onerror = () => {
            setConnected(false);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [jobId]);

    const getStatusIcon = (status: string) => {
        if (status === "running") return "⏳";
        if (status === "done") return "✨";
        if (status === "error") return "❌";
        return "•";
    };

    const getStatusBadge = (status: string) => {
        if (status === "PENDING") return <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">Pending</Badge>;
        if (status === "RUNNING") return <Badge variant="outline" className="border-indigo-500/50 text-indigo-400 bg-indigo-500/10">Running</Badge>;
        if (status === "SUCCESS") return <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Success</Badge>;
        if (status === "FAILED") return <Badge variant="destructive" className="bg-red-500/20 text-red-400 border border-red-500/30">Failed</Badge>;
        return null;
    };

    return (
        <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-zinc-950 to-zinc-950 p-6 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-violet-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-3xl mx-auto space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">

                <div className="flex items-center justify-between bg-zinc-900/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 shadow-lg">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-indigo-200">Bug Reproducer</h1>
                        <p className="text-sm text-zinc-500 mt-1 font-mono">Job ID: {jobId}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {connected && (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Live Connection
                            </span>
                        )}
                        {job && getStatusBadge(job.status)}
                    </div>
                </div>

                {job && (
                    <Card className="bg-zinc-900/60 backdrop-blur-xl border-white/5 shadow-xl transition-all">
                        <CardContent className="pt-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Target Issue</p>
                                <a
                                    href={job.issueUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:underline transition-colors flex items-center gap-1"
                                >
                                    {job.issueUrl}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                </a>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/5">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-900/80">
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                <span className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                                <span className="w-3 h-3 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            </div>
                            <span className="ml-3 text-xs text-zinc-400 font-mono tracking-wide">agent-terminal ~ /jobs/{jobId.slice(0, 8)}</span>
                        </div>
                    </div>
                    <div className="p-5 min-h-[300px] max-h-[500px] overflow-y-auto font-mono text-sm">
                        {logs.length === 0 ? (
                            <div className="flex items-center gap-2 text-zinc-500 animate-pulse">
                                <span className="animate-spin text-indigo-500">⚙️</span>
                                <span>Waiting for agent to initialize sequence...</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {logs.map((log, index) => (
                                    <div key={index} className="flex items-start gap-3 animate-in slide-in-from-left-2 fade-in duration-300">
                                        <span className="mt-0.5">{getStatusIcon(log.status)}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`${log.status === "done" ? "text-emerald-400" :
                                                    log.status === "error" ? "text-red-400" :
                                                        "text-indigo-300"
                                                }`}>
                                                {log.step}
                                            </p>
                                            {log.detail && (
                                                <p className="text-xs text-zinc-500 mt-1 break-words leading-relaxed pl-2 border-l-2 border-zinc-800">{log.detail}</p>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-zinc-600 whitespace-nowrap">
                                            {new Date(log.timestamp * 1000).toLocaleTimeString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {job?.status === "SUCCESS" && job.prUrl && (
                    <Card className="bg-gradient-to-b from-emerald-950/20 to-zinc-900/60 backdrop-blur-xl border-emerald-500/20 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <CardHeader className="border-b border-emerald-500/10 pb-4">
                            <CardTitle className="text-lg text-emerald-400 flex items-center gap-2">
                                <span className="text-xl">✨</span> Fix Generated Successfully
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="flex items-center justify-between bg-emerald-500/5 p-4 rounded-lg border border-emerald-500/10">
                                <div>
                                    <p className="text-sm font-medium text-emerald-200 mb-1">Pull Request Ready</p>
                                    <p className="text-xs text-emerald-500/70">The agent has pushed the code and opened a PR.</p>
                                </div>
                                <a
                                    href={job.prUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Button className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-0.5">
                                        Review PR on GitHub →
                                    </Button>
                                </a>
                            </div>

                            {job.fixedFilePath && (
                                <div>
                                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Fixed File</p>
                                    <p className="text-sm text-zinc-300 font-mono bg-zinc-950/50 p-2.5 rounded-md border border-white/5">{job.fixedFilePath}</p>
                                </div>
                            )}

                            {job.testCode && (
                                <div>
                                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Generated Failing Test</p>
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-md pointer-events-none" />
                                        <pre className="text-xs text-emerald-400/90 bg-zinc-950/80 p-4 rounded-md overflow-x-auto whitespace-pre-wrap border border-white/5 shadow-inner">
                                            {job.testCode}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            {job.fixCode && (
                                <div>
                                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Proposed Fix Code</p>
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-md pointer-events-none" />
                                        <pre className="text-xs text-indigo-300/90 bg-zinc-950/80 p-4 rounded-md overflow-x-auto whitespace-pre-wrap border border-white/5 shadow-inner">
                                            {job.fixCode}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {job?.status === "FAILED" && (
                    <Card className="bg-gradient-to-b from-red-950/20 to-zinc-900/60 backdrop-blur-xl border-red-500/20 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <CardContent className="pt-6 flex items-start gap-4">
                            <div className="p-3 bg-red-500/10 rounded-full border border-red-500/20 text-red-500 text-xl">
                                ⚠️
                            </div>
                            <div>
                                <p className="text-base font-semibold text-red-400 mb-1">Job Failed</p>
                                <p className="text-sm text-red-300/70 leading-relaxed">
                                    {job.errorMessage || "The agent encountered an unexpected error and could not automatically reproduce or fix this bug. Check the terminal logs above for details."}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

            </div>
        </main>
    );
}