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
        if (status === "done") return "✅";
        if (status === "error") return "❌";
        return "•";
    };

    const getStatusBadge = (status: string) => {
        if (status === "PENDING") return <Badge variant="secondary">Pending</Badge>;
        if (status === "RUNNING") return <Badge variant="outline">Running</Badge>;
        if (status === "SUCCESS") return <Badge className="bg-green-600">Success</Badge>;
        if (status === "FAILED") return <Badge variant="destructive">Failed</Badge>;
        return null;
    };

    return (
        <main className="min-h-screen bg-background p-6">
            <div className="max-w-3xl mx-auto space-y-6">

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Bug Reproducer</h1>
                        <p className="text-sm text-muted-foreground mt-1">Job ID: {jobId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {connected && (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                                <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
                                Live
                            </span>
                        )}
                        {job && getStatusBadge(job.status)}
                    </div>
                </div>

                {job && (
                    <Card>
                        <CardContent className="pt-4">
                            <p className="text-sm text-muted-foreground">Issue</p>
                            <a
                                href={job.issueUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium hover:underline text-blue-500"
                            >
                                {job.issueUrl}
                            </a>
                        </CardContent>
                    </Card>
                )}

                <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-800 bg-zinc-900">
                        <span className="w-3 h-3 rounded-full bg-red-500/70" />
                        <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                        <span className="w-3 h-3 rounded-full bg-green-500/70" />
                        <span className="ml-3 text-xs text-zinc-500 font-mono">agent output</span>
                    </div>
                    <div className="p-4 min-h-48">
                        {logs.length === 0 ? (
                            <p className="text-sm text-zinc-500 font-mono">Waiting for agent to start...</p>
                        ) : (
                            <div className="space-y-2">
                                {logs.map((log, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <span className="text-base mt-0.5">{getStatusIcon(log.status)}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-mono ${log.status === "done" ? "text-green-400" :
                                                    log.status === "error" ? "text-red-400" :
                                                        "text-zinc-300"
                                                }`}>
                                                {log.step}
                                            </p>
                                            {log.detail && (
                                                <p className="text-xs text-zinc-500 truncate">{log.detail}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {job?.status === "SUCCESS" && job.prUrl && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base text-green-700">
                                ✅ Fix Generated Successfully
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm font-medium mb-1">Pull Request</p>
                                <a
                                    href={job.prUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Button variant="outline" size="sm">
                                        View PR on GitHub →
                                    </Button>
                                </a>
                            </div>

                            {job.fixedFilePath && (
                                <div>
                                    <p className="text-sm font-medium mb-1">Fixed File</p>
                                    <p className="text-xs text-muted-foreground font-mono">{job.fixedFilePath}</p>
                                </div>
                            )}

                            <Separator />

                            {job.testCode && (
                                <div>
                                    <p className="text-sm font-medium mb-2">Generated Test</p>
                                    <pre className="text-xs text-green-600 bg-zinc-950 p-3 rounded-md overflow-x-auto whitespace-pre-wrap border border-zinc-800">
                                        {job.testCode}
                                    </pre>
                                </div>
                            )}

                            {job.fixCode && (
                                <div>
                                    <p className="text-sm font-medium mb-2">Generated Fix</p>
                                    <pre className="text-xs text-blue-600 bg-zinc-950 p-3 rounded-md overflow-x-auto whitespace-pre-wrap border border-zinc-800">
                                        {job.fixCode}
                                    </pre>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {job?.status === "FAILED" && (
                    <Card>
                        <CardContent className="pt-4">
                            <p className="text-sm font-medium text-red-600">Job Failed</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {job.errorMessage || "The agent could not reproduce or fix this bug automatically."}
                            </p>
                        </CardContent>
                    </Card>
                )}

            </div>
        </main>
    );
}