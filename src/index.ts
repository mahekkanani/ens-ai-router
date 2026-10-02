/**
 * src/index.ts
 *
 * Entry point to start the AI Router Fastify server.
 */

import { buildApp } from "./app.js";
import { config } from "./config.js";

async function main() {
  const app = buildApp();
  try {
    await app.listen({ port: config.server.port, host: "0.0.0.0" });
    app.log.info(`Router listening on http://localhost:${config.server.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
