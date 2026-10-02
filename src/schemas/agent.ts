/**
 * src/schemas/agent.ts
 *
 * Zod schema for a discovered ENS agent record.
 *
 * ENS text record format:
 *   agent:description  — human-readable description used for LLM routing
 *   agent:endpoint     — HTTPS URL the router forwards requests to
 *   agent:input        — description of the expected input format
 *   agent:version      — semver version string
 *
 * Validation notes:
 *  - z.string().url() validates URL format but NOT protocol.
 *    HTTPS enforcement is done explicitly in the forwarding layer (src/router/).
 *  - safeParse() is used at the discovery layer so one bad record
 *    skips that agent without crashing discovery.
 */

import { z } from "zod";

export const agentRecordSchema = z.object({
  ensName: z.string().min(1),
  description: z.string().min(1),
  endpoint: z.string().url(),
  input: z.string().min(1),
  version: z.string().min(1),
});

export type AgentRecord = z.infer<typeof agentRecordSchema>;

/**
 * The raw text records read from ENS before validation.
 * All fields are nullable because getEnsText returns null when a record
 * is missing.
 */
export const rawEnsRecordsSchema = z.object({
  ensName: z.string().min(1),
  description: z.string().nullable(),
  endpoint: z.string().nullable(),
  input: z.string().nullable(),
  version: z.string().nullable(),
});

export type RawEnsRecords = z.infer<typeof rawEnsRecordsSchema>;
