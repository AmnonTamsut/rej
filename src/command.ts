import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEmbedder } from "./router/embedder.js";

/** What a command hands back, so its entry point can be driven by a test. */
export type CliResult = {
  readonly exitCode: number;
  readonly output: string;
  /** Something to say on stderr about how the run is configured, or `null`. */
  readonly notice: string | null;
};

/**
 * Run a command when its file was invoked directly, and not when it was
 * imported.
 *
 * Both commands share the same opening move: load the embedding model — and
 * announce the first-run download — before any output, so a 25MB fetch never
 * looks like the program hanging on the Question.
 */
export const runAsCommand = async (
  moduleUrl: string,
  run: () => Promise<CliResult>,
): Promise<void> => {
  const invokedDirectly =
    process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(moduleUrl);
  if (!invokedDirectly) return;

  await loadEmbedder();
  const { exitCode, output, notice } = await run();
  if (notice !== null) process.stderr.write(`${notice}\n`);
  process.stdout.write(`${output}\n`);
  process.exitCode = exitCode;
};
