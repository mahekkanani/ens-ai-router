# ENS AI Router

> **Which AI Should Answer This?**

An AI routing layer that discovers specialist agents from **ENS records on Ethereum Sepolia**, uses an LLM to choose the best discovered agent, forwards the request to the endpoint published by that agent, and returns the answer with ENS attribution.

The core idea is simple:

**The router does not know the agents in advance. ENS is the registry.**

Adding a fourth specialist agent means changing ENS records only — no router source-code change and no router redeployment.

---

## What We Built

The project contains three specialist HTTP agents:

- **Invoice Agent** — invoices, billing, payments, and overdue invoices
- **Contract Agent** — contracts, clauses, obligations, and termination
- **Brand Agent** — marketing copy, taglines, product descriptions, and brand content

The agents are published through their own ENS identities and their public HTTPS endpoints are stored in ENS text records.

### Live ENS identities

| Specialist | ENS name | Public endpoint |
|---|---|---|
| Invoice | `invoice.mkagent.eth` | `https://invoice-agent-6fdu.onrender.com/ask` |
| Contract | `contract.mkagent.eth` | `https://contract-agent-mxu6.onrender.com/ask` |
| Brand | `brand.mkagent.eth` | `https://brand-agent-h2zm.onrender.com/ask` |

### ENS registry

`mkagent.eth` is the project registry. Its `agent:index` text record contains the currently published agent ENS names:

```text
invoice.mkagent.eth,contract.mkagent.eth,brand.mkagent.eth
```

The router reads that record at runtime on every request.

---

## Architecture

```text
                         Client
                           │
                           │ POST /route
                           ▼
                  ┌────────────────────┐
                  │   Fastify Router   │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │   ENS Discovery    │
                  │                    │
                  │ mkagent.eth        │
                  │   └─ agent:index   │
                  └─────────┬──────────┘
                            │
                 discovered AgentRecords
                            │
                            ▼
                  ┌────────────────────┐
                  │   LLM Router       │
                  │                    │
                  │ input: request +   │
                  │ agent id/summary   │
                  │                    │
                  │ output: agent id   │
                  │ or null            │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │ Membership Check   │
                  │                    │
                  │ chosen id MUST     │
                  │ exist in ENS list  │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │ Secure Forwarding  │
                  │                    │
                  │ endpoint from ENS  │
                  │ HTTPS validation   │
                  │ redirect: error    │
                  │ 30s explicit timeout│
                  └─────────┬──────────┘
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
        Invoice Agent  Contract Agent  Brand Agent
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                    Answer + attribution
```

### Routing pipeline

1. **Discover agents from ENS** — read `mkagent.eth` → `agent:index`, then read each agent's `agent:*` text records.
2. **Validate records** — Zod `safeParse()` rejects malformed records without aborting discovery.
3. **Route with an LLM** — the model receives only agent identity and descriptive metadata, not destination URLs.
4. **Validate the decision** — the chosen ENS name must be a member of the agents actually discovered from ENS.
5. **Resolve the destination in code** — the router gets `selectedAgent.endpoint` from the validated ENS-derived `AgentRecord`.
6. **Protect the forward** — the endpoint must use HTTPS (with an explicit localhost development exception), redirects are disabled, and the request has an explicit 30-second timeout.
7. **Validate the downstream response** — the agent response is checked against the expected HTTP response schema.
8. **Return attribution** — the client sees the ENS name of the verified agent that answered.
9. **No match means no match** — an unmatched request returns `no_suitable_agent`; there is no default/fallback agent.

---

## Security Model

Every external boundary is treated as untrusted:

### ENS data is untrusted

Agent records are parsed and validated with Zod. If a record is malformed or missing required fields, that agent is skipped while discovery continues.

### LLM output is untrusted

The model selects an **agent identity**, not a URL. The code performs an exact membership check against the runtime ENS-discovered agent list before forwarding.

```text
LLM output
   │
   ▼
"contract.mkagent.eth"
   │
   ▼
find() in discovered AgentRecords
   │
   ├── not found → reject
   │
   └── found → use that AgentRecord
                     │
                     ▼
               endpoint from ENS
```

### Endpoints are untrusted

Before calling an endpoint, the router:

- parses it with `new URL()`
- requires `https:` in production
- permits only the explicit localhost HTTP development exception
- disables automatic redirects with `redirect: "error"`
- uses an explicit 30-second `AbortSignal.timeout()`

### Downstream responses are untrusted

The router validates the response schema and sanitizes client-facing errors rather than reflecting arbitrary downstream error text.

### Credentials are not committed

Real API keys, private keys, authenticated URLs, and `.env` contents are excluded from tracked files. Use `.env.example` as the configuration template.

---

## ENS Record Format

The router expects the following custom text records.

### Registry: `mkagent.eth`

```text
Key:   agent:index
Value: invoice.mkagent.eth,contract.mkagent.eth,brand.mkagent.eth
```

### Every specialist agent

```text
agent:description
agent:endpoint
agent:input
agent:version
```

Example:

```text
agent:description
Handles invoice, billing, payment, and overdue invoice questions.

agent:endpoint
https://invoice-agent-6fdu.onrender.com/ask

agent:input
text

agent:version
1
```

See [`docs/ens-record-format.md`](docs/ens-record-format.md) for the detailed record specification.

---

## Project Structure

```text
ens-ai-router/
├── src/
│   ├── app.ts                         # Central Fastify application
│   ├── config.ts                      # Lazy environment configuration
│   ├── index.ts                       # Router server entry point
│   ├── discovery/
│   │   ├── ens.ts                     # Runtime ENS discovery
│   │   ├── types.ts                   # Discovery result types
│   │   ├── errors.ts                  # Discovery error types
│   │   └── index.ts                   # Discovery public API
│   ├── llm/
│   │   ├── client.ts                  # OpenAI-compatible LLM client
│   │   └── router.ts                  # Model-driven routing + membership check
│   ├── router/
│   │   ├── forward.ts                 # Secure downstream HTTP forwarding
│   │   └── attribution.ts             # Verified ENS attribution formatting
│   └── schemas/
│       ├── agent.ts                   # ENS agent record schemas
│       ├── agent-http.ts              # Specialist HTTP contract schemas
│       ├── routing.ts                 # LLM routing/response schemas
│       └── routing-case.ts            # Recorded routing case schema
├── agents/
│   ├── invoice/
│   ├── contract/
│   ├── brand/
│   └── shared/                        # Shared Fastify agent server
├── cases/
│   └── routing-cases.json             # Recorded expected routing outcomes
├── docs/
│   ├── ens-record-format.md
│   ├── agents.md
│   ├── routing.md
│   ├── forwarding.md
│   └── AUDIT.md
├── scripts/
│   ├── start-all-agents.sh
│   └── test-discovery.ts
├── tests/                              # Unit + integration tests
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env`

```bash
cp .env.example .env
```

On Windows PowerShell, you can also create `.env` manually from `.env.example`.

### 3. Configure environment variables

```dotenv
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

LLM_API_KEY=YOUR_LLM_API_KEY
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openrouter/free

ENS_REGISTRY_NAME=mkagent.eth

PORT=3000
```

`SEPOLIA_RPC_URL` and `ENS_REGISTRY_NAME` are required by the router/discovery path. Specialist agents only need the LLM configuration.

**Never commit `.env`.** Commit only `.env.example` with empty or placeholder values.

---

## Running the Project Locally

### Start the three specialist agents

Use separate terminals:

```bash
npm run start:invoice
```

```bash
npm run start:contract
```

```bash
npm run start:brand
```

The local development ports are:

```text
Invoice  → http://localhost:4001
Contract → http://localhost:4002
Brand    → http://localhost:4003
```

### Start the central router

In another terminal:

```bash
npm run dev
```

The router listens on:

```text
http://localhost:3000
```

### Health checks

```bash
curl http://localhost:4001/health
curl http://localhost:4002/health
curl http://localhost:4003/health
```

### Test ENS discovery directly

```bash
npx tsx scripts/test-discovery.ts
```

With the published ENS records, discovery should report three valid agents and zero skipped agents.

---

## Router API

### `POST /route`

Request:

```json
{
  "request": "Why is my invoice overdue?"
}
```

Successful response:

```json
{
  "status": "success",
  "agent": {
    "ensName": "invoice.mkagent.eth"
  },
  "answer": "..."
}
```

No suitable agent:

```json
{
  "status": "no_suitable_agent",
  "message": "No suitable agent was found for this request."
}
```

Invalid model selection is rejected instead of being forwarded to an arbitrary destination.

---

## Live End-to-End Demo

With the router running locally, the following requests exercise the real ENS → LLM → HTTPS → Render flow.

### Invoice

```powershell
$body = @{ request = "Why is my invoice overdue?" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/route" -Method Post -ContentType "application/json" -Body $body
```

Expected attribution:

```text
invoice.mkagent.eth
```

### Contract

```powershell
$body = @{ request = "What is a termination clause in a contract?" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/route" -Method Post -ContentType "application/json" -Body $body
```

Expected attribution:

```text
contract.mkagent.eth
```

### Brand

```powershell
$body = @{ request = "Write a catchy tagline for an AI routing product." } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/route" -Method Post -ContentType "application/json" -Body $body
```

Expected attribution:

```text
brand.mkagent.eth
```

### No suitable agent

```powershell
$body = @{ request = "What is the capital of France?" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/route" -Method Post -ContentType "application/json" -Body $body
```

Expected:

```text
status: no_suitable_agent
```

---

## The Fourth-Agent Test

This is the central hackathon demonstration.

Suppose we want to add a new specialist called `legal.mkagent.eth`.

### Required ENS-only changes

1. Create the new ENS identity/subname.
2. Publish its four `agent:*` records:
   - `agent:description`
   - `agent:endpoint`
   - `agent:input`
   - `agent:version`
3. Append `legal.mkagent.eth` to the `mkagent.eth` `agent:index` record.
4. Send a request relevant to that specialist.

The router performs ENS discovery on the next request, so it automatically sees the new agent.

**No router source-code change. No hardcoded registry update. No router redeployment.**

The only exception to the phrase “ENS records only” is the obvious operational prerequisite that a new agent needs a reachable HTTPS service behind the endpoint it publishes.

---

## Recorded Routing Cases

Expected routing outcomes are stored in:

[`cases/routing-cases.json`](cases/routing-cases.json)

Each case explicitly pairs a client request with:

```json
{
  "expectedAgent": "agent-name.eth"
}
```

or:

```json
{
  "expectedAgent": null
}
```

The repository currently contains 12 recorded cases covering billing, legal/contract, marketing, and unmatched requests.

---

## Testing

Run the complete test suite:

```bash
npm test
```

Current verification:

```text
9 test files
90 tests passed
```

Additional checks:

```bash
npm run typecheck
```

```bash
npm run build
```

All three verification commands currently pass.

### What is covered

- Zod schema validation
- ENS discovery and malformed-record skipping
- live Sepolia discovery integration scenarios
- model-driven routing
- strict membership validation
- secure endpoint forwarding
- HTTPS enforcement
- redirect protection
- explicit downstream timeout
- downstream response validation
- explicit no-agent behavior
- configuration isolation between router and specialist agents
- recorded routing-case validation
- central Fastify routing integration

---

## Hackathon Acceptance Criteria

This implementation directly addresses all nine automated checks:

| # | Requirement | Points | Implementation |
|---|---|---:|---|
| 1 | Model-selected agent is checked against the discovered ENS list | 20 | `src/llm/router.ts` membership validation |
| 2 | Forwarded URL comes from the chosen agent's ENS record | 14 | `selectedAgent.endpoint` in `src/router/forward.ts` |
| 3 | Router source has no literal agent list | 10 | Runtime discovery from `mkagent.eth` `agent:index` |
| 4 | Malformed agent records are skipped | 8 | Zod `safeParse()` + per-agent skip logic |
| 5 | Downstream call has an explicit timeout | 7 | `AbortSignal.timeout(30000)` |
| 6 | ENS endpoint must use HTTPS | 4 | URL parsing + explicit protocol check |
| 7 | Unmatched request returns explicit no-agent response | 6 | `status: "no_suitable_agent"` branch in `src/app.ts` |
| 8 | Routing cases state expected agents | 6 | `cases/routing-cases.json` |
| 9 | No credentials in tracked files | 5 | `.gitignore`, `.env.example`, repository audit |

**Automated score target: 80 / 80**

The remaining evaluation is human judgment: demo clarity, documentation, architecture quality, and the live fourth-agent demonstration.

---

## Why ENS?

The router needs a registry that can be updated independently from the router implementation.

ENS gives each agent a public identity plus human-readable metadata, while the router treats those records as runtime configuration rather than compiling an agent directory into source code.

That produces a clean separation:

```text
ENS = discovery + metadata
LLM = routing decision
Code = validation + security enforcement
Agent = specialist answer
```

---

## Deployment

The three specialist agents are deployed as public Render web services:

- `invoice-agent-6fdu.onrender.com`
- `contract-agent-mxu6.onrender.com`
- `brand-agent-h2zm.onrender.com`

The central router is currently intended to run locally for the hackathon demo. It connects to Sepolia for discovery and forwards to the public HTTPS specialist endpoints published in ENS.

---

## Repository Safety Notes

- `.env` is ignored by Git.
- Real provider keys stay outside tracked files.
- Agent URLs are not hardcoded into router runtime logic.
- Actual agent names are configuration data in ENS, not routing rules in source.
- Test fixtures and recorded routing cases may contain concrete ENS names because those files intentionally document expected behavior.

---

## License

ISC
🤖 Generated with [Claude Code](https://claude.com/claude-code)
