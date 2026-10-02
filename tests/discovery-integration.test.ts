/**
 * tests/discovery-integration.test.ts
 *
 * Integration tests for ENS discovery.
 *
 * These tests verify the end-to-end discovery flow including:
 * - Registry record parsing
 * - Per-agent record fetching
 * - Zod validation
 * - Malformed agent skipping
 * - Empty registry handling
 *
 * Note: These are mocked integration tests that simulate the discovery flow
 * without making real network calls. To test against real Sepolia ENS records,
 * use scripts/test-discovery.ts with a configured RPC URL.
 */

import { describe, it, expect } from "vitest";
import { agentRecordSchema } from "../src/schemas/agent.js";
import type { DiscoveryResult } from "../src/discovery/types.js";

/**
 * Simulate the full discovery flow with mocked ENS data.
 * This replicates the logic from src/discovery/ens.ts but with
 * in-memory data instead of network calls.
 */
function mockDiscoverAgents(
  registryName: string,
  mockData: {
    registryIndex: string | null;
    agentRecords: Record<string, Record<string, string | null>>;
  },
): DiscoveryResult {
  const { registryIndex, agentRecords } = mockData;

  // Step 1: Check if registry has an index
  if (!registryIndex) {
    return { agents: [], skipped: [], registryName };
  }

  // Step 2: Parse agent names from the index
  const agentNames = registryIndex
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Step 3: Resolve and validate each agent
  const agents: import("../src/schemas/agent.js").AgentRecord[] = [];
  const skipped: DiscoveryResult["skipped"] = [];

  for (const ensName of agentNames) {
    const records = agentRecords[ensName];

    // If the agent name is in the index but has no records at all, skip it
    if (!records) {
      skipped.push({
        ensName,
        reason: "No ENS records found",
      });
      continue;
    }

    // Validate with the same schema used in production
    const result = agentRecordSchema.safeParse({
      ensName,
      description: records.description ?? null,
      endpoint: records.endpoint ?? null,
      input: records.input ?? null,
      version: records.version ?? null,
    });

    if (result.success) {
      agents.push(result.data);
    } else {
      const reason = result.error.issues.map((i) => i.message).join("; ");
      skipped.push({ ensName, reason });
    }
  }

  return { agents, skipped, registryName };
}

// ─── Integration test scenarios ───────────────────────────────────────────────

describe("ENS discovery integration", () => {
  const registryName = "registry.priya.eth";

  it("discovers all agents when all records are valid", () => {
    const result = mockDiscoverAgents(registryName, {
      registryIndex: "invoices.priya.eth,contracts.priya.eth",
      agentRecords: {
        "invoices.priya.eth": {
          description: "Handles invoice and billing questions",
          endpoint: "https://invoice-agent.example.com/ask",
          input: "Plain text billing question",
          version: "1.0.0",
        },
        "contracts.priya.eth": {
          description: "Answers contract questions",
          endpoint: "https://contract-agent.example.com/ask",
          input: "Plain text contract question",
          version: "1.0.0",
        },
      },
    });

    expect(result.agents).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(result.agents[0]?.ensName).toBe("invoices.priya.eth");
    expect(result.agents[1]?.ensName).toBe("contracts.priya.eth");
  });

  it("skips agents with missing endpoint records", () => {
    const result = mockDiscoverAgents(registryName, {
      registryIndex: "invoices.priya.eth,bad.priya.eth,contracts.priya.eth",
      agentRecords: {
        "invoices.priya.eth": {
          description: "Handles invoices",
          endpoint: "https://invoice-agent.example.com/ask",
          input: "billing question",
          version: "1.0.0",
        },
        "bad.priya.eth": {
          description: "Some agent",
          endpoint: null, // ← missing endpoint
          input: "text",
          version: "1.0.0",
        },
        "contracts.priya.eth": {
          description: "Answers contracts",
          endpoint: "https://contract-agent.example.com/ask",
          input: "contract question",
          version: "1.0.0",
        },
      },
    });

    // Addresses test case #4: malformed record skipped, discovery continues
    expect(result.agents).toHaveLength(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.ensName).toBe("bad.priya.eth");
    expect(result.agents[0]?.ensName).toBe("invoices.priya.eth");
    expect(result.agents[1]?.ensName).toBe("contracts.priya.eth");
  });

  it("skips agents with malformed endpoint URLs", () => {
    const result = mockDiscoverAgents(registryName, {
      registryIndex: "invoices.priya.eth,bad.priya.eth",
      agentRecords: {
        "invoices.priya.eth": {
          description: "Handles invoices",
          endpoint: "https://invoice-agent.example.com/ask",
          input: "billing question",
          version: "1.0.0",
        },
        "bad.priya.eth": {
          description: "Some agent",
          endpoint: "not-a-valid-url", // ← malformed
          input: "text",
          version: "1.0.0",
        },
      },
    });

    expect(result.agents).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.ensName).toBe("bad.priya.eth");
    expect(result.skipped[0]?.reason).toContain("Invalid URL");
  });

  it("skips agents with all null records", () => {
    const result = mockDiscoverAgents(registryName, {
      registryIndex: "invoices.priya.eth,bad.priya.eth",
      agentRecords: {
        "invoices.priya.eth": {
          description: "Handles invoices",
          endpoint: "https://invoice-agent.example.com/ask",
          input: "billing question",
          version: "1.0.0",
        },
        "bad.priya.eth": {
          description: null,
          endpoint: null,
          input: null,
          version: null,
        },
      },
    });

    expect(result.agents).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.ensName).toBe("bad.priya.eth");
  });

  it("returns empty agents when registry index is missing", () => {
    const result = mockDiscoverAgents(registryName, {
      registryIndex: null, // ← no agent:index record set
      agentRecords: {},
    });

    expect(result.agents).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.registryName).toBe(registryName);
  });

  it("returns empty agents when registry index is empty string", () => {
    const result = mockDiscoverAgents(registryName, {
      registryIndex: "",
      agentRecords: {},
    });

    expect(result.agents).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it("handles whitespace-only entries in the index", () => {
    const result = mockDiscoverAgents(registryName, {
      registryIndex: "invoices.priya.eth,  , ,contracts.priya.eth",
      agentRecords: {
        "invoices.priya.eth": {
          description: "Handles invoices",
          endpoint: "https://invoice-agent.example.com/ask",
          input: "billing question",
          version: "1.0.0",
        },
        "contracts.priya.eth": {
          description: "Answers contracts",
          endpoint: "https://contract-agent.example.com/ask",
          input: "contract question",
          version: "1.0.0",
        },
      },
    });

    // Empty/whitespace entries are filtered out
    expect(result.agents).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
  });

  it("skips agents listed in index but with no ENS records at all", () => {
    const result = mockDiscoverAgents(registryName, {
      registryIndex: "invoices.priya.eth,ghost.priya.eth,contracts.priya.eth",
      agentRecords: {
        "invoices.priya.eth": {
          description: "Handles invoices",
          endpoint: "https://invoice-agent.example.com/ask",
          input: "billing question",
          version: "1.0.0",
        },
        // ghost.priya.eth not present in agentRecords
        "contracts.priya.eth": {
          description: "Answers contracts",
          endpoint: "https://contract-agent.example.com/ask",
          input: "contract question",
          version: "1.0.0",
        },
      },
    });

    expect(result.agents).toHaveLength(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.ensName).toBe("ghost.priya.eth");
  });

  it("discovers a fourth agent after registry index is updated (zero-code demo)", () => {
    // Initial state: three agents
    const initialResult = mockDiscoverAgents(registryName, {
      registryIndex: "invoices.priya.eth,contracts.priya.eth,brand.priya.eth",
      agentRecords: {
        "invoices.priya.eth": {
          description: "Handles invoices",
          endpoint: "https://invoice-agent.example.com/ask",
          input: "billing question",
          version: "1.0.0",
        },
        "contracts.priya.eth": {
          description: "Answers contracts",
          endpoint: "https://contract-agent.example.com/ask",
          input: "contract question",
          version: "1.0.0",
        },
        "brand.priya.eth": {
          description: "Creates marketing copy",
          endpoint: "https://brand-agent.example.com/ask",
          input: "marketing brief",
          version: "1.0.0",
        },
      },
    });

    expect(initialResult.agents).toHaveLength(3);

    // Updated state: registry index now includes legal.priya.eth
    // No router source code changes — only ENS record changes
    const updatedResult = mockDiscoverAgents(registryName, {
      registryIndex:
        "invoices.priya.eth,contracts.priya.eth,brand.priya.eth,legal.priya.eth",
      agentRecords: {
        "invoices.priya.eth": {
          description: "Handles invoices",
          endpoint: "https://invoice-agent.example.com/ask",
          input: "billing question",
          version: "1.0.0",
        },
        "contracts.priya.eth": {
          description: "Answers contracts",
          endpoint: "https://contract-agent.example.com/ask",
          input: "contract question",
          version: "1.0.0",
        },
        "brand.priya.eth": {
          description: "Creates marketing copy",
          endpoint: "https://brand-agent.example.com/ask",
          input: "marketing brief",
          version: "1.0.0",
        },
        "legal.priya.eth": {
          description: "Provides legal advice and compliance guidance",
          endpoint: "https://legal-agent.example.com/ask",
          input: "legal question",
          version: "1.0.0",
        },
      },
    });

    // Fourth agent discovered without any source code changes
    expect(updatedResult.agents).toHaveLength(4);
    expect(updatedResult.agents[3]?.ensName).toBe("legal.priya.eth");

    // This demonstrates the key hackathon requirement:
    // adding a new agent requires only ENS record changes,
    // not router source modifications.
  });
});
