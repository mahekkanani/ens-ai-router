/**
 * agents/brand/index.ts
 *
 * Brand agent server entry point.
 *
 * Run with:
 *   npm run dev agents/brand/index.ts
 */

import { createAgentServer } from "../shared/server.js";
import { handleBrandRequest } from "./handler.js";

async function main() {
  const server = await createAgentServer({
    name: "Brand Agent",
    port: 4003,
    handler: handleBrandRequest,
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
  console.error("Failed to start brand agent:", error);
  process.exit(1);
});
