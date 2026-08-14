import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // The first run in a clean clone downloads the ~25MB embedding model.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // One process for the whole suite. Parallel workers each load the model,
    // and on a clean clone they race to write the same cache files — which
    // yields a half-written model and a "Protobuf parsing failed" load error.
    // Sharing one process downloads once, loads once, and is faster besides.
    poolOptions: { forks: { singleFork: true } },
  },
});
