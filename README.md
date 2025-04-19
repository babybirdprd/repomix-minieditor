# WIP - repomix orchestrator

This project is a full-stack AI orchestrator for codebase modifications, integrating Repomix and multiple AI providers (OpenAI-compatible, OpenRouter, Gemini).

## Monorepo Structure
- `frontend/`: Vite + React + TypeScript UI
- `backend/`: Node.js + Express + TypeScript API, Repomix integration

## Requirements
- [pnpm](https://pnpm.io/) (enforced)
- Node.js 18+
- Repomix (installed and available in PATH)

## Getting Started

```sh
# Install dependencies
pnpm install

# Start backend
cd backend && pnpm dev

# Start frontend (in another terminal)
cd frontend && pnpm dev
```

The frontend will be available at http://localhost:5173 (proxied to backend at :5174).

## Repomix Integration
The backend can run Repomix CLI commands for advanced codebase operations. See [repomix.com/guide](https://repomix.com/guide/) for more info.

