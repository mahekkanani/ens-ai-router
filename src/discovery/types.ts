/**
 * src/discovery/types.ts
 *
 * Discovery layer types — decoupled from the viem implementation so
 * tests can provide a stub without touching the network.
 */

import type { AgentRecord } from "../schemas/agent.js";

/** Result of a full discovery pass. */
export interface DiscoveryResult {
  /** Successfully validated agents, ready to route to. */
  agents: AgentRecord[];
  /** Names that were found in the index but failed validation. */
  skipped: Array<{ ensName: string; reason: string }>;
  /** The registry ENS name used for this discovery pass. */
  registryName: string;
}
