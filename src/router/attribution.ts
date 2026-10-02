/**
 * src/router/attribution.ts
 *
 * Attribution module: formats a successful downstream response into
 * the final router response with ENS attribution.
 */

import type { AgentRecord } from "../schemas/agent.js";
import type { SuccessResponse } from "../schemas/routing.js";

/**
 * Format a successful routing result with ENS attribution.
 *
 * Attribution requires returning the ENS name of the agent the answered.
 * This ENS name MUST come from the discovered AgentRecord, not from independent
 * model output.
 *
 * @param selectedAgent - The discovered AgentRecord that was forwarded to
 * @param answer - The validated answer from the downstream agent
 * @returns SuccessResponse with explicit attribution
 */
export function formatSuccessResponse(
  selectedAgent: AgentRecord,
  answer: string,
): SuccessResponse {
  return {
    status: "success",
    agent: {
      ensName: selectedAgent.ensName,
    },
    answer,
  };
}
