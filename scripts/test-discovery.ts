/**
 * scripts/test-discovery.ts
 *
 * Standalone script to test ENS discovery against Sepolia.
 *
 * Usage:
 *   npm run dev scripts/test-discovery.ts
 *
 * This script demonstrates the full discovery flow:
 *   1. Read registry ENS name from environment
 *   2. Fetch agent:index record
 *   3. For each agent name, fetch its four text records
 *   4. Validate with Zod
 *   5. Skip malformed agents, continue discovery
 *   6. Print the DiscoveryResult
 *
 * If the registry ENS name or agent records don't exist yet on Sepolia,
 * discovery will gracefully return an empty agent list.
 */

import { config } from "../src/config.js";
import { discoverAgents } from "../src/discovery/index.js";

async function main() {
  console.log("=== ENS Discovery Test ===\n");
  console.log(`Registry ENS name: ${config.ens.registryName}`);
  console.log(`Sepolia RPC:       ${config.sepolia.rpcUrl.slice(0, 50)}...`);
  console.log();

  try {
    const result = await discoverAgents(
      config.ens.registryName,
      config.sepolia.rpcUrl,
    );

    console.log("\n=== Discovery Result ===\n");
    console.log(`Registry:       ${result.registryName}`);
    console.log(`Valid agents:   ${result.agents.length}`);
    console.log(`Skipped agents: ${result.skipped.length}`);
    console.log();

    if (result.agents.length > 0) {
      console.log("Valid Agents:\n");
      for (const agent of result.agents) {
        console.log(`  • ${agent.ensName}`);
        console.log(`    Description: ${agent.description}`);
        console.log(`    Endpoint:    ${agent.endpoint}`);
        console.log(`    Input:       ${agent.input}`);
        console.log(`    Version:     ${agent.version}`);
        console.log();
      }
    }

    if (result.skipped.length > 0) {
      console.log("Skipped Agents:\n");
      for (const skip of result.skipped) {
        console.log(`  ✗ ${skip.ensName}`);
        console.log(`    Reason: ${skip.reason}`);
        console.log();
      }
    }

    if (result.agents.length === 0 && result.skipped.length === 0) {
      console.log(
        `No agents found. The registry ${config.ens.registryName} may not have ` +
        `an agent:index record set yet, or the record is empty.`,
      );
      console.log();
      console.log("To add agents:");
      console.log(`  1. Register ENS names on Sepolia (e.g. invoices.priya.eth)`);
      console.log(`  2. Set their agent:description, agent:endpoint, agent:input, agent:version records`);
      console.log(`  3. Set ${config.ens.registryName}'s agent:index record to a comma-separated list of those names`);
    }

    process.exit(0);
  } catch (error) {
    console.error("\n=== Discovery Failed ===\n");
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
