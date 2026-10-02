/**
 * agents/invoice/index.ts
 *
 * Invoice agent server entry point.
 *
 * Run with:
 *   npm run dev agents/invoice/index.ts
 */

import { createAgentServer } from "../shared/server.js";
import { handleInvoiceRequest } from "./handler.js";

async function main() {
  const server = await createAgentServer({
    name: "Invoice Agent",
    port: 4001,
    handler: handleInvoiceRequest,
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
  console.error("Failed to start invoice agent:", error);
  process.exit(1);
});
