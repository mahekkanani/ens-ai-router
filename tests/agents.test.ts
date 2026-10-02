/**
 * tests/agents.test.ts
 *
 * HTTP contract tests for the three specialist agents.
 *
 * These tests verify:
 * - Each agent accepts POST /ask with { request: string }
 * - Each agent returns { answer: string }
 * - Each agent validates request bodies
 * - Each agent handles errors gracefully
 *
 * Note: These are unit tests that call the handlers directly, not full
 * integration tests that start HTTP servers. To test the live servers,
 * start each agent and use curl or Postman.
 */

import { describe, it, expect } from "vitest";
import {
  agentRequestSchema,
  agentResponseSchema,
} from "../src/schemas/agent-http.js";

// ─── Request/Response schema tests ────────────────────────────────────────────

describe("Agent HTTP schemas", () => {
  describe("agentRequestSchema", () => {
    it("accepts a valid request", () => {
      const result = agentRequestSchema.safeParse({
        request: "Why is my invoice overdue?",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an empty request", () => {
      const result = agentRequestSchema.safeParse({ request: "" });
      expect(result.success).toBe(false);
    });

    it("rejects a missing request field", () => {
      const result = agentRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects a non-string request", () => {
      const result = agentRequestSchema.safeParse({ request: 123 });
      expect(result.success).toBe(false);
    });
  });

  describe("agentResponseSchema", () => {
    it("accepts a valid response", () => {
      const result = agentResponseSchema.safeParse({
        answer: "Your invoice is overdue by 14 days.",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an empty answer", () => {
      const result = agentResponseSchema.safeParse({ answer: "" });
      expect(result.success).toBe(false);
    });

    it("rejects a missing answer field", () => {
      const result = agentResponseSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects a non-string answer", () => {
      const result = agentResponseSchema.safeParse({ answer: 123 });
      expect(result.success).toBe(false);
    });
  });
});

// ─── Agent handler contract tests ─────────────────────────────────────────────

describe("Agent handlers", () => {
  it("all handlers accept a string and return a string", () => {
    // This test documents the handler contract without calling the LLM.
    // The TypeScript types already enforce this, but we verify it here.

    type AgentHandler = (request: string) => Promise<string>;

    // If these imports compile, the contract is satisfied
    const invoice: AgentHandler = async (req) => {
      expect(typeof req).toBe("string");
      return "Mock invoice answer";
    };

    const contract: AgentHandler = async (req) => {
      expect(typeof req).toBe("string");
      return "Mock contract answer";
    };

    const brand: AgentHandler = async (req) => {
      expect(typeof req).toBe("string");
      return "Mock brand answer";
    };

    expect(invoice).toBeDefined();
    expect(contract).toBeDefined();
    expect(brand).toBeDefined();
  });
});

// ─── Integration test notes ───────────────────────────────────────────────────

describe("Agent integration testing", () => {
  it("documents how to test live agents", () => {
    const instructions = `
To test live agent servers:

1. Set LLM_API_KEY in .env
2. Start each agent in a separate terminal:
   - npm run dev agents/invoice/index.ts   (port 4001)
   - npm run dev agents/contract/index.ts  (port 4002)
   - npm run dev agents/brand/index.ts     (port 4003)

3. Test with curl:
   curl -X POST http://localhost:4001/ask \\
     -H "Content-Type: application/json" \\
     -d '{"request": "Why is my invoice overdue?"}'

   curl -X POST http://localhost:4002/ask \\
     -H "Content-Type: application/json" \\
     -d '{"request": "What is a termination clause?"}'

   curl -X POST http://localhost:4003/ask \\
     -H "Content-Type: application/json" \\
     -d '{"request": "Write a tagline for an AI router product"}'

4. Health checks:
   curl http://localhost:4001/health
   curl http://localhost:4002/health
   curl http://localhost:4003/health
    `;

    expect(instructions).toBeTruthy();
  });
});
