# 02 — LLMClient seam, Fixtures, and Escalation

**What to build:** The single seam through which everything in the system reaches the model, both of its implementations, the command that records Fixtures, and the first consumer of all three — Escalation, the Router's second stage.

One `LLMClient` interface. Two implementations behind it: a replay adapter that serves recorded Fixtures, and a live adapter over the Anthropic SDK targeting `claude-sonnet-5`. Nothing above the seam knows which is in play. Replay Mode is the default; Live Mode requires both an explicit flag and a key, so no test run and no casual invocation can spend money.

A Fixture is keyed by a deterministic digest of the full request — model, system prompt, message history, and tool schemas — so any prompt or schema edit changes the key and invalidates the recording it produced. A key with no Fixture is a hard error that names the missing key and points at the record command. It is never a silent pass-through to the live API and never a fabricated answer. Fixtures are recorded, never hand-written.

A separate record command performs a Live Mode run for the purpose of writing Fixtures. This is the only sanctioned spend in the project.

**Escalation** is the first thing to use the seam. An Abstention from the Local Pass escalates to a single call through the `LLMClient` — no tools, no message history — which returns `finance`, `hr`, `both`, or `unclear`. Escalation is always on; there is no opt-out and no pure-local mode. The Route carries which stage produced it, so an operator can tell a free verdict from a paid one.

This ticket is where `unclear` becomes reachable. Before it, the Local Pass abstained and the run ended in a clarification request; now an Abstention escalates, and a clarification request is returned only when Escalation itself declines to place the Question. Keep Abstention and `unclear` distinct — they are different states with different consequences, per ADR 0005.

One negative behaviour matters as much as the positive ones: a Question the Local Pass places must never escalate. Silent escalation on every Question would pass every other check here while spending on every run.

**Blocked by:** 01 — Runnable CLI that reports a Route.

**Status:** done — delivered by d0316b7, f4e75ad

- [x] Every model call in the system goes through one `LLMClient` interface; no caller touches the SDK directly
- [x] Replay Mode is the default and runs with no key set
- [x] Live Mode requires both an explicit flag and a key; either one alone fails with a clear message
- [x] A Fixture key is a digest of model, system prompt, message history, and tool schemas
- [x] Editing a system prompt or a tool schema changes the key and stops the old Fixture being served
- [x] A Fixture miss fails loudly, naming the missing key and the record command; it never falls through to the live API
- [x] The record command performs a Live Mode run and writes Fixtures for the Questions it is given
- [x] An Abstention from the Local Pass triggers Escalation through the `LLMClient`
- [x] Escalation returns one of `finance`, `hr`, `both`, or `unclear`; `unclear` returns a clarification request
- [x] Escalation sends no tools and no message history
- [x] The output names which stage produced the Route — Local Pass or Escalation
- [x] Escalation is unconditional; there is no flag that disables it
- [x] A Question the Local Pass places is asserted not to escalate
- [x] Escalation is tested through Replay against recorded Fixtures, with no key and no spend
- [x] A test proves a Fixture cannot be hand-edited into passing — the recorded-not-written rule is enforced or documented where a contributor will hit it
