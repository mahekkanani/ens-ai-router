# ENS Record Format

This document describes the ENS text record format used by the router to
discover and route to specialist AI agents on Sepolia.

## Overview

Discovery is a two-level hierarchy:

```
registry.priya.eth              ← registry / index ENS name
  └── agent:index               ← comma-separated list of agent ENS names

invoices.priya.eth              ← individual agent ENS name
  ├── agent:description
  ├── agent:endpoint
  ├── agent:input
  └── agent:version
```

No agent names or endpoints are hardcoded in the router source.
Adding a new agent requires only ENS record changes.

---

## Level 1 — Registry Record

**ENS name:** `registry.priya.eth` (configured via `ENS_REGISTRY_NAME` env var)

| Key           | Type   | Description                                              |
|---------------|--------|----------------------------------------------------------|
| `agent:index` | string | Comma-separated list of agent ENS names currently active |

**Example value:**
```
invoices.priya.eth,contracts.priya.eth,brand.priya.eth
```

To add a new agent, append its ENS name to this record. To remove one,
delete it from the list. No router restart is needed — discovery runs on
every request (or can be cached with a TTL).

---

## Level 2 — Agent Records

Each ENS name listed in the registry's `agent:index` record must have all
four of the following text records set.

| Key                  | Type   | Required | Description                                              |
|----------------------|--------|----------|----------------------------------------------------------|
| `agent:description`  | string | ✅        | Human-readable description used by the LLM to route requests |
| `agent:endpoint`     | string | ✅        | HTTPS URL the router forwards requests to                |
| `agent:input`        | string | ✅        | Description of the expected input format                 |
| `agent:version`      | string | ✅        | Semver version string (e.g. `1.0.0`)                     |

All four records must be present and non-empty. Missing or blank records
will cause the agent to be skipped during discovery (a warning is logged).

### Validation Rules

- `agent:endpoint` must be a valid URL and use `https:` protocol.
  The router rejects any endpoint that does not pass both checks.
- An `http://localhost` exception is allowed for local development only
  (see `src/router/forward.ts`).
- `agent:version` is a free-form string; no semver parsing is enforced.

---

## Agent Examples

### invoices.priya.eth

```
agent:description = Handles invoice, billing, and payment questions
agent:endpoint    = https://invoice-agent.example.com/ask
agent:input       = Plain text question about an invoice or payment
agent:version     = 1.0.0
```

### contracts.priya.eth

```
agent:description = Answers contract clause and legal obligation questions
agent:endpoint    = https://contract-agent.example.com/ask
agent:input       = Plain text question about a contract or legal document
agent:version     = 1.0.0
```

### brand.priya.eth

```
agent:description = Creates marketing copy, taglines, and product descriptions
agent:endpoint    = https://brand-agent.example.com/ask
agent:input       = Plain text brief for a marketing or brand writing task
agent:version     = 1.0.0
```

---

## Adding a Fourth Agent (Zero-Code Demo)

1. Register a new ENS name on Sepolia, e.g. `legal.priya.eth`.
2. Set its four `agent:*` text records.
3. Edit `registry.priya.eth`'s `agent:index` record to add `legal.priya.eth`.
4. Send a relevant request to the router.

The router will discover the new agent on the next discovery pass, the LLM
will see it in the candidate list, and routing will proceed — **without any
router source changes or redeployment**.

---

## Security Notes

- All ENS records are treated as untrusted input and validated with Zod
  before use.
- The LLM never receives or controls endpoint URLs. It receives only
  `{ id, description }` per agent.
- The router resolves `id → discovered AgentRecord → endpoint` in code.
- Protocol validation (`https:` check) happens in code, not in ENS.
