"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ issueUrl, githubToken })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Something went wrong");
                return;
            }

            router.push(`/job/${data.jobId}`);

        } catch (err) {
            setError("Failed to connect to API");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSubmit();
    };

    return (
        <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-zinc-950 to-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-violet-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="w-full max-w-lg space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out">
                
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-2 tracking-wide uppercase">
                        AI-Powered Agent
                    </div>
                    <h1 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-indigo-100 to-zinc-400 drop-shadow-sm">
                        Bug Reproducer
                    </h1>
                    <p className="text-zinc-400 text-lg max-w-sm mx-auto font-light leading-relaxed">
                        Paste a GitHub issue. Get a pull request with a fix.
                    </p>
                </div>

                <Card className="bg-zinc-900/60 backdrop-blur-2xl border-white/5 shadow-2xl overflow-hidden ring-1 ring-white/10 transition-all duration-300 hover:ring-white/20">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
                    <CardHeader className="relative pb-4">
                        <CardTitle className="text-xl text-zinc-100 font-semibold tracking-tight">Submit a Bug</CardTitle>
                        <CardDescription className="text-zinc-400 text-sm leading-relaxed">
                            The AI reads your repo, writes a failing test, generates a fix and opens a PR — <span className="text-indigo-300 font-medium">automatically</span>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 relative">
                        <div className="space-y-2 group">
                            <label className="text-sm font-medium text-zinc-300 transition-colors group-focus-within:text-indigo-400">GitHub Issue URL</label>
                            <Input
                                placeholder="https://github.com/owner/repo/issues/42"
                                value={issueUrl}
                                onChange={(e) => setIssueUrl(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="bg-zinc-950/50 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 transition-all shadow-inner h-11"
                            />
                        </div>

                        <div className="space-y-2 group">
                            <label className="text-sm font-medium text-zinc-300 transition-colors group-focus-within:text-indigo-400">GitHub Token</label>
                            <Input
                                type="password"
                                placeholder="ghp_xxxxxxxxxxxx"
                                value={githubToken}
                                onChange={(e) => setGithubToken(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="bg-zinc-950/50 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 transition-all shadow-inner h-11"
                            />
                            <p className="text-xs text-zinc-500 font-medium">
                                Needs <code className="text-zinc-400 bg-zinc-800/50 px-1 py-0.5 rounded">repo</code> scope. Used to read code and open PRs.
                            </p>
                        </div>

                        {error && (
                            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex items-center animate-in fade-in zoom-in-95 duration-200">
                                <span className="mr-2">⚠️</span> {error}
                            </div>
                        )}

                        <Button
                            className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-semibold shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-indigo-500/40 hover:-translate-y-0.5 h-12 text-md mt-2 relative overflow-hidden"
                            onClick={handleSubmit}
                            disabled={loading}
                        >
                            {loading && (
                                <span className="absolute inset-0 bg-white/20 animate-pulse" />
                            )}
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Deploying Agent...
                                    </>
                                ) : "Reproduce Bug →"}
                            </span>
                        </Button>
                    </CardContent>
                </Card>

                <p className="text-center text-xs text-zinc-500 font-medium flex items-center justify-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Supports Python and TypeScript repositories
                </p>

            </div>
        </main>
    );
}