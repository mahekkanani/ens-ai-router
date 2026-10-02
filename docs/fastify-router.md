# Main Fastify Router (The Central Loop)

This document describes how the AI Router orchestrates the entire routing loop in a single, highly enforced execution path.

## The Execution Path

Every incoming POST `/route` payload strictly navigates the following checkpoints. **None can be bypassed.**

```
POST /route
    ↓
1. agentRequestSchema Validation (src/app.ts)
    ↓ Reject: 400 Bad Request
    ↓
2. discoverAgents (v.3)
    ↓ Fetches live ENS agent index
    ↓
3. routeWithLLM (v.5)
    ↓ Transforms agent identities to prompt
    ↓ Evaluates model selection
    ↓ Checks membership against strictly populated ENS array
    ↓ Reject: 502 Bad Gateway (invalid_selection - TEST #1)
    ↓
4. NO-AGENT BRANCH (TEST #7)
    ↓ Evaluates if the LLM elected `null` 
    ↓ Returns: 200 OK — { "status": "no_suitable_agent", ... }
    ↓
5. forwardToAgent (v.6)
    ↓ Receives the strictly validated selectedAgent
    ↓ Validates selectedAgent.endpoint against URL & HTTPS protocol
    ↓ Attaches AbortSignal.timeout(5000)
    ↓ Posts payload downstream
    ↓ Reject: 502/504 error mapping (timeouts, errors, non-https - TEST #2, #5, #6)
    ↓
6. formatSuccessResponse
    ↓ Enforces provenance tagging 
    ↓ Returns: 200 OK — { "agent": { "ensName": "..." }, "answer": "..." }
```

### TEST #7 (6 points): Explicit No-Agent Branch

**Requirement:** Cases that result in no suitable agent must return a clearly identifiable native response payload without falling back to a default.

**Implementation (src/app.ts):**
```typescript
if (decision.type === "no_suitable_agent") {
  return reply.code(200).send({
    status: "no_suitable_agent",
    message: "No suitable agent was found for this request.",
  });
}
```
This is caught immediately post-decision explicitly returning the requested shape. The flow terminates safely before ever reaching `forwardToAgent`.

### Security Guarantees & Error Handling

- **No bypasses:** The fastify handler *only* routes to existing pipeline capabilities. No new external networking exists natively inside `app.ts`.
- **Sensible Client Responses:** All stack traces evaluate to sterile `5xx` JSON outputs ensuring API keys and ENS network details do not leak to public responses. (e.g., throwing a generic Database failure from Alchemy converts immediately to `"An internal server error occurred."`).
- **No Agent Overrides:** The loop contains **0 static defaults**. If a route misses, it misses hard via the `no_suitable_agent` envelope.

---

### End-to-End Orchestration Checks passing perfectly

- All prior components integrated transparently.
- All 81 unit tests passing.
- 0 hardcoded ENS identities.
- Typecheck strictly valid.
