import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { JsonObject, LLMClient, LLMRequest, LLMResponse } from "./client.js";

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

/** A response in which the model answers in prose. */
export const says = (text: string): LLMResponse => ({ content: [{ type: "text", text }] });

/**
 * A response in which the model asks for a Scoped Tool.
 *
 * The identifier is derived from the tool name rather than generated, so a
 * recorded turn replays byte-for-byte on the next run.
 */
export const asksFor = (name: string, input: JsonObject = {}): LLMResponse => ({
  content: [{ type: "tool_use", id: `use_${name}`, name, input }],
});

/**
 * A client that plays a prepared sequence of responses.
 *
 * A tool-calling turn is several exchanges, so a single fixed answer cannot
 * drive one. This is still the same single substitution — a stand-in at the
 * `LLMClient` seam — and it is still the only one the suite permits. Running
 * off the end of the script is an error rather than a repeat of the last
 * response: a turn that asked for more than the test scripted is a test that
 * has stopped describing what it thinks it does.
 */
export const scriptedClient = (
  responses: readonly LLMResponse[],
): LLMClient & { readonly asked: LLMRequest[] } => {
  const asked: LLMRequest[] = [];

  return {
    asked,
    complete: async (request) => {
      const response = responses[asked.length];
      asked.push(request);
      if (response === undefined) {
        throw new Error(
          `The stand-in client was scripted with ${responses.length} responses and asked for ` +
            `${asked.length}.`,
        );
      }
      return response;
    },
  };
};

/** An empty directory to record Fixtures into, so no test writes into the shipped set. */
export const scratchFixturesDir = (): string => mkdtempSync(path.join(tmpdir(), "fixtures-"));
