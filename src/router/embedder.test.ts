import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMBEDDING_MODEL,
  EMBEDDING_MODEL_DOWNLOAD_MB,
  cosineSimilarity,
  embed,
  firstRunNotice,
  loadEmbedder,
} from "./embedder.js";

const tempCacheDir = () => mkdtempSync(path.join(tmpdir(), "embedder-cache-"));

describe("the embedding model", () => {
  it("is loaded once per process and reused for every Question", async () => {
    const first = await loadEmbedder();
    const second = await loadEmbedder();

    expect(second).toBe(first);
  });

  it("announces the first-run download and its approximate size before loading", () => {
    const notice = firstRunNotice(tempCacheDir());

    expect(notice).not.toBeNull();
    expect(notice).toContain(`${EMBEDDING_MODEL_DOWNLOAD_MB}MB`);
    expect(notice).toContain(EMBEDDING_MODEL);
  });

  it("says nothing once the weights are on disk, so later runs are quiet", () => {
    const cacheDir = tempCacheDir();
    mkdirSync(path.join(cacheDir, EMBEDDING_MODEL, "onnx"), { recursive: true });
    writeFileSync(path.join(cacheDir, EMBEDDING_MODEL, "onnx", "model_quantized.onnx"), "weights");

    expect(firstRunNotice(cacheDir)).toBeNull();
  });

  it("still announces when an interrupted download left the directory but no weights", () => {
    const cacheDir = tempCacheDir();
    mkdirSync(path.join(cacheDir, EMBEDDING_MODEL, "onnx"), { recursive: true });

    // The re-fetch is the slow part, so this is the case that most needs saying.
    expect(firstRunNotice(cacheDir)).not.toBeNull();
  });

  it("embeds text as unit vectors, so cosine similarity is their dot product", async () => {
    const [vector] = await embed(["What is our current cash position?"]);

    expect(vector).toBeDefined();
    expect(cosineSimilarity(vector!, vector!)).toBeCloseTo(1, 5);
  });

  it("scores a paraphrase above an unrelated sentence", async () => {
    const [cash, paraphrase, unrelated] = await embed([
      "What is our current cash position?",
      "How much money do we have in the bank right now?",
      "Write me a poem about a cat.",
    ]);

    expect(cosineSimilarity(cash!, paraphrase!)).toBeGreaterThan(cosineSimilarity(cash!, unrelated!));
  });
});
