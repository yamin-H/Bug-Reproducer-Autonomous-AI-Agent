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
        <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="w-full max-w-lg space-y-6">

                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight text-zinc-100">
                        Bug Reproducer
                    </h1>
                    <p className="text-zinc-400 text-base">
                        Paste a GitHub issue. Get a pull request with a fix.
                    </p>
                </div>

                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-zinc-100">Submit a Bug</CardTitle>
                        <CardDescription className="text-zinc-500">
                            The AI reads your repo, writes a failing test, generates a fix and opens a PR — automatically.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">GitHub Issue URL</label>
                            <Input
                                placeholder="https://github.com/owner/repo/issues/42"
                                value={issueUrl}
                                onChange={(e) => setIssueUrl(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">GitHub Token</label>
                            <Input
                                type="password"
                                placeholder="ghp_xxxxxxxxxxxx"
                                value={githubToken}
                                onChange={(e) => setGithubToken(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
                            />
                            <p className="text-xs text-zinc-600">
                                Needs repo scope. Used to read code and open PRs.
                            </p>
                        </div>

                        {error && (
                            <p className="text-sm text-red-400">{error}</p>
                        )}

                        <Button
                            className="w-full bg-zinc-100 hover:bg-white text-zinc-900 font-medium"
                            onClick={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? "Starting agent..." : "Reproduce Bug →"}
                        </Button>
                    </CardContent>
                </Card>

                <p className="text-center text-xs text-zinc-600">
                    Supports Python and TypeScript repositories
                </p>

            </div>
        </main>
    );
}