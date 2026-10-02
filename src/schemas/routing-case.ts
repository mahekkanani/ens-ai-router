/**
 * src/schemas/routing-case.ts
 *
 * Schema for routing test cases (cases/routing-cases.json).
 *
 * Each case contains a request and the expected agent that should handle it.
 * This satisfies hackathon test case #8 — 6 points.
 */

import { z } from "zod";

/**
 * Schema for a single routing test case.
 */
export const routingCaseSchema = z.object({
  request: z.string().min(1, "Request must not be empty"),
  expectedAgent: z.string().nullable(),
  category: z.string().optional(),
});

export type RoutingCase = z.infer<typeof routingCaseSchema>;

/**
 * Schema for the entire routing-cases.json file.
 */
export const routingCasesSchema = z.array(routingCaseSchema).min(1);

export type RoutingCases = z.infer<typeof routingCasesSchema>;
