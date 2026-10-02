/**
 * src/config.ts
 *
 * Centralised environment configuration.
 * All process.env access is isolated here so the rest of the codebase
 * never reads environment variables directly and misconfiguration is
 * caught early at startup rather than at request time.
 */

import "dotenv/config";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set. See .env.example.`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  sepolia: {
    rpcUrl: requireEnv("SEPOLIA_RPC_URL"),
  },
  llm: {
    apiKey: requireEnv("LLM_API_KEY"),
    baseUrl: optionalEnv("LLM_BASE_URL", "https://api.openai.com/v1"),
    model: optionalEnv("LLM_MODEL", "gpt-4o-mini"),
  },
  ens: {
    // The ENS name whose agent:index text record lists all active agent ENS names.
    // Change this record to add/remove agents — no source code changes required.
    registryName: optionalEnv("ENS_REGISTRY_NAME", "registry.priya.eth"),
  },
  server: {
    port: parseInt(optionalEnv("PORT", "3000"), 10),
  },
} as const;
