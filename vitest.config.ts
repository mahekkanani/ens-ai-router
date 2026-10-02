import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      SEPOLIA_RPC_URL: "https://mock-sepolia.example.com",
      LLM_API_KEY: "mock-llm-key",
      ENS_REGISTRY_NAME: "test-registry.priya.eth"
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
    },
  },
});
