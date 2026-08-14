import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LOCAL_ROUTES, type LocalRoute } from "../../domain/route.js";

/**
 * An Exemplar Bank: the labelled example Questions that define one Route for
 * the Local Pass.
 *
 * Banks are plain JSON sitting beside this file. Adding a phrasing to one
 * changes routing with no edit to Router logic — that is the point of loading
 * them as data rather than declaring them in code.
 */
export type ExemplarBank = {
  readonly route: LocalRoute;
  readonly exemplars: readonly string[];
};

const readBank = (route: LocalRoute): ExemplarBank => {
  const path = fileURLToPath(new URL(`./${route}.json`, import.meta.url));
  const exemplars: unknown = JSON.parse(readFileSync(path, "utf8"));

  if (!Array.isArray(exemplars) || exemplars.some((e) => typeof e !== "string")) {
    throw new Error(`Exemplar Bank ${route}.json must be a JSON array of strings`);
  }
  if (exemplars.length === 0) {
    throw new Error(`Exemplar Bank ${route}.json is empty`);
  }

  return { route, exemplars };
};

export const EXEMPLAR_BANKS: readonly ExemplarBank[] = LOCAL_ROUTES.map(readBank);
