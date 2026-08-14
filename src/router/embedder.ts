import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

/** The local embedding model behind the Local Pass, per ADR 0002. */
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

/** Approximate on-disk size of the one-time model download. */
export const EMBEDDING_MODEL_DOWNLOAD_MB = 25;

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** Where Transformers.js keeps the downloaded model between runs. */
export const MODEL_CACHE_DIR = path.join(repoRoot, ".model-cache");

/**
 * The notice to show before loading the model, or `null` when the model is
 * already cached and loading it will be quiet and instant.
 *
 * A 25MB download with no explanation reads as a hang, so this is decided
 * before the load starts rather than reported while it runs.
 */
export const firstRunNotice = (cacheDir: string = MODEL_CACHE_DIR): string | null => {
  if (existsSync(path.join(cacheDir, EMBEDDING_MODEL))) return null;

  return (
    `First run: downloading the ${EMBEDDING_MODEL} embedding model ` +
    `(~${EMBEDDING_MODEL_DOWNLOAD_MB}MB) into ${path.relative(repoRoot, cacheDir) || cacheDir}. ` +
    `This happens once. Later runs start immediately and need no network.`
  );
};

env.cacheDir = MODEL_CACHE_DIR;
env.allowLocalModels = false;

let extractor: Promise<FeatureExtractionPipeline> | undefined;

/**
 * The embedding pipeline, loaded at most once per process and reused for every
 * Question. Loading is several seconds of work; doing it per Question would
 * make the Local Pass slower than the Escalation it exists to avoid.
 */
export const loadEmbedder = (
  announce: (notice: string) => void = (notice) => process.stderr.write(`${notice}\n`),
): Promise<FeatureExtractionPipeline> => {
  if (extractor === undefined) {
    const notice = firstRunNotice();
    if (notice !== null) announce(notice);

    extractor = pipeline("feature-extraction", EMBEDDING_MODEL);
  }
  return extractor;
};

/**
 * Embed texts as unit-length vectors, so that the cosine similarity of two of
 * them is their dot product.
 */
export const embed = async (texts: readonly string[]): Promise<number[][]> => {
  const extract = await loadEmbedder();
  const output = await extract(texts as string[], { pooling: "mean", normalize: true });
  return output.tolist() as number[][];
};

/** Cosine similarity of two unit-length vectors. */
export const cosineSimilarity = (a: readonly number[], b: readonly number[]): number => {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += (a[i] ?? 0) * (b[i] ?? 0);
  return total;
};
