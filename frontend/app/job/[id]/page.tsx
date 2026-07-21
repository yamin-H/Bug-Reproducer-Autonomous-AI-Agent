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

    const getStatusBadge = (status: string) => {
        if (status === "PENDING") return <Badge variant="secondary" className="bg-slate-200 text-slate-700 hover:bg-slate-300 border-none">Pending</Badge>;
        if (status === "RUNNING") return <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">Running</Badge>;
        if (status === "SUCCESS") return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-none">Success</Badge>;
        if (status === "FAILED") return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200 border-none">Failed</Badge>;
        return null;
    };

    return (
        <main className="min-h-screen bg-[#F5F5F7] p-6 relative overflow-hidden font-sans">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/40 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-200/40 blur-[100px] rounded-full pointer-events-none" />

            <div className="max-w-3xl mx-auto space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">

                <div className="flex items-center justify-between bg-white/70 backdrop-blur-3xl p-5 rounded-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Bug Reproducer</h1>
                        <p className="text-sm text-slate-500 mt-0.5 font-medium">Job ID: {jobId}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {connected && (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                Live
                            </span>
                        )}
                        {job && getStatusBadge(job.status)}
                    </div>
                </div>

                {job && (
                    <div className="bg-white/70 backdrop-blur-3xl p-4 rounded-xl border border-white/60 shadow-sm">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Issue</p>
                        <a
                            href={job.issueUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-[#007AFF] hover:text-[#0066D6] hover:underline transition-colors flex items-center gap-1"
                        >
                            {job.issueUrl}
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                        </a>
                    </div>
                )}

                {/* macOS Terminal Window */}
                <div className="bg-slate-900 rounded-xl overflow-hidden shadow-[0_20px_50px_rgb(0,0,0,0.2)] border border-slate-700">
                    <div className="flex items-center justify-between px-4 py-3 bg-[#E5E5EA] border-b border-[#D1D1D6]">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]"></div>
                            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]"></div>
                            <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]"></div>
                        </div>
                        <span className="text-xs font-semibold text-slate-600 font-sans tracking-wide">bash — agent-terminal</span>
                        <div className="w-12"></div> {/* Spacer for centering */}
                    </div>
                    <div className="p-5 min-h-[300px] max-h-[500px] overflow-y-auto font-mono text-[13px] leading-relaxed text-slate-300">
                        {logs.length === 0 ? (
                            <div className="flex items-center gap-2 text-slate-500">
                                <span className="animate-pulse">Loading agent sequence...</span>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {logs.map((log, index) => (
                                    <div key={index} className="animate-in slide-in-from-left-2 fade-in duration-200">
                                        <div className="flex items-start gap-2">
                                            <span className="text-blue-400 font-bold">➜</span>
                                            <span className="text-purple-400 font-bold">bug-reproducer</span>
                                            <span className={`${log.status === "done" ? "text-green-400" : log.status === "error" ? "text-red-400" : "text-slate-100"}`}>
                                                {log.step}
                                            </span>
                                            <span className="text-[10px] text-slate-600 ml-auto pt-1">
                                                {new Date(log.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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

                {job?.status === "SUCCESS" && job.prUrl && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-green-50 px-6 py-4 border-b border-green-100 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <h2 className="text-lg font-semibold text-green-800">Fix Generated Successfully</h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Pull Request Ready</p>
                                    <p className="text-xs text-slate-500 mt-0.5">The agent has pushed the code and opened a PR.</p>
                                </div>
                                <a href={job.prUrl} target="_blank" rel="noopener noreferrer">
                                    <Button className="w-full sm:w-auto bg-[#27C93F] hover:bg-[#20A934] text-white font-medium shadow-sm transition-colors rounded-lg">
                                        Review PR on GitHub
                                    </Button>
                                </a>
                            </div>

                            {job.fixedFilePath && (
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Fixed File</p>
                                    <p className="text-sm text-slate-700 font-mono bg-slate-50 p-3 rounded-lg border border-slate-200">{job.fixedFilePath}</p>
                                </div>
                            )}

                            {job.testCode && (
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Generated Failing Test</p>
                                    <pre className="text-[13px] text-slate-800 bg-slate-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap border border-slate-200 font-mono shadow-inner">
                                        {job.testCode}
                                    </pre>
                                </div>
                            )}

                            {job.fixCode && (
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Proposed Fix Code</p>
                                    <pre className="text-[13px] text-slate-800 bg-slate-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap border border-slate-200 font-mono shadow-inner">
                                        {job.fixCode}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {job?.status === "FAILED" && (
                    <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-6 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-slate-900 mb-1">Job Failed</h2>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    {job.errorMessage || "The agent encountered an unexpected error and could not automatically reproduce or fix this bug. Check the terminal logs above for details."}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </main>
    );
}