import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Configuration Isolation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows importing and using LLM config without SEPOLIA_RPC_URL", async () => {
    vi.stubEnv("SEPOLIA_RPC_URL", "");
    vi.stubEnv("ENS_REGISTRY_NAME", "");
    vi.stubEnv("LLM_API_KEY", "test-key");

    const { config } = await import("../src/config.js");

    expect(config.llm.apiKey).toBe("test-key");

    expect(() => config.sepolia.rpcUrl).toThrow(/Required environment variable SEPOLIA_RPC_URL is not set/);
  });

  it("agent handlers can be imported and initialized without SEPOLIA_RPC_URL", async () => {
    vi.stubEnv("SEPOLIA_RPC_URL", "");
    vi.stubEnv("LLM_API_KEY", "test-key");

    const { handleInvoiceRequest } = await import("../agents/invoice/handler.js");
    expect(handleInvoiceRequest).toBeTypeOf("function");
  });

  it("router discovery paths still require SEPOLIA_RPC_URL at runtime", async () => {
    vi.stubEnv("SEPOLIA_RPC_URL", "");

    const { buildApp } = await import("../src/app.js");
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/route",
      payload: { request: "Hello" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().message).toBe("An internal server error occurred while processing the request.");
  });
});
