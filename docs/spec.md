# Two Specialist Agents behind a deterministic Router

Labels: `ready-for-agent`

## Problem Statement

A reviewer is going to open this repo and decide, in one sitting, whether the author can architect a multi-agent system. Right now the repo holds a glossary and four ADRs and no code at all, so there is nothing to run and nothing to read.

The system the reviewer wants to see answers business Questions across two domains that must not mix. Money Questions and people Questions land in the same inbox, but the data behind them cannot be pooled: whoever answers "what did we spend on payroll?" must not be able to read what any individual earns. A single agent with access to everything would answer both kinds of Question and would quietly destroy that boundary. Two agents with a human deciding which one to ask is not a system.

Three further problems sit behind that:

- Some Questions genuinely need both domains — "should we hire more people?" is a headcount Question and a cash Question at once, and neither Specialist Agent can answer it alone from its own Dataset.
- An agent that answers in prose about numbers will, sooner or later, state a number that came from nowhere. In a finance answer that is not a cosmetic flaw.
- The reviewer has no Anthropic key and should not need one, and the author is working under a hard $5 budget cap on a personal account. A system that only demonstrates itself by spending money demonstrates itself to nobody.

## Solution

A TypeScript application that takes a Question and returns an answer, choosing its own route to get there.

A Question first meets the Router, which decides in two stages. The Local Pass runs first — locally, deterministically, without an API call — and places the Question as `finance`, `hr`, or `both`. A Question the Local Pass cannot place is not refused: the Abstention triggers Escalation, a single model call that returns one of the same three Routes or `unclear`. A `finance` Question goes to the Finance Agent, which can read the finance Dataset and nothing else. An `hr` Question goes to the HR Agent on the same terms. A `both` Question opens an Agent Meeting, where each Specialist Agent examines the Question through its own Scoped Tools and the two contributions are combined into a single joint recommendation. A Question neither stage can place comes back as a request for clarification.

Most Questions never reach Escalation, so most Questions route for free. The ones that do reach it are the ones a Local Pass alone would have failed on, which is the trade this design accepts.

Every figure in every answer is checked by the Number Audit against the Scoped Tool results that answer was built from, so a number the agent invented is caught rather than shipped.

The reviewer clones the repo, installs, and runs it with no key and no spend, because Replay Mode is the default and serves answers from Fixtures recorded from real Live Mode calls. The full test suite runs on that same path. `--live` is there, opt-in, for anyone who wants to watch it talk to the real API.

## User Stories

1. As an assessment reviewer, I want to clone the repo and get a real answer to a real Question without an API key, so that I can evaluate the system in the first five minutes rather than after setting up billing.
2. As an assessment reviewer, I want to run the whole test suite offline and for free, so that I can trust the tests are actually run rather than aspirational.
3. As an assessment reviewer, I want a README that explains the design decisions and the trade-offs behind them, so that I can judge the thinking and not just the output.
4. As an assessment reviewer, I want to see the isolation guarantee in the wiring, so that I can verify it by reading rather than by trusting a policy check.
5. As an assessment reviewer, I want to ask a Question the system was not designed for and get a graceful answer, so that I can see the author considered more than the happy path.
6. As an operator, I want to ask a money Question in plain language and have it answered, so that I do not have to know which Specialist Agent owns it.
7. As an operator, I want to ask a people Question in plain language and have it answered, so that the same interface serves both domains.
8. As an operator, I want the Router's verdict reported alongside the answer, so that I can tell which Specialist Agent spoke and whether the routing was sane.
9. As an operator, I want a cross-cutting Question to trigger an Agent Meeting rather than a partial answer, so that "should we hire more people?" is answered with both the headcount and the cash position in view.
10. As an operator, I want the Agent Meeting to end in one joint recommendation rather than two pasted answers, so that I get a decision instead of a transcript.
11. As an operator, I want each Specialist Agent's contribution to the Agent Meeting to remain attributable in the output, so that I can see which domain supplied which fact.
12. As an operator, I want a Question that neither Router stage can place to come back as a request for clarification, so that I am not handed a confident answer to a Question the system did not understand.
13. As an operator, I want a Question the Local Pass cannot place to reach Escalation rather than be refused outright, so that an unanticipated phrasing still gets to the right Specialist Agent.
14. As an operator, I want every figure in an answer to be traceable to a Scoped Tool result, so that I can act on the numbers.
15. As an operator, I want to be told when an answer failed the Number Audit rather than shown the answer anyway, so that a hallucinated figure never reaches me unmarked.
16. As a finance stakeholder, I want the agent answering my Question to reach payroll cost only in aggregate, so that asking a finance Question can never surface an individual's salary.
17. As an HR stakeholder, I want the agent answering my Question to have no access to company financials, so that the people domain cannot be used as a side door into the books.
18. As a security reviewer, I want each Specialist Agent to hold only its own Scoped Tools, so that isolation is a structural property rather than a filter that could be misconfigured.
19. As a security reviewer, I want there to be no shared data layer and no tool that reads across the boundary, so that there is no single component whose correctness the whole guarantee depends on.
20. As a maintainer, I want the Local Pass to be deterministic, so that every Question it can place produces the same Route every time and that behaviour can be asserted directly with no fake.
21. As a maintainer, I want the Local Pass to run with no network call, so that routing costs nothing for the Questions it can place and the bulk of the routing suite works in CI without a key.
22. As a maintainer, I want to add a Question phrasing to an Exemplar Bank and see routing improve, so that tuning the Router is a data edit rather than a prompt rewrite.
23. As a maintainer, I want the Router's similarity scores available on its verdict, so that I can debug a misroute by seeing how close the decision was.
24. As a maintainer, I want the score floor and the top-two margin to be named, adjustable thresholds, so that the `unclear` and `both` behaviours can be tuned and tested at their boundaries.
25. As a maintainer, I want every agent to reach the model through one `LLMClient` interface, so that Replay Mode and Live Mode are two implementations of the same thing rather than a branch inside the agents.
26. As a maintainer, I want swapping providers to mean writing one file against a documented interface, so that single-provider today does not mean locked-in tomorrow.
27. As a maintainer, I want a Fixture to be keyed by the exact request that produced it, so that changing a prompt cannot silently keep serving the old recording.
28. As a maintainer, I want a Fixture miss to fail loudly with an instruction to re-record, so that a stale recording surfaces as an error rather than as a wrong answer.
29. As a maintainer, I want re-recording Fixtures to be one deliberate, budgeted command, so that refreshing the recordings is a decision rather than an accident.
30. As a maintainer, I want Live Mode to require an explicit flag and a key, so that no test run and no casual invocation can spend money.
31. As a maintainer, I want a hand-edited Fixture to be against the rules and visibly so, so that the demo keeps meaning what it claims to mean.
32. As a maintainer, I want the first-run model download to be explained before it happens, so that a 25MB download does not read as a hang.
33. As a maintainer, I want the Datasets hardcoded and owned one-per-agent, so that there is no database to stand up and no shared store to leak through.
34. As a maintainer, I want Scoped Tools to be read-only, so that no Question can mutate state.
35. As a maintainer, I want each Specialist Agent's system prompt to state its domain and its limits, so that the agent declines out-of-domain Questions instead of guessing at data it cannot see.
36. As a maintainer, I want an agent that is asked something outside its domain to say so, so that a Router mistake degrades into a visible refusal rather than an invented answer.
37. As a developer extending the system, I want adding a third Specialist Agent to mean adding a Dataset, a tool set, a prompt, and an Exemplar Bank, so that the growth path is obvious from the existing shape.
38. As a developer extending the system, I want Escalation to reach the model through the same `LLMClient` seam the agents use, so that there is one path to the API rather than a second one to maintain.
39. As the author, I want the whole system to run under a hard budget cap, so that producing the deliverable cannot overrun a personal account.
40. As an operator, I want the output to say whether the Route came from the Local Pass or from Escalation, so that I can tell a free verdict from a paid one.
41. As an operator, I want Escalation to be able to return `unclear`, so that a genuinely meaningless Question is not forced into a domain it does not belong to.
42. As a maintainer, I want Escalation to be always on with no opt-out flag, so that there is one routing behaviour to reason about rather than two modes that drift apart.
43. As a maintainer, I want Escalation's verdicts served from Fixtures in Replay Mode like every other model call, so that the routing suite stays hermetic and free despite Escalation existing.
44. As a maintainer, I want a Question the Local Pass places never to reach Escalation, so that the free path stays free and a silent escalation on every Question cannot drain the budget unnoticed.
45. As the author, I want Escalation to be one small call — no tools, no message history — so that it stays inside the budget cap.
46. As a maintainer, I want frequent Escalation to read as a signal to widen an Exemplar Bank, so that the cheapest fix for spend is also the fix for routing quality.

## Implementation Decisions

**Entry point.** A single command-line entry point takes a Question as input and prints the Route, the answering agent or agents, and the answer. It accepts a `--live` flag (default off) selecting Live Mode, and a separate record command that performs a Live Mode run for the purpose of writing Fixtures. This entry point is the top of the system and the surface the tests drive.

**Router.** A module mapping a Question to a Route without answering it, in two stages, per ADR 0005 (which supersedes ADR 0002).

The **Local Pass** embeds the Question locally with Transformers.js (`all-MiniLM-L6-v2`) and scores it by maximum cosine similarity against three Exemplar Banks (`finance`, `hr`, `both`). Two named thresholds decide the hard cases: a score floor, below which the Local Pass abstains, and a top-two margin, below which the Route is `both`. It returns its verdict together with the per-bank scores, so a misroute is debuggable and so tests can assert on boundary behaviour rather than only on the final label. Exemplar Banks are plain data, editable without touching Router logic. The embedding model is loaded once and reused across Questions.

**Escalation** runs only on an Abstention. It is a single classification call through the `LLMClient` — no tools, no message history — returning `finance`, `hr`, `both`, or `unclear`. It is always on; there is no flag that disables it and no pure-local mode, so there is one routing behaviour rather than two that drift. The Route the Router returns carries which stage produced it, so an Escalation is visible in the output and countable in a run.

Escalation is the only routing cost in the system, and it is bounded by how often the Exemplar Banks fall short. Adding a phrasing to an Exemplar Bank is therefore both a routing fix and a cost fix.

Note the distinction the vocabulary now carries: an **Abstention** is the Local Pass declining and is never returned to the operator, whereas `unclear` is a Route and is reachable only through Escalation. Conflating them is the mistake this design is most likely to invite.

**Specialist Agents.** Two, each holding a unique system prompt, its own Dataset, and its own Scoped Tools, per ADR 0004. An agent runs a tool-calling loop against the `LLMClient`: it is handed only its own tool schemas, the model requests a tool, the Scoped Tool executes against that agent's Dataset, and the result is fed back until the model produces an answer. The tool results accumulated during the turn are retained — they are the evidence the Number Audit checks against. Each system prompt names the agent's domain, names what it cannot see, and instructs it to decline rather than speculate when a Question falls outside its Scoped Tools.

**Datasets and Scoped Tools.** Two hardcoded JSON Datasets, no shared one, no database. Every Scoped Tool is a read-only function over exactly one Dataset and is exposed to exactly one agent. The Finance Agent's tools cover revenue, expenses, and cash position, plus a payroll tool that returns aggregates only — that shape is the isolation guarantee, not a filter applied to a richer result. The HR Agent's tools cover headcount, vacancies, attrition, and individual salaries. No tool reads across the boundary; there is no caller identity and no per-request filtering anywhere in the system, because isolation is structural.

**`LLMClient` seam.** One small interface, per ADR 0003, through which every agent reaches the model. Two implementations: a live adapter over `@anthropic-ai/sdk` targeting `claude-sonnet-5`, and a replay adapter serving Fixtures. Nothing else in the system knows which is in play. No second provider adapter ships.

**Replay Mode and Fixtures.** Replay Mode is the default, per ADR 0001. A Fixture is keyed by a deterministic digest of the full request — model, system prompt, message history, and tool schemas — so that any prompt or tool-schema edit changes the key and invalidates the recording it produced. A key with no Fixture is a hard error naming the missing key and pointing at the record command; it is never a silent pass-through to the live API and never a fabricated answer. Fixtures are recorded, never written by hand.

**Agent Meeting.** The flow reserved for the `both` Route. Each Specialist Agent independently examines the Question through its own Scoped Tools and produces a contribution; the contributions are then combined into a single joint recommendation that cites which domain supplied which fact. The agents do not share tools or Datasets during the meeting — cross-cutting work is done by combining two scoped views, which is exactly why the Agent Meeting exists rather than one agent reaching wider.

**Number Audit.** A pure check over an answer and the Scoped Tool results that produced it: every numeric figure appearing in the answer must appear in those results. It runs on each Specialist Agent's answer and on each contribution and the synthesis within an Agent Meeting. A failure is surfaced on the output rather than swallowed — the operator learns the answer is unaudited and which figure was unaccounted for. Known tolerances (formatting of currency and thousands separators, percentages derived from two audited figures) are decided explicitly rather than left to chance, and the chosen rule is documented.

**`unclear` handling.** `unclear` is now a Route only Escalation can reach. An Abstention escalates rather than terminating; a Question comes back as a clarification request only when Escalation itself declines to place it. The clarification request is issued from the entry point and no Specialist Agent is invoked.

This reverses the earlier decision that an ambiguous Question costs nothing. That property is deliberately traded for routing that survives an unanticipated phrasing, and the trade is recorded in ADR 0005 rather than left implicit.

**Toolchain.** TypeScript on Node, run directly from source, with Vitest as the test runner. No build step is required to run the demo or the tests.

**README.** Ships as part of the deliverable: what the system does, how to run it — Live Mode first, since it is the only mode that answers a Question the reader wrote, then the demo set with no key — the architecture and the reasoning behind it (drawing on the four ADRs), the first-run model download, and the documented next steps.

What a run costs is deliberately not among them, reversing an earlier decision that the README state it. The $5 cap and the recording bill are this project's constraints, not a reader's: someone running this brings their own key. `docs/recording-pass.md` owns those figures and the repository map points at it.

## Testing Decisions

**What makes a good test here.** A test drives the system at its entry point with a Question and asserts on what comes back. It never reaches inside an agent to check which prompt was assembled, never asserts on the shape of an intermediate message, and never counts calls. The one substitution permitted anywhere in the suite is the replay adapter at the `LLMClient` seam — confirmed as the single seam for this spec. Everything above that seam is exercised through its real wiring.

**Router.** Tested in two parts, matching its two stages.

The **Local Pass** is tested directly, with no seam and no network, because it is deterministic and local. A table of Questions mapped to expected verdicts covers `finance`, `hr`, `both`, and Abstention, including phrasings near the score floor and near the top-two margin so that both thresholds have their behaviour pinned. Score output is used to make boundary failures diagnosable, not asserted on as an implementation detail.

**Escalation** is tested through the entry point against Fixtures, like every other model call — it holds no privileged position just because it routes rather than answers. The cases that matter: an Abstention escalates and comes back with a usable Route; a Question Escalation also declines returns a clarification request; and the deciding stage is reported either way.

One negative assertion belongs here and is easy to omit: **a Question the Local Pass places must not escalate.** Assert it rather than assume it. Silent escalation on every Question passes every other test in the suite while quietly spending the budget on each run — it is the failure this design most needs a test for, precisely because nothing else would catch it.

**Scoped Tools.** Tested directly as the pure read-only functions they are.

**Isolation.** Tested structurally, in keeping with ADR 0004: assert the composition of each Specialist Agent's tool set — that the Finance Agent holds no tool capable of returning an individual salary, that the HR Agent holds no tool returning company financials, and that no tool instance is shared between the two. This is an assertion about wiring, which is the form the guarantee actually takes; there is no filter logic to test because there is none in the system.

**Specialist Agents.** Tested end-to-end through the entry point against Fixtures: a finance Question returns a finance answer grounded in finance tool results, an HR Question likewise, and an out-of-domain Question handed to an agent produces a refusal rather than an invented answer.

**Agent Meeting.** Tested end-to-end through the entry point with a `both` Question — asserting that a single joint recommendation comes back, that both domains are represented in it, and that it is attributable.

**Number Audit.** Tested directly as the pure function it is, including the case that matters most: an answer containing a figure absent from the tool results must fail the audit, and the failure must be visible on the output of a full run. Testing this through a Fixture alone would require a recording that happens to hallucinate, which is not something to wait for.

**Cost and hermeticity.** The whole suite runs in Replay Mode: no key, no network beyond the one-time local embedding-model download, no spend. No test may be made to pass by editing a Fixture.

**Prior art.** There is none — this is the first code in the repo, so this suite sets the prior art for everything added later. That is a reason to get the seam discipline right the first time, not a reason to invent conventions beyond what these tests need.

## Out of Scope

- Any UI. The deliverable is a command-line application; the assessment explicitly expects no UI.
- Any database or persistence. Datasets are hardcoded JSON.
- The other six department agents (Mila, Daniel, Maria, Sofia, and the two on the roadmap). Only the Finance Agent and the HR Agent are built.
- Layer 1 (Platform Brain) and Layer 3 (Employee AI) of the platform architecture. This spec builds a scoped version of Layer 2 plus the Agent Meeting.
- A second provider adapter. The `LLMClient` seam is the deliverable; an untested OpenAI adapter is not, per ADR 0003.
- Caching of Escalation verdicts. Repeating the same unplaceable Question escalates again. Worth doing if Escalation ever becomes common; noted as a next step, not built.
- Feeding Escalation verdicts back into the Exemplar Banks automatically. Tuning the Router stays a deliberate data edit by a maintainer.
- Queueing, caching, and rate-limit handling. These belong to written answer 3 and are not implemented.
- Authentication, authorisation, multi-tenancy, and anything else that would be production concerns. The assessment states no production code is expected.
- Streaming responses, conversation history across turns, and multi-turn follow-up.
- The three written assessment answers themselves. They are a parallel prose deliverable; the four ADRs are their raw material, and this spec's decisions should stay consistent with them.

## Further Notes

- **Vocabulary.** `CONTEXT.md` is authoritative. Code identifiers use Router, Route, Question, Specialist Agent, Finance Agent, HR Agent, Dataset, Scoped Tool, Exemplar Bank, Agent Meeting, Number Audit, Live Mode, Replay Mode, Fixture. Notably, "Noah" and "Eva" are theming for the README and prompts only and must not appear as code identifiers.
- **Budget.** A hard $5 cap on a personal account governs the whole project. Fixture recording is the only sanctioned spend; it should be done once, deliberately, for the full set of demo Questions, and re-done only when a prompt or tool schema changes.
- **First run.** The embedding model download is roughly 25MB and happens once. Say so in the README and in the console on first run, or it reads as a hang.
- **Vocabulary for the two stages is settled.** `CONTEXT.md` now defines Local Pass, Escalation, and Abstention, and lists the alternatives under `_Avoid_` — "embedding pass", "classifier", "fallback", "first/second stage" are all out, in code and in prose. The names describe the role rather than the mechanism, consistent with why the Router is not called a classifier.
- **Router vocabulary is a known cost, no longer a known failure.** An unanticipated phrasing used to degrade to `unclear`; now it escalates and gets routed. The limit did not disappear — it changed currency, from a wrong answer to a small bill. The README should say so plainly, including that thin Exemplar Banks show up as spend rather than as visible misroutes, which is the harder kind of problem to notice.
- **The zero-cost-ambiguity property is gone, deliberately.** An earlier version of this spec promised that vague input never spends. It does now. This was traded knowingly for routing that survives phrasings nobody anticipated; ADR 0005 carries the reasoning. Anyone reading the ADRs in order should find the reversal on the record rather than inferred from the code.
- **The demo Question set doubles as the Fixture set.** Choosing the Questions that will be recorded is a design decision, not an afterthought: they must cover all four Routes, at least one Question the Local Pass abstains on so Escalation is visible in the demo, at least one refusal, and the "should we hire more people?" Agent Meeting the assessment calls out by name.
