/**
 * tests/schemas.test.ts
 *
 * Unit tests for Zod schemas.
 * No network calls — pure validation logic.
 */

import { describe, it, expect } from "vitest";
import { agentRecordSchema } from "../src/schemas/agent.js";
import {
  llmRoutingOutputSchema,
  downstreamResponseSchema,
  toAgentDescriptor,
} from "../src/schemas/routing.js";

// ─── agentRecordSchema ────────────────────────────────────────────────────────

describe("agentRecordSchema", () => {
  const validAgent = {
    ensName: "invoices.priya.eth",
    description: "Handles invoice and billing questions",
    endpoint: "https://invoice-agent.example.com/ask",
    input: "Plain text billing question",
    version: "1.0.0",
  };

  it("accepts a fully valid agent record", () => {
    const result = agentRecordSchema.safeParse(validAgent);
    expect(result.success).toBe(true);
  });

  it("rejects a record with a missing description", () => {
    const result = agentRecordSchema.safeParse({ ...validAgent, description: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a record with a missing endpoint", () => {
    const result = agentRecordSchema.safeParse({ ...validAgent, endpoint: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a record with a malformed endpoint URL", () => {
    const result = agentRecordSchema.safeParse({ ...validAgent, endpoint: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects a record with a missing ensName", () => {
    const result = agentRecordSchema.safeParse({ ...validAgent, ensName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a record with a null endpoint (simulating missing ENS record)", () => {
    // Addresses test case #4: malformed/null fields must fail safeParse gracefully
    const result = agentRecordSchema.safeParse({ ...validAgent, endpoint: null });
    expect(result.success).toBe(false);
  });

  it("rejects a record with all nulls (simulating fully missing ENS records)", () => {
    const result = agentRecordSchema.safeParse({
      ensName: "bad.priya.eth",
      description: null,
      endpoint: null,
      input: null,
      version: null,
    });
    expect(result.success).toBe(false);
  });

  // This test confirms the schema accepts http:// — HTTPS enforcement is
  // intentionally separate (in the forwarding layer), not in the schema.
  it("accepts an http:// endpoint at schema level (HTTPS check is in forwarder)", () => {
    const result = agentRecordSchema.safeParse({
      ...validAgent,
      endpoint: "http://localhost:4001/ask",
    });
    expect(result.success).toBe(true);
  });
});

// ─── llmRoutingOutputSchema ───────────────────────────────────────────────────

describe("llmRoutingOutputSchema", () => {
  it("accepts a valid agent choice", () => {
    const result = llmRoutingOutputSchema.safeParse({ agent: "invoices.priya.eth" });
    expect(result.success).toBe(true);
  });

  it("accepts null agent (no suitable agent)", () => {
    const result = llmRoutingOutputSchema.safeParse({ agent: null });
    expect(result.success).toBe(true);
  });

  it("rejects a response with no agent field", () => {
    const result = llmRoutingOutputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── downstreamResponseSchema ─────────────────────────────────────────────────

describe("downstreamResponseSchema", () => {
  it("accepts a valid answer", () => {
    const result = downstreamResponseSchema.safeParse({ answer: "Your invoice is overdue." });
    expect(result.success).toBe(true);
  });

  it("accepts extra fields (agent can return metadata)", () => {
    const result = downstreamResponseSchema.safeParse({
      answer: "Your invoice is overdue.",
      extraField: "ignored",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty answer", () => {
    const result = downstreamResponseSchema.safeParse({ answer: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing answer field", () => {
    const result = downstreamResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── toAgentDescriptor ────────────────────────────────────────────────────────

describe("toAgentDescriptor", () => {
  it("strips endpoint and other private fields, exposing only id + description", () => {
    const agent = {
      ensName: "invoices.priya.eth",
      description: "Handles invoices",
      endpoint: "https://invoice-agent.example.com/ask",
      input: "billing question",
      version: "1.0.0",
    };
    const descriptor = toAgentDescriptor(agent);
    expect(descriptor).toEqual({
      id: "invoices.priya.eth",
      description: "Handles invoices",
    });
    // The endpoint must not appear in what we send to the LLM
    expect("endpoint" in descriptor).toBe(false);
  });
});
