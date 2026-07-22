"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
    const router = useRouter();
    const [issueUrl, setIssueUrl] = useState("");
    const [githubToken, setGithubToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async () => {
        if (!issueUrl || !githubToken) {
            setError("Both fields are required");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
            const response = await fetch(`${baseUrl}/api/jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ issueUrl, githubToken }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Something went wrong");
                return;
            }

            router.push(`/job/${data.jobId}`);
        } catch {
            setError("Failed to connect to API — is the server running?");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSubmit();
    };

    return (
        <main className="min-h-screen bg-[#F5F5F7] dark:bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Background blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/40 dark:bg-blue-800/20 blur-[100px] rounded-full pointer-events-none" aria-hidden="true" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-200/40 dark:bg-purple-800/20 blur-[100px] rounded-full pointer-events-none" aria-hidden="true" />

            <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in zoom-in-95 duration-500 ease-out">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                        Bug Reproducer
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-[280px] mx-auto font-medium">
                        Paste a GitHub issue. Get a pull request with a fix.
                    </p>
                </div>

                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-3xl border border-white/60 dark:border-slate-700/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] rounded-2xl overflow-hidden relative">
                    {/* Window Header */}
                    <div className="h-10 bg-white/40 dark:bg-slate-800/40 border-b border-black/5 dark:border-white/10 flex items-center px-4 backdrop-blur-md" aria-hidden="true">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
                            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                            <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="space-y-1.5">
                            <label htmlFor="issue-url" className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                GitHub Issue URL
                            </label>
                            <Input
                                id="issue-url"
                                placeholder="https://github.com/owner/repo/issues/42"
                                value={issueUrl}
                                onChange={(e) => setIssueUrl(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-[#007AFF] focus-visible:border-[#007AFF] transition-all shadow-sm rounded-lg h-10"
                                aria-label="GitHub issue URL"
                                autoComplete="url"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="github-token" className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                GitHub Token
                            </label>
                            <Input
                                id="github-token"
                                type="password"
                                placeholder="ghp_xxxxxxxxxxxx"
                                value={githubToken}
                                onChange={(e) => setGithubToken(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-[#007AFF] focus-visible:border-[#007AFF] transition-all shadow-sm rounded-lg h-10"
                                aria-label="GitHub personal access token"
                                autoComplete="off"
                            />
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                Needs <code className="text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-600">repo</code> scope. Used to read code and open PRs.
                            </p>
                        </div>

                        {error && (
                            <div
                                className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium flex items-center animate-in fade-in zoom-in-95 duration-200"
                                role="alert"
                            >
                                <svg className="w-4 h-4 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{error}</span>
                            </div>
                        )}

                        <Button
                            className="w-full bg-[#007AFF] hover:bg-[#0066D6] text-white font-medium shadow-sm transition-all h-10 text-sm mt-2 rounded-lg disabled:opacity-50"
                            onClick={handleSubmit}
                            disabled={loading}
                            aria-label={loading ? "Starting agent..." : "Reproduce bug"}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Starting Agent...
                                </span>
                            ) : (
                                "Reproduce Bug"
                            )}
                        </Button>
                    </div>
                </div>

                <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    Supports Python and TypeScript repositories
                </p>
            </div>
        </main>
    );
}