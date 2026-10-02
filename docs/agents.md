# Agent Development Guide

This document describes the three specialist agents and how to run/test them.

## Overview

Each agent is a standalone HTTP service that exposes a POST `/ask` endpoint:

```
Request:  POST /ask  { "request": "user question here" }
Response: 200 OK     { "answer": "agent's answer here" }
```

All three agents share the same HTTP contract (defined in `src/schemas/agent-http.ts`) and use the same server framework (`agents/shared/server.ts`).

---

## The Three Agents

### 1. Invoice Agent (port 4001)

**Domain:** Invoice, billing, payment questions

**System prompt:** Specializes in:
- Overdue invoices
- Payment status
- Billing questions
- Refunds and credits

**Example requests:**
- "Why is my invoice overdue?"
- "How do I request a refund?"
- "What payment methods do you accept?"

**Files:**
- `agents/invoice/handler.ts` — business logic + LLM prompt
- `agents/invoice/index.ts` — server entry point

---

### 2. Contract Agent (port 4002)

**Domain:** Contract, legal, and obligation questions

**System prompt:** Specializes in:
- Contract clauses and terms
- Contractual obligations
- Termination conditions
- Legal language interpretation

**Example requests:**
- "What is a termination clause?"
- "Explain the notice period in my contract"
- "What are my obligations under this agreement?"

**Files:**
- `agents/contract/handler.ts` — business logic + LLM prompt
- `agents/contract/index.ts` — server entry point

**Note:** Includes a disclaimer that guidance is informational only, not formal legal advice.

---

### 3. Brand Agent (port 4003)

**Domain:** Marketing copy, taglines, product descriptions

**System prompt:** Specializes in:
- Marketing copy and product descriptions
- Taglines and slogans
- Social media posts
- Brand messaging

**Example requests:**
- "Write a tagline for an AI router"
- "Create a product description for a developer tool"
- "Generate three social media posts about our new feature"

**Files:**
- `agents/brand/handler.ts` — business logic + LLM prompt
- `agents/brand/index.ts` — server entry point

---

## Running Agents

### Prerequisites

1. Set `LLM_API_KEY` in `.env` (OpenAI-compatible API key)
2. Optionally configure `LLM_BASE_URL` and `LLM_MODEL` (defaults to OpenAI)

### Start a single agent

```bash
npm run dev agents/invoice/index.ts   # Invoice agent on http://localhost:4001
npm run dev agents/contract/index.ts  # Contract agent on http://localhost:4002
npm run dev agents/brand/index.ts     # Brand agent on http://localhost:4003
```

### Start all agents at once

```bash
bash scripts/start-all-agents.sh
```

This starts all three agents in the background. Press Ctrl+C to stop all.

---

## Testing Agents

### Health checks

```bash
curl http://localhost:4001/health
curl http://localhost:4002/health
curl http://localhost:4003/health
```

Expected response: `{"status":"ok","agent":"Invoice Agent"}`

### POST /ask requests

**Invoice:**
```bash
curl -X POST http://localhost:4001/ask \
  -H "Content-Type: application/json" \
  -d '{"request": "Why is my invoice overdue?"}'
```

**Contract:**
```bash
curl -X POST http://localhost:4002/ask \
  -H "Content-Type: application/json" \
  -d '{"request": "What is a termination clause?"}'
```

**Brand:**
```bash
curl -X POST http://localhost:4003/ask \
  -H "Content-Type: application/json" \
  -d '{"request": "Write a tagline for an AI router product"}'
```

### Invalid requests

**Empty request:**
```bash
curl -X POST http://localhost:4001/ask \
  -H "Content-Type: application/json" \
  -d '{"request": ""}'
```

Expected: `400 Bad Request` with error message.

**Missing request field:**
```bash
curl -X POST http://localhost:4001/ask \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `400 Bad Request` with validation error.

---

## Shared Infrastructure

### `agents/shared/server.ts`

Reusable Fastify server setup that:
- Creates a Fastify instance with logging
- Registers GET `/health` and POST `/ask` routes
- Validates request/response with Zod
- Delegates answer generation to the agent-specific handler
- Returns 400 for invalid requests, 500 for handler errors

### `src/schemas/agent-http.ts`

Zod schemas for the agent HTTP contract:
- `agentRequestSchema` — POST /ask request body
- `agentResponseSchema` — POST /ask response body
- `agentErrorResponseSchema` — error responses

### `src/llm/client.ts`

Simple OpenAI-compatible LLM client:
- `callLLM(messages)` → sends messages to LLM, returns content
- Uses `config.llm.*` settings from `.env`
- Throws on API errors or malformed responses

---

## Adding a Fourth Agent

To add a new specialist agent (e.g., legal, HR, technical):

1. **Create the handler:**
   ```typescript
   // agents/legal/handler.ts
   import { callLLM } from "../../src/llm/client.js";
   
   const SYSTEM_PROMPT = `You are a legal specialist...`;
   
   export async function handleLegalRequest(request: string): Promise<string> {
     const response = await callLLM([
       { role: "system", content: SYSTEM_PROMPT },
       { role: "user", content: request },
     ]);
     return response.content;
   }
   ```

2. **Create the server entry point:**
   ```typescript
   // agents/legal/index.ts
   import { createAgentServer } from "../shared/server.js";
   import { handleLegalRequest } from "./handler.js";
   
   async function main() {
     await createAgentServer({
       name: "Legal Agent",
       port: 4004,
       handler: handleLegalRequest,
     });
   }
   main();
   ```

3. **Deploy and register in ENS:**
   - Deploy the agent to a public HTTPS endpoint
   - Register a new ENS name (e.g., `legal.priya.eth`) on Sepolia
   - Set its four `agent:*` text records
   - Add `legal.priya.eth` to `registry.priya.eth`'s `agent:index` record

The router will discover it automatically — no router source changes needed.

---

## Development vs Production

**Development (localhost):**
- Agents run on `http://127.0.0.1:400X`
- Acceptable for local testing
- The router's HTTPS check includes a `localhost` exception

**Production (ENS endpoints):**
- Agents must be deployed to HTTPS URLs
- Set each agent's `agent:endpoint` record to its public HTTPS URL
- The router rejects `http://` endpoints (except localhost)

Example production ENS records:
```
invoices.priya.eth:
  agent:endpoint = https://invoice-agent.example.com/ask

contracts.priya.eth:
  agent:endpoint = https://contract-agent.example.com/ask

brand.priya.eth:
  agent:endpoint = https://brand-agent.example.com/ask
```

---

## Architecture Notes

### Why separate services?

- Each agent can scale independently
- Different deployment targets (serverless, containers, etc.)
- Clear domain boundaries
- Easy to add/remove/update agents without touching router code

### Why a shared server framework?

- Reduces boilerplate
- Enforces consistent HTTP contract across all agents
- Centralizes request/response validation
- Makes it trivial to add new agents

### Why LLM-based?

- Flexible: handles a wide range of questions within each domain
- No need to hardcode decision trees or FAQ databases
- Easy to tune via system prompts
- Realistic for a 48-hour hackathon prototype

For production, agents could use:
- RAG (retrieval-augmented generation) over domain-specific docs
- Fine-tuned models
- Hybrid LLM + database/API lookups
- Rule-based logic for deterministic cases
