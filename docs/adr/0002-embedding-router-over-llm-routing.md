# Embedding-similarity Router instead of an LLM classifier

Status: superseded by ADR 0005

> Superseded in part, not reversed. The embedding-similarity scoring described here is still exactly what the Router does first — it is now called the Local Pass. What changed is the final paragraph below: the LLM fallback is no longer a documented next step, it is built, and a Question the Local Pass abstains on now escalates rather than returning `unclear`. The reasoning here is left intact because it is still why the Local Pass runs first at all. See ADR 0005.

Routing a Question is a classification over a fixed, tiny label set, and the obvious move — asking a model which agent should answer — costs a round-trip and a token bill on every Question and gives a non-deterministic answer to a decision that has to be testable. Instead the Router embeds the Question locally (Transformers.js, `all-MiniLM-L6-v2`) and scores it against three Exemplar Banks by maximum cosine similarity, taking the best bank as the Route. Two thresholds carry the hard cases: a score floor below which the Route is `unclear`, and a top-two margin below which it is `both`.

## Consequences

The Router is deterministic, free, and unit-testable without any network or fake — which is what lets the test suite assert routing behaviour directly rather than around a mock. The costs: a first-run model download of roughly 25MB, and a router whose vocabulary is only as good as its Exemplar Banks, so an unanticipated phrasing degrades to `unclear` rather than being reasoned about. The production extension — falling back to an LLM call only on `unclear` — is documented in the README as the next step and deliberately not implemented here.
