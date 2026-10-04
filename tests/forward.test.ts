/**
 * tests/forward.test.ts
 *
 * Tests for secure downstream HTTP forwarding.
 *
 * These tests explicitly verify hackathon test cases:
 * - TEST #2 (14 points): Endpoint is taken from selectedAgent.endpoint
 * - TEST #5 (7 points): Explicit request timeout
 * - TEST #6 (4 points): HTTPS validation and explicit localhost exception
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { forwardToAgent } from "../src/router/forward.js";
import { formatSuccessResponse } from "../src/router/attribution.js";
import type { AgentRecord } from "../src/schemas/agent.js";
import type { AgentRequest } from "../src/schemas/agent-http.js";

// Mock global fetch for testing HTTP calls without network
const MOCK_FETCH = vi.fn();
global.fetch = MOCK_FETCH;

describe("Secure downstream HTTP forwarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default success behavior for fetch
    MOCK_FETCH.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ answer: "Mock answer" }),
    });
  });

  // ─── TEST #2 & #6 ───

  describe("Endpoint resolution and HTTPS validation", () => {
    it("Uses selectedAgent.endpoint and accepts HTTPS", async () => {
      const agent: AgentRecord = {
        ensName: "secure.priya.eth",
        description: "Secure agent",
        endpoint: "https://api.secure-agent.example.com/v1/ask",
        input: "test",
        version: "1.0.0",
      };

      const result = await forwardToAgent(agent, "test request");

      expect(result.success).toBe(true);

      // Verification: fetch was called exactly with agent.endpoint
      expect(MOCK_FETCH).toHaveBeenCalledTimes(1);
      const callArgs = MOCK_FETCH.mock.calls[0];
      expect(callArgs[0]).toBe("https://api.secure-agent.example.com/v1/ask");
    });

    it("Rejects non-HTTPS HTTP endpoints (unless localhost)", async () => {
      const agent: AgentRecord = {
        ensName: "insecure.priya.eth",
        description: "Insecure agent",
        endpoint: "http://api.production.example.com/ask", // HTTP in production
        input: "test",
        version: "1.0.0",
      };

      const result = await forwardToAgent(agent, "test request");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("non_https_endpoint");
        expect(result.error).toContain("must use HTTPS");
      }
      expect(MOCK_FETCH).not.toHaveBeenCalled();
    });

    it("Rejects protocols other than HTTPS/HTTP (e.g., FTP, WebSocket)", async () => {
      const agent: AgentRecord = {
        ensName: "weird.priya.eth",
        description: "Weird agent",
        endpoint: "ftp://api.weird-agent.example.com/ask",
        input: "test",
        version: "1.0.0",
      };

      const result = await forwardToAgent(agent, "test request");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("non_https_endpoint");
      }
      expect(MOCK_FETCH).not.toHaveBeenCalled();
    });

    it("Accepts http://localhost explicitly (development exception)", async () => {
      const agent: AgentRecord = {
        ensName: "local.priya.eth",
        description: "Local agent",
        endpoint: "http://localhost:4001/ask",
        input: "test",
        version: "1.0.0",
      };

      const result = await forwardToAgent(agent, "test request");

      expect(result.success).toBe(true);
      expect(MOCK_FETCH).toHaveBeenCalledTimes(1);
      expect(MOCK_FETCH.mock.calls[0][0]).toBe("http://localhost:4001/ask");
    });

    it("Accepts http://127.0.0.1 explicitly (development exception)", async () => {
      const agent: AgentRecord = {
        ensName: "local2.priya.eth",
        description: "Local agent",
        endpoint: "http://127.0.0.1:4002/ask",
        input: "test",
        version: "1.0.0",
      };

      const result = await forwardToAgent(agent, "test request");

      expect(result.success).toBe(true);
      expect(MOCK_FETCH).toHaveBeenCalledTimes(1);
    });

    it("Rejects malformed endpoints entirely", async () => {
      const agent: AgentRecord = {
        ensName: "bad.priya.eth",
        description: "Bad agent",
        endpoint: "not-a-url",
        input: "test",
        version: "1.0.0",
      };

      const result = await forwardToAgent(agent, "test request");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("invalid_endpoint");
      }
      expect(MOCK_FETCH).not.toHaveBeenCalled();
    });
  });

  // ─── Downstream validation ───

  describe("Downstream contract and handling", () => {
    const validAgent: AgentRecord = {
      ensName: "valid.priya.eth",
      description: "Valid agent",
      endpoint: "https://valid.example.com/ask",
      input: "test",
      version: "1.0.0",
    };

    it("Sends the correct POST body format", async () => {
      await forwardToAgent(validAgent, "Hello agent");

      const callArgs = MOCK_FETCH.mock.calls[0];
      const fetchConfig = callArgs[1];

      expect(fetchConfig.method).toBe("POST");
      expect(fetchConfig.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(fetchConfig.body) as AgentRequest;
      expect(body.request).toBe("Hello agent");
    });

    // TEST #5
    it("Sends an explicit AbortSignal timeout with the request", async () => {
      await forwardToAgent(validAgent, "Hello agent");

      const callArgs = MOCK_FETCH.mock.calls[0];
      const fetchConfig = callArgs[1];

      // Verifies AbortSignal.timeout() is passed to fetch options
      expect(fetchConfig.signal).toBeInstanceOf(AbortSignal);
    });

    it("Handles non-2xx downstream HTTP responses", async () => {
      MOCK_FETCH.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const result = await forwardToAgent(validAgent, "test request");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("non_2xx_response");
        expect(result.error).toContain("500");
        expect(result.error).toContain("Internal Server Error");
      }
    });

    it("Handles downstream timeout (TimeoutError DOMException)", async () => {
      const timeoutError = new Error("The operation was aborted");
      timeoutError.name = "TimeoutError"; // DOMException simulate

      MOCK_FETCH.mockRejectedValueOnce(timeoutError);

      const result = await forwardToAgent(validAgent, "test request");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("timeout");
        expect(result.error).toContain("timed out after 30000ms");
      }
    });

    it("Handles general network errors (DNS, connection refused, etc)", async () => {
      MOCK_FETCH.mockRejectedValueOnce(new Error("fetch failed"));

      const result = await forwardToAgent(validAgent, "test request");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("network_error");
        expect(result.error).toContain("fetch failed");
      }
    });

    it("Rejects malformed downstream JSON", async () => {
      MOCK_FETCH.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ wrongField: "I don't have an answer field" }),
      });

      const result = await forwardToAgent(validAgent, "test request");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("malformed_response");
      }
    });
  });
});

// ─── Attribution module ───

describe("Attribution formatting", () => {
  it("formats the attribution using the selected ENS agent, not the model output directly", () => {
    const selectedAgent: AgentRecord = {
      ensName: "brand.priya.eth", // This is what identifies the agent
      description: "Brand agent",
      endpoint: "https://brand.example.com",
      input: "string",
      version: "1.0",
    };

    const answer = "Here is your tagline: AI router built different.";
    const result = formatSuccessResponse(selectedAgent, answer);

    expect(result.status).toBe("success");
    expect(result.answer).toBe(answer);

    // Attribution verification
    // The attribution string comes explicitly from selectedAgent.ensName
    expect(result.agent.ensName).toBe("brand.priya.eth");
  });
});
