import { createHash } from "node:crypto";
import type { JsonValue, LLMRequest } from "./client.js";

/**
 * JSON with object keys in sorted order, so that two requests that differ only
 * in the order they were assembled serialize identically.
 *
 * Without this the key would depend on the order a caller happened to spread
 * fields in, and a Fixture would go missing on a refactor that changed nothing
 * the model can see.
 */
export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, v]) => `${JSON.stringify(key)}:${canonicalJson(v)}`);

  return `{${entries.join(",")}}`;
};

export const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/**
 * The key a Fixture is stored under: a digest of the entire request — model,
 * system prompt, message history, and tool schemas.
 *
 * Keying on the whole request is what makes a stale recording impossible rather
 * than merely unlikely: edit a system prompt or a tool schema and the key moves,
 * so the old Fixture is not served, it is missed — loudly, per ADR 0001.
 */
export const fixtureKey = (request: LLMRequest): string =>
  sha256(canonicalJson(request as unknown as JsonValue));
