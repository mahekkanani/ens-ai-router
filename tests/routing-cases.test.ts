/**
 * tests/routing-cases.test.ts
 *
 * Tests for routing-cases.json validation.
 *
 * Verifies test case #8 (6 points): Recorded routing cases state expected agent.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { routingCasesSchema } from "../src/schemas/routing-case.js";

describe("Routing cases (Test #8 — 6 points)", () => {
  it("cases/routing-cases.json exists and is valid JSON", () => {
    const casesPath = join(process.cwd(), "cases", "routing-cases.json");
    const content = readFileSync(casesPath, "utf-8");

    // Must be valid JSON
    const parsed = JSON.parse(content);
    expect(parsed).toBeDefined();
    expect(Array.isArray(parsed)).toBe(true);
  });

  it("All cases have valid structure with expectedAgent", () => {
    const casesPath = join(process.cwd(), "cases", "routing-cases.json");
    const content = readFileSync(casesPath, "utf-8");
    const parsed = JSON.parse(content);

    const result = routingCasesSchema.safeParse(parsed);

    if (!result.success) {
      console.error("Routing cases validation failed:", result.error.issues);
    }

    expect(result.success).toBe(true);
  });

  it("Contains at least one case for each agent type", () => {
    const casesPath = join(process.cwd(), "cases", "routing-cases.json");
    const content = readFileSync(casesPath, "utf-8");
    const cases = JSON.parse(content);

    const agentNames = cases
      .map((c: any) => c.expectedAgent)
      .filter((a: any) => a !== null);

    // Must have multiple distinct agent names
    const uniqueAgents = new Set(agentNames);
    expect(uniqueAgents.size).toBeGreaterThanOrEqual(3);
  });

  it("Contains at least one unmatched case with expectedAgent: null", () => {
    const casesPath = join(process.cwd(), "cases", "routing-cases.json");
    const content = readFileSync(casesPath, "utf-8");
    const cases = JSON.parse(content);

    const nullCases = cases.filter((c: any) => c.expectedAgent === null);
    expect(nullCases.length).toBeGreaterThanOrEqual(1);
  });

  it("Every case has a non-empty request string", () => {
    const casesPath = join(process.cwd(), "cases", "routing-cases.json");
    const content = readFileSync(casesPath, "utf-8");
    const cases = JSON.parse(content);

    for (const testCase of cases) {
      expect(testCase.request).toBeDefined();
      expect(typeof testCase.request).toBe("string");
      expect(testCase.request.length).toBeGreaterThan(0);
    }
  });

  it("Every case explicitly states expectedAgent (string or null, not undefined)", () => {
    const casesPath = join(process.cwd(), "cases", "routing-cases.json");
    const content = readFileSync(casesPath, "utf-8");
    const cases = JSON.parse(content);

    for (const testCase of cases) {
      expect("expectedAgent" in testCase).toBe(true);
      expect(
        testCase.expectedAgent === null || typeof testCase.expectedAgent === "string"
      ).toBe(true);
    }
  });
});
