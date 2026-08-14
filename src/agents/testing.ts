import type { JsonValue } from "../llm/client.js";

/**
 * How the isolation tests read a value apart.
 *
 * Both Specialist Agents are held to the same shape of argument — that nothing
 * comes out of a Scoped Tool but the Dataset behind it — so the three ways of
 * taking a result to pieces live here rather than once per agent. Two copies
 * drifting apart is how a suite starts proving different things about the two
 * halves of one guarantee.
 */

/** Every scalar reachable inside a value, ignoring the keys around them. */
export const leavesOf = (value: JsonValue): (string | number | boolean | null)[] => {
  if (Array.isArray(value)) return value.flatMap(leavesOf);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(leavesOf);
  return [value];
};

/** Every field name reachable inside a value, at any depth. */
export const keysOf = (value: JsonValue): string[] => {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nested]) => [key, ...keysOf(nested)]);
  }
  return [];
};

/** The length of every list reachable inside a value — the only figures a Scoped Tool computes. */
export const countsIn = (value: JsonValue): number[] => {
  if (Array.isArray(value)) return [value.length, ...value.flatMap(countsIn)];
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(countsIn);
  return [];
};

/**
 * Every object and array reachable inside a value, by identity.
 *
 * What "no shared data layer" comes down to when you go looking for it: two
 * Datasets share nothing if nothing in one is the same object as anything in
 * the other.
 */
export const objectsIn = (value: unknown): object[] => {
  if (value === null || typeof value !== "object") return [];
  return [value, ...Object.values(value).flatMap(objectsIn)];
};
