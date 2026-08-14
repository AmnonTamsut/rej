import { readdirSync } from "node:fs";
import path from "node:path";

/**
 * Test helpers that are about the source tree itself rather than about any one
 * module, kept here for the same reason `src/llm/testing.ts` keeps the seam's
 * stand-in: a helper copied into a second test file is a helper whose two
 * copies will one day disagree about what they scan.
 *
 * Several tests are assertions over the whole of `src` — that only one file
 * reads the API key, that only one reaches the SDK, that the themed department
 * names are never code identifiers. All of them start by listing the files, and
 * this is that list.
 */

/**
 * Every TypeScript file under a directory, recursively.
 *
 * Tests are excluded by default, because most whole-tree rules are about what
 * the system does rather than about what its tests say. A rule that binds the
 * tests too — the vocabulary rules do, since a test can name a thing as wrongly
 * as anything else — asks for them.
 */
export const sourceFiles = (
  dir: string,
  { includeTests = false }: { readonly includeTests?: boolean } = {},
): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full, { includeTests });
    if (!entry.isFile() || !entry.name.endsWith(".ts")) return [];

    return includeTests || !entry.name.endsWith(".test.ts") ? [full] : [];
  });
