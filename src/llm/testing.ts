import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { LLMClient, LLMRequest } from "./client.js";

/**
 * What the tests are allowed to substitute, kept in one place.
 *
 * The suite permits exactly one substitution — a stand-in at the `LLMClient`
 * seam — so it lives here rather than being re-declared in each test file. Six
 * copies of a fake drifting apart is how a suite starts testing its fakes
 * instead of the system.
 */

/**
 * A client that answers with a fixed text and keeps what it was asked.
 *
 * The record of requests is what makes the negative behaviours observable:
 * that Escalation sends no tools and no history, and that a Question the Local
 * Pass places is never asked about at all.
 */
export const standInClient = (text: string): LLMClient & { readonly asked: LLMRequest[] } => {
  const asked: LLMRequest[] = [];

  return {
    asked,
    complete: async (request) => {
      asked.push(request);
      return { content: [{ type: "text", text }] };
    },
  };
};

/** An empty directory to record Fixtures into, so no test writes into the shipped set. */
export const scratchFixturesDir = (): string => mkdtempSync(path.join(tmpdir(), "fixtures-"));
