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
  get sepolia() {
    return {
      rpcUrl: requireEnv("SEPOLIA_RPC_URL"),
    };
  },
  get llm() {
    return {
      apiKey: requireEnv("LLM_API_KEY"),
      baseUrl: optionalEnv("LLM_BASE_URL", "https://api.openai.com/v1"),
      model: optionalEnv("LLM_MODEL", "gpt-4o-mini"),
    };
  },
  get ens() {
    return {
      registryName: optionalEnv("ENS_REGISTRY_NAME", "registry.priya.eth"),
    };
  },
  get server() {
    return {
      port: parseInt(optionalEnv("PORT", "3000"), 10),
    };
  },
} as const;
