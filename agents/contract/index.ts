/**
 * agents/contract/index.ts
 *
 * Contract agent server entry point.
 *
 * Run with:
 *   npm run dev agents/contract/index.ts
 */

import { createAgentServer } from "../shared/server.js";
import { handleContractRequest } from "./handler.js";

async function main() {
  const server = await createAgentServer({
    name: "Contract Agent",
    port: 4002,
    handler: handleContractRequest,
  });

  // Graceful shutdown
  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Failed to start contract agent:", error);
  process.exit(1);
});
