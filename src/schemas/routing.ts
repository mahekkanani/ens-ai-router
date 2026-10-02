/**
 * src/schemas/routing.ts
 *
 * Zod schemas for LLM routing input/output and the router's own
 * HTTP response shapes.
 *
 * The LLM receives agent identifiers + user request, and returns
 * the chosen agent's ENS name (or null / "NONE" if no agent fits).
 * It must never receive or return endpoint URLs.
 */

import { z } from "zod";
import type { AgentRecord } from "./agent.js";

// ─── LLM input ────────────────────────────────────────────────────────────────

/** Minimal agent descriptor sent to the LLM — identity + description only, no URLs. */
export const llmAgentDescriptorSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
});

export type LlmAgentDescriptor = z.infer<typeof llmAgentDescriptorSchema>;

export const llmRoutingInputSchema = z.object({
  agents: z.array(llmAgentDescriptorSchema).min(1),
  userRequest: z.string().min(1),
});

export type LlmRoutingInput = z.infer<typeof llmRoutingInputSchema>;

// ─── LLM output ───────────────────────────────────────────────────────────────

/**
 * What the LLM must return.
 * agent: ENS name of the chosen agent, or null if nothing fits.
 * "NONE" is normalised to null by the routing layer.
 */
export const llmRoutingOutputSchema = z.object({
  agent: z.string().nullable(),
});

export type LlmRoutingOutput = z.infer<typeof llmRoutingOutputSchema>;

// ─── Router HTTP response shapes ──────────────────────────────────────────────

/** Returned when a suitable agent was found and answered successfully. */
export const successResponseSchema = z.object({
  status: z.literal("success"),
  agent: z.object({
    ensName: z.string(),
  }),
  answer: z.string(),
});

export type SuccessResponse = z.infer<typeof successResponseSchema>;

/** Returned when no discovered agent is appropriate for the request. */
export const noAgentResponseSchema = z.object({
  status: z.literal("no_suitable_agent"),
  message: z.string(),
});

export type NoAgentResponse = z.infer<typeof noAgentResponseSchema>;

/** Returned when something goes wrong (bad ENS, timeout, invalid endpoint, etc.) */
export const errorResponseSchema = z.object({
  status: z.literal("error"),
  code: z.string(),
  message: z.string(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export type RouterResponse = SuccessResponse | NoAgentResponse | ErrorResponse;

// ─── Downstream agent response ─────────────────────────────────────────────────

/**
 * Minimal shape we expect from a downstream specialist agent.
 * We only require `answer` — extra fields are allowed and ignored.
 */
export const downstreamResponseSchema = z.object({
  answer: z.string().min(1),
});

export type DownstreamResponse = z.infer<typeof downstreamResponseSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a discovered AgentRecord to the minimal descriptor sent to the LLM. */
export function toAgentDescriptor(agent: AgentRecord): LlmAgentDescriptor {
  return { id: agent.ensName, description: agent.description };
}
