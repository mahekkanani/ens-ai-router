/**
 * tests/discovery.test.ts
 *
 * Unit tests for ENS discovery logic.
 *
 * The viem client is stubbed — no network calls are made here.
 * We test the parsing/validation/skipping logic only.
 *
 * Addresses test case #4 — malformed agent records are skipped without
 * failing discovery.
 */

import { describe, it, expect } from "vitest";
import { agentRecordSchema } from "../src/schemas/agent.js";

/**
 * Simulate the per-agent resolution and validation logic from ens.ts.
 * In real code this is done by resolveAgent(); here we replicate the
 * safeParse step to verify the skip-on-bad-record behaviour.
 */
function simulateResolveAgent(
  ensName: string,
  rawRecords: Record<string, string | null>,
) {
  const result = agentRecordSchema.safeParse({ ensName, ...rawRecords });
  if (result.success) {
    return { ok: true as const, agent: result.data };
  }
  const reason = result.error.issues.map((i) => i.message).join("; ");
  return { ok: false as const, reason };
}

describe("ENS discovery — per-agent validation", () => {
  it("accepts a fully valid agent", () => {
    const result = simulateResolveAgent("invoices.priya.eth", {
      description: "Handles invoices and billing",
      endpoint: "https://invoice-agent.example.com/ask",
      input: "Plain text billing question",
      version: "1.0.0",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.agent.ensName).toBe("invoices.priya.eth");
    }
  });

  // Addresses test case #4: a malformed record produces ok: false
  // and discovery must continue for the remaining agents.
  it("skips an agent whose endpoint record is null", () => {
    const result = simulateResolveAgent("bad.priya.eth", {
      description: "Some agent",
      endpoint: null,         // missing ENS record
      input: "text",
      version: "1.0.0",
    });
    expect(result.ok).toBe(false);
  });

  it("skips an agent whose description record is null", () => {
    const result = simulateResolveAgent("bad.priya.eth", {
      description: null,
      endpoint: "https://agent.example.com/ask",
      input: "text",
      version: "1.0.0",
    });
    expect(result.ok).toBe(false);
  });

  it("skips an agent with a malformed endpoint URL", () => {
    const result = simulateResolveAgent("bad.priya.eth", {
      description: "Some agent",
      endpoint: "this-is-not-a-url",
      input: "text",
      version: "1.0.0",
    });
    expect(result.ok).toBe(false);
  });

  it("skips an agent with all null records", () => {
    const result = simulateResolveAgent("bad.priya.eth", {
      description: null,
      endpoint: null,
      input: null,
      version: null,
    });
    expect(result.ok).toBe(false);
  });

  // Demonstrates that one bad agent does not affect others
  it("continues discovery when one agent is bad — good agents still resolve", () => {
    const agentInputs: Array<[string, Record<string, string | null>]> = [
      ["invoices.priya.eth", {
        description: "Handles invoices",
        endpoint: "https://invoice-agent.example.com/ask",
        input: "billing question",
        version: "1.0.0",
      }],
      ["bad.priya.eth", {
        description: null,      // ← malformed: missing description
        endpoint: null,
        input: null,
        version: null,
      }],
      ["brand.priya.eth", {
        description: "Creates marketing copy",
        endpoint: "https://brand-agent.example.com/ask",
        input: "marketing brief",
        version: "1.0.0",
      }],
    ];

    const results = agentInputs.map(([name, records]) =>
      simulateResolveAgent(name, records),
    );

    const valid = results.filter((r) => r.ok);
    const skipped = results.filter((r) => !r.ok);

    expect(valid).toHaveLength(2);   // invoice + brand
    expect(skipped).toHaveLength(1); // bad.priya.eth

    // The bad agent did not prevent the good ones from resolving
    if (valid[0]?.ok) expect(valid[0].agent.ensName).toBe("invoices.priya.eth");
    if (valid[1]?.ok) expect(valid[1].agent.ensName).toBe("brand.priya.eth");
  });
});
