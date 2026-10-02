/**
 * src/llm/client.ts
 *
 * Simple OpenAI-compatible LLM client for agent responses.
 *
 * Agents use this to generate answers. The router will use a separate
 * LLM client for routing decisions (Phase 5).
 */

import { config } from "../config.js";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
}

/**
 * Call an OpenAI-compatible /v1/chat/completions endpoint.
 * Returns the assistant's message content.
 */
export async function callLLM(messages: LLMMessage[]): Promise<LLMResponse> {
  const url = `${config.llm.baseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.llm.apiKey}`,
    },
    body: JSON.stringify({
      model: config.llm.model,
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(
      `LLM API error: ${response.status} ${response.statusText} — ${text}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };

  // OpenAI-compatible response shape
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("LLM API returned malformed response (no content)");
  }

  return { content };
}
