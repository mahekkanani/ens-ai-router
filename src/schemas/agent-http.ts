/**
 * src/schemas/agent-http.ts
 *
 * HTTP contract for specialist agent servers.
 *
 * All three agents (invoice, contract, brand) expose the same HTTP interface:
 *   POST /ask
 *   Request:  { request: string }
 *   Response: { answer: string }
 *
 * This is the contract the router expects when forwarding to discovered agents.
 */

import { z } from "zod";

/**
 * Request body sent to an agent's POST /ask endpoint.
 */
export const agentRequestSchema = z.object({
  request: z.string().min(1, "Request must not be empty"),
});

export type AgentRequest = z.infer<typeof agentRequestSchema>;

/**
 * Response body returned by an agent's POST /ask endpoint.
 * This matches downstreamResponseSchema from src/schemas/routing.ts.
 */
export const agentResponseSchema = z.object({
  answer: z.string().min(1, "Answer must not be empty"),
});

export type AgentResponse = z.infer<typeof agentResponseSchema>;

/**
 * Error response from an agent when something goes wrong.
 */
export const agentErrorResponseSchema = z.object({
  error: z.string().min(1),
});

export type AgentErrorResponse = z.infer<typeof agentErrorResponseSchema>;
