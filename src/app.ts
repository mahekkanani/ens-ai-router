/**
 * src/app.ts
 *
 * Central Fastify application factory for the AI Router.
 *
 * Orchestrates the full routing loop without bypassing or duplicating
 * any logic from the strictly tested modules:
 *
 * 1. ENS Discovery     (src/discovery/ens.ts)
 * 2. LLM Routing       (src/llm/router.ts)
 * 3. Secure Forwarding (src/router/forward.ts)
 * 4. Attribution       (src/router/attribution.ts)
 *
 * Explicitly implements TEST #7 (6 points) — explicit no-agent branch.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { config } from "./config.js";
import { agentRequestSchema } from "./schemas/agent-http.js";
import { discoverAgents } from "./discovery/index.js";
import { routeWithLLM } from "./llm/router.js";
import { forwardToAgent } from "./router/forward.js";
import { formatSuccessResponse } from "./router/attribution.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV === "test" ? false : {
      level: "info",
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    },
  });

  // Health check endpoint
  app.get("/health", async () => {
    return { status: "ok", service: "ens-ai-router" };
  });

  // Central routing endpoint
  app.post("/route", async (request, reply) => {
    // 1. Validate incoming client request
    const parseResult = agentRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        status: "error",
        code: "invalid_request",
        message: parseResult.error.issues.map((i) => i.message).join("; "),
      });
    }

    const userRequest = parseResult.data.request;

    try {
      // 2. Discover agents from ENS dynamically at runtime
      // No hardcoded agents exist here.
      const discoveryResult = await discoverAgents(
        config.ens.registryName,
        config.sepolia.rpcUrl,
      );

      // 3. Model-driven routing with Phase 5 validation
      const decision = await routeWithLLM(discoveryResult.agents, userRequest);

      // 4. Check for invalid LLM output (Test #1 requirement)
      if (decision.type === "invalid_selection") {
        app.log.warn(
          `Invalid agent selection: attempted=${decision.attemptedAgent}, reason=${decision.reason}`,
        );
        // Do not leak internal reasons to the client. Safely refuse to route.
        return reply.code(502).send({
          status: "error",
          code: "invalid_model_selection",
          message: "The routing engine made an invalid selection.",
        });
      }

      // 5. Explicit NO-AGENT branch (Test #7 — 6 points)
      // Must not silently forward or return generic errors.
      if (decision.type === "no_suitable_agent") {
        app.log.info("No suitable agent found for request");
        return reply.code(200).send({
          status: "no_suitable_agent",
          message: "No suitable agent was found for this request.",
        });
      }

      // 6. Valid Agent Selected -> Forward using Phase 6 strict forwarding
      const selectedAgent = decision.agent;
      const forwardResult = await forwardToAgent(selectedAgent, userRequest);

      // 7. Downstream HTTP Error handling
      if (!forwardResult.success) {
        // Map timeout to 504 Gateway Timeout, others to 502 Bad Gateway
        const statusCode = forwardResult.code === "timeout" ? 504 : 502;

        // Log the verbose error internally to avoid leaking raw downstream text to clients
        app.log.error(`Downstream failure: ${forwardResult.error}`);

        return reply.code(statusCode).send({
          status: "error",
          code: forwardResult.code,
          message: "The downstream agent encountered an error processing the request.",
        });
      }

      // 8. Successful response with verified ENS Attribution
      return reply
        .code(200)
        .send(formatSuccessResponse(selectedAgent, forwardResult.answer));

    } catch (error) {
      // Catch unhandled errors natively (e.g. ENS network total failure, config errors)
      app.log.error(error);

      // Do not leak internal stack traces or API keys
      return reply.code(500).send({
        status: "error",
        code: "internal_server_error",
        message: "An internal server error occurred while processing the request.",
      });
    }
  });

  return app;
}
