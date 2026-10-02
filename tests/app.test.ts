/**
 * tests/app.test.ts
 *
 * Integration tests for the central Fastify router loop.
 *
 * These tests use vi.mock to isolate the Fastify layer from real network calls
 * (ENS, LLM APIs, Downstream HTTP), while ensuring the orchestration connects correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

// Mock dependencies
import { discoverAgents } from "../src/discovery/index.js";
import { routeWithLLM } from "../src/llm/router.js";
import { forwardToAgent } from "../src/router/forward.js";

vi.mock("../src/discovery/index.js");
vi.mock("../src/llm/router.js");
vi.mock("../src/router/forward.js");

const mockDiscoveredAgents = [
  {
    ensName: "test.priya.eth",
    description: "Mock agent",
    endpoint: "https://mock.example.com",
    input: "test",
    version: "1.0.0",
  },
];

describe("Central Fastify Router Loop POST /route", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  // ─── 1. Normal Request & 2. Attribution ───
  it("Should route a normal request to the correct agent and include attribution", async () => {
    // Scaffold Mocks
    vi.mocked(discoverAgents).mockResolvedValueOnce({
      agents: mockDiscoveredAgents,
      skipped: [],
      registryName: "mock.eth",
    });

    vi.mocked(routeWithLLM).mockResolvedValueOnce({
      type: "agent_selected",
      agent: mockDiscoveredAgents[0]!,
    });

    vi.mocked(forwardToAgent).mockResolvedValueOnce({
      success: true,
      answer: "I am the mock answer.",
    });

    const response = await app.inject({
      method: "POST",
      url: "/route",
      payload: { request: "Hello" },
    });

    expect(response.statusCode).toBe(200);

    const json = response.json();
    expect(json.status).toBe("success");
    // Attribution correctly reflects the ENS name
    expect(json.agent.ensName).toBe("test.priya.eth");
    expect(json.answer).toBe("I am the mock answer.");

    // Execution assertions
    expect(discoverAgents).toHaveBeenCalledTimes(1);
    expect(routeWithLLM).toHaveBeenCalledWith(mockDiscoveredAgents, "Hello");
    expect(forwardToAgent).toHaveBeenCalledWith(mockDiscoveredAgents[0], "Hello");
  });

  // ─── 3. No Suitable Agent (Test #7) ───
  it("Should return an explicit no_suitable_agent response (Test #7)", async () => {
    vi.mocked(discoverAgents).mockResolvedValueOnce({
      agents: mockDiscoveredAgents,
      skipped: [],
      registryName: "mock.eth",
    });

    vi.mocked(routeWithLLM).mockResolvedValueOnce({
      type: "no_suitable_agent",
    });

    const response = await app.inject({
      method: "POST",
      url: "/route",
      payload: { request: "Do my taxes" },
    });

    expect(response.statusCode).toBe(200);

    const json = response.json();
    expect(json.status).toBe("no_suitable_agent");
    expect(json.message).toContain("No suitable agent was found");

    // Must NOT attempt to forward
    expect(forwardToAgent).not.toHaveBeenCalled();
  });

  // ─── 4. Unknown Model Selection ───
  it("Should return a 502 error if the model selects an invalid agent and NOT forward", async () => {
    vi.mocked(discoverAgents).mockResolvedValueOnce({
      agents: mockDiscoveredAgents,
      skipped: [],
      registryName: "mock.eth",
    });

    vi.mocked(routeWithLLM).mockResolvedValueOnce({
      type: "invalid_selection",
      attemptedAgent: "fake.eth",
      reason: "Not found",
    });

    const response = await app.inject({
      method: "POST",
      url: "/route",
      payload: { request: "Hack the mainframe" },
    });

    expect(response.statusCode).toBe(502);

    const json = response.json();
    expect(json.status).toBe("error");
    expect(json.code).toBe("invalid_model_selection");
    // Does not leak the specific fake.eth value to the client
    expect(json.message).toBe("The routing engine made an invalid selection.");

    // Must NOT attempt to forward
    expect(forwardToAgent).not.toHaveBeenCalled();
  });

  // ─── 5. Downstream Timeout ───
  it("Should map downstream timeouts to a 504 Gateway Timeout array", async () => {
    vi.mocked(discoverAgents).mockResolvedValueOnce({
      agents: mockDiscoveredAgents,
      skipped: [],
      registryName: "mock.eth",
    });

    vi.mocked(routeWithLLM).mockResolvedValueOnce({
      type: "agent_selected",
      agent: mockDiscoveredAgents[0]!,
    });

    vi.mocked(forwardToAgent).mockResolvedValueOnce({
      success: false,
      code: "timeout",
      error: "Request timed out",
    });

    const response = await app.inject({
      method: "POST",
      url: "/route",
      payload: { request: "Hello" },
    });

    expect(response.statusCode).toBe(504); // Specifically a timeout status

    const json = response.json();
    expect(json.status).toBe("error");
    expect(json.code).toBe("timeout");
    expect(json.message).toContain("Downstream agent error: Request timed out");
  });

  // ─── 6. Invalid Endpoint Rejected Before Forwarding ───
  it("Should fail gracefully with 502 Bad Gateway if the endpoint is HTTP/Invalid", async () => {
    vi.mocked(discoverAgents).mockResolvedValueOnce({
      agents: mockDiscoveredAgents,
      skipped: [],
      registryName: "mock.eth",
    });

    vi.mocked(routeWithLLM).mockResolvedValueOnce({
      type: "agent_selected",
      agent: mockDiscoveredAgents[0]!,
    });

    vi.mocked(forwardToAgent).mockResolvedValueOnce({
      success: false,
      code: "non_https_endpoint",
      error: "Protocol must be HTTPS",
    });

    const response = await app.inject({
      method: "POST",
      url: "/route",
      payload: { request: "Hello" },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().code).toBe("non_https_endpoint");
  });

  // ─── 7. Malformed Client Input ───
  it("Should return an explicit 400 Bad Request for malformed payload format", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/route",
      payload: { not_request: "Invalid structure" },
    });

    expect(response.statusCode).toBe(400);

    const json = response.json();
    expect(json.code).toBe("invalid_request");
    // Ensure that invalid requests don't hit discovery or LLMs
    expect(discoverAgents).not.toHaveBeenCalled();
    expect(routeWithLLM).not.toHaveBeenCalled();
  });

  // ─── 8. Malformed Downstream Response ───
  it("Should handle 502 gracefully if the agent returns malformed output", async () => {
    vi.mocked(discoverAgents).mockResolvedValueOnce({
      agents: mockDiscoveredAgents,
      skipped: [],
      registryName: "mock.eth",
    });

    vi.mocked(routeWithLLM).mockResolvedValueOnce({
      type: "agent_selected",
      agent: mockDiscoveredAgents[0]!,
    });

    vi.mocked(forwardToAgent).mockResolvedValueOnce({
      success: false,
      code: "malformed_response",
      error: "Required string, received number",
    });

    const response = await app.inject({
      method: "POST",
      url: "/route",
      payload: { request: "Hello" },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().code).toBe("malformed_response");
  });

  // ─── 9. Absolute Fatal Error boundary (e.g. Discovery throws hard) ───
  it("Should protect private traces by returning a clean 500 error if discovery throws completely", async () => {
    vi.mocked(discoverAgents).mockRejectedValueOnce(
      new Error("FATAL: Alchemy rate limit exceeded!")
    );

    const response = await app.inject({
      method: "POST",
      url: "/route",
      payload: { request: "Hello" },
    });

    // We expect a sterile 500 without the word "Alchemy"
    expect(response.statusCode).toBe(500);

    const json = response.json();
    expect(json.status).toBe("error");
    expect(json.message).not.toContain("Alchemy");
    expect(json.message).toBe("An internal server error occurred while processing the request.");
  });
});
