# Two-stage Router: a Local Pass, then Escalation

Status: accepted — supersedes ADR 0002

ADR 0002 chose an embedding-similarity Router and deliberately left the LLM fallback unbuilt. That fallback is now built. The Router runs a Local Pass first — the same local embedding scoring against Exemplar Banks, with the same score floor and top-two margin — and a Question the Local Pass abstains on escalates to a single model call that places it as `finance`, `hr`, `both`, or `unclear`. Escalation is always on; there is no opt-out flag and no pure-local mode.

The ordering is the whole design. Running the Local Pass first keeps the common case free and deterministic and confines both spend and non-determinism to exactly the Questions a purely local Router would have failed outright.

## Considered options

- **Classify every Question with the model, dropping the Local Pass.** One code path, no thresholds to tune. Rejected for the reasons ADR 0002 gave and which still hold: it pays on every Question and makes routing untestable without a fake.
- **Keep the Local Pass alone, as ADR 0002 decided.** Free and fully deterministic, but an unanticipated phrasing dead-ends at a clarification request rather than being routed — and Exemplar Banks cannot be written to anticipate everything.
- **Escalation behind an opt-out flag, off by default.** Preserves zero-cost ambiguity for anyone who wants it. Rejected because it creates two routing behaviours that drift apart, and because a reviewer would see the good one only by knowing to pass a flag.

## Consequences

- **Routing is no longer deterministic end to end.** The Local Pass still is, and that is where routing behaviour is asserted directly with no fake. Escalation is exercised through Fixtures like every other model call, so the suite stays hermetic.
- **Ambiguous input is no longer free.** The spec previously promised that a vague Question costs nothing; that promise is withdrawn deliberately, not overlooked. The cost is one small call — no tools, no history — and is bounded by how often the Exemplar Banks fall short.
- **A thin Exemplar Bank now shows up as spend rather than as a visible misroute.** This is the uncomfortable half of the trade: the failure mode got quieter, not smaller. Adding a phrasing to a Bank is therefore both a routing fix and a cost fix, and a run that escalates often is a signal to go edit Banks.
- **Escalation reaches the model through the same `LLMClient` seam as the Specialist Agents**, per ADR 0003, so there is one path to the API rather than a second one to keep in step.
- **`unclear` is now reachable only through Escalation.** The Local Pass declining to place a Question is an Abstention, which never reaches the operator. The two states are distinct and named separately in `CONTEXT.md`.
