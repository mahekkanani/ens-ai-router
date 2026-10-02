/**
 * agents/shared/server.ts
 *
 * Reusable Fastify server setup for specialist agents.
 *
 * All three agents (invoice, contract, brand) share the same HTTP contract:
 *   POST /ask  { request: string } → { answer: string }
 *
 * This utility:
 * - Creates a Fastify server with standard config
 * - Registers the POST /ask route
 * - Validates request/response with Zod
 * - Delegates answer generation to a provided handler
 */

import Fastify, { type FastifyInstance } from "fastify";
import {
  agentRequestSchema,
  agentResponseSchema,
  type AgentRequest,
  type AgentResponse,
} from "../../src/schemas/agent-http.js";

export interface AgentHandler {
  (request: string): Promise<string>;
}

export interface AgentServerConfig {
  name: string;
  port: number;
  handler: AgentHandler;
}

/**
 * Create and start a specialist agent server.
 * Returns the Fastify instance.
 */
export async function createAgentServer(
  config: AgentServerConfig,
): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
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

  // Health check
  server.get("/health", async () => {
    return { status: "ok", agent: config.name };
  });

  // Main endpoint
  server.post<{ Body: AgentRequest }>("/ask", async (request, reply) => {
    // Validate request body
    const parseResult = agentRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.code(400);
      return {
        error: `Invalid request: ${parseResult.error.issues.map((i) => i.message).join("; ")}`,
      };
    }

    const { request: userRequest } = parseResult.data;

    try {
      // Delegate to the agent-specific handler
      const answer = await config.handler(userRequest);

      // Validate response
      const responseResult = agentResponseSchema.safeParse({ answer });
      if (!responseResult.success) {
        throw new Error(
          `Agent handler returned invalid response: ${responseResult.error.message}`,
        );
      }

      return responseResult.data;
    } catch (error) {
      server.log.error(error, "Agent handler error");
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Internal server error",
      };
    }
  });

  // Start server
  await server.listen({ port: config.port, host: "127.0.0.1" });
  server.log.info(`${config.name} agent listening on http://127.0.0.1:${config.port}`);

  return server;
}
