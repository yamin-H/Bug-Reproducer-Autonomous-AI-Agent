# Bug Reproducer

An autonomous AI agent that takes a GitHub issue URL and automatically reproduces the bug, writes a failing test, generates a fix, and opens a Pull Request — end to end, no human involvement.

---

## Demo

> Paste a GitHub issue URL → Watch the AI work in real time → Get a PR with a test and fix

![Demo](./demo.gif)

---

## How It Works

```
User submits GitHub issue URL
         ↓
Agent reads the repository and identifies relevant files
         ↓
LLM writes a failing test that reproduces the bug
         ↓
Test runs in a sandbox to confirm the bug exists
         ↓
LLM generates a minimal fix
         ↓
Fix is verified by running the test again
         ↓
Branch created → files pushed → Pull Request opened
```

---

## Tech Stack

### Agent — Python
| Tool | Purpose |
|------|---------|
| FastAPI | Agent API server |
| LangGraph | Autonomous agent loop with conditional retry edges |
| LangChain + Groq (Llama 3.3 70B) | LLM reasoning |
| GitHub API | Fetch issues, read files, push branches, open PRs |
| Redis | Pub/sub for real-time log streaming |
| subprocess | Sandboxed code execution |

### API — Node.js
| Tool | Purpose |
|------|---------|
| Express + TypeScript | REST API |
| BullMQ | Job queue backed by Redis |
| Prisma + PostgreSQL (Neon) | Job storage |
| SSE (Server-Sent Events) | Stream live logs to browser |
| ioredis | Redis client |

### Frontend — Next.js
| Tool | Purpose |
|------|---------|
| Next.js 14 App Router | Framework |
| shadcn/ui + Tailwind CSS | UI components and styling |
| EventSource API | Receive live logs from SSE stream |

---

## Agent Architecture

A LangGraph graph with **7 nodes** and **2 conditional retry loops**:

```
fetch_issue → analyze_repo → write_test → run_test
                                               ↓
                                        bug confirmed?
                                        ├── NO  → retry write_test (max 3x)
                                        └── YES → write_fix → verify_fix
                                                                    ↓
                                                             fix works?
                                                             ├── NO  → retry write_fix (max 3x)
                                                             └── YES → open_pr
```

---

## Project Structure

```
bug-reproducer/
│
├── agent/                        # Python FastAPI + LangGraph agent
│   ├── graph/
│   │   ├── nodes/                # One file per agent node
│   │   ├── state.py              # Shared AgentState TypedDict
│   │   └── agent.py              # LangGraph graph definition
│   ├── services/
│   │   ├── llm.py                # LangChain + Groq setup
│   │   └── publisher.py          # Redis pub/sub log publisher
│   ├── core/
│   │   ├── config.py             # Pydantic settings
│   │   └── utils.py              # GitHub URL parser
│   └── main.py                   # FastAPI entry point
│
├── api/                          # Node.js Express API
│   ├── src/
│   │   ├── routes/
│   │   │   └── jobs.ts           # POST /jobs, GET /jobs/:id, SSE stream
│   │   ├── workers/
│   │   │   └── jobWorker.ts      # BullMQ worker → calls Python agent
│   │   ├── queues/
│   │   │   └── jobQueue.ts       # BullMQ queue definition
│   │   ├── lib/
│   │   │   ├── prisma.ts         # Prisma client
│   │   │   └── redis.ts          # Redis client
│   │   └── app.ts                # Express entry point
│   └── prisma/
│       └── schema.prisma         # Job model
│
└── frontend/                     # Next.js frontend
    └── app/
        ├── page.tsx              # Landing page — submit issue URL
        └── job/[id]/
            └── page.tsx          # Live job viewer with SSE logs
```

---

## Running Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker (for Redis)
- [Neon](https://neon.tech) account — free PostgreSQL
- [Groq](https://console.groq.com) API key — free
- GitHub personal access token with `repo` scope

---

### 1. Start Redis
```bash
docker run -d --name redis-local -p 6379:6379 redis:7-alpine
```

### 2. Start Python Agent
```bash
cd agent
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Start Node.js API
```bash
cd api
npm install
npx prisma db push
npm run dev
```

### 4. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

### 5. Open your browser
```
http://localhost:3000
```

---

## Environment Variables

### `agent/.env`
```env
GROQ_API_KEY=
GITHUB_TOKEN=
REDIS_URL=redis://localhost:6379
DATABASE_URL=
ENVIRONMENT=development
```

### `api/.env`
```env
PORT=3001
DATABASE_URL=
REDIS_URL=redis://localhost:6379
PYTHON_AGENT_URL=http://localhost:8000
```

### `frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## What Makes This Different

Most AI coding tools do generic code review or completion. Bug Reproducer solves a specific, high-value problem — **autonomous bug reproduction and fixing** — using a multi-step reasoning loop that:

- Handles retries automatically when tests or fixes don't work
- Validates its own output by actually running code in a sandbox
- Produces a reviewable Pull Request rather than just suggesting a fix in chat

The architecture separates concerns cleanly: **Python** owns all AI reasoning, **Node.js** owns job management and streaming, and the **frontend** just listens. Each layer can be swapped or scaled independently.

---

## Supported Languages

- Python
- TypeScript