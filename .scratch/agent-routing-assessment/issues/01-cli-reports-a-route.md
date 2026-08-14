# 01 — Runnable CLI that reports a Route

**What to build:** A single command-line entry point that takes a Question and prints the Route the Router assigned it, along with the per-bank similarity scores behind that verdict. This is the first runnable thing in the repo and the surface every later ticket drives.

This ticket builds the Local Pass — the Router's first stage. It embeds the Question locally and scores it by maximum cosine similarity against three Exemplar Banks — `finance`, `hr`, and `both`. Two named, adjustable thresholds carry the hard cases: a score floor below which the Local Pass abstains, and a top-two margin below which the Route is `both`. Exemplar Banks are plain data, editable without touching Router logic. The embedding model is loaded once and reused.

Escalation does not exist yet — it lands in ticket 02. Until then an Abstention terminates in a clarification request and makes no API call. That is a real, shippable state rather than a stub, but note that it is not the same thing as the `unclear` Route: `unclear` becomes reachable only once Escalation exists. Keep the two distinct in the code from the start, because merging them here is exactly the change ticket 02 would have to unpick.

The first run downloads roughly 25MB of embedding model. Say so on the console before it happens, or it reads as a hang.

This ticket also establishes the toolchain the rest of the work sits on: TypeScript on Node, run directly from source with no build step, Vitest as the test runner.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Running the entry point with a Question prints the verdict and the per-bank scores
- [ ] A money Question routes `finance`; a people Question routes `hr`
- [ ] A cross-cutting Question routes `both` via the top-two margin
- [ ] An off-topic Question produces an Abstention via the score floor and returns a clarification request
- [ ] Abstention is represented distinctly from the `unclear` Route, not as the same value
- [ ] No network call is made on any path, and no API key is required to run
- [ ] The score floor and top-two margin are named constants, adjustable in one place
- [ ] Exemplar Banks are data files; adding a phrasing to one changes routing without a logic edit
- [ ] The embedding model is loaded once per process, not per Question
- [ ] First-run model download is announced on the console with its approximate size before it starts
- [ ] A Vitest table maps Questions to expected verdicts covering `finance`, `hr`, `both`, and Abstention, including phrasings near the score floor and near the top-two margin
- [ ] Scores appear in test failure output so a boundary failure is diagnosable
- [ ] The suite runs from a clean clone with no key and no network beyond the one-time model download
