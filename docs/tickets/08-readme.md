# 08 — README as deliverable

**What to build:** The README is part of the deliverable, not packaging around it. A reviewer opens this repo to judge the thinking, and the README is where the thinking is legible.

It covers what the system does, how to run it in Replay Mode with no key, how to run Live Mode and what that costs, and the architecture with the reasoning behind it — drawn from the ADRs rather than restating them.

Two things must be named as limitations rather than left for a reviewer to discover as bugs:

- The Router's vocabulary is only as good as its Exemplar Banks. An unanticipated phrasing abstains at the Local Pass and escalates, which costs a call. That is the accepted trade, and it means a thin Exemplar Bank shows up as spend rather than as a visible misroute.
- Ambiguous Questions are no longer free. The Local Pass is deterministic and costs nothing; Escalation is neither. Say which behaviour is which.

Also: the roughly 25MB first-run model download, so it does not read as a hang. The growth path — adding a third Specialist Agent means adding a Dataset, a tool set, a prompt, and an Exemplar Bank. And the remaining next steps that were deliberately not built.

Themed names for the departments belong here and in prompts. They must not appear as code identifiers.

**Blocked by:** 07 — Demo Question set and the full Fixture set.

**Status:** done — delivered by 975aa89

- [x] States what the system does and shows a real Question and its output
- [x] Replay Mode run instructions work from a clean clone with no key
- [x] Live Mode run instructions state what it costs and that it needs a flag and a key
- [x] Explains the architecture and the reasoning: the two-stage Router, the isolation-by-Scoped-Tools guarantee, the `LLMClient` seam, the Number Audit, and the Agent Meeting
- [x] Explains why isolation is structural rather than a filter, and how a reader verifies it from the wiring
- [x] Names the Router's vocabulary limit as a limitation
- [x] Names that ambiguous Questions now cost an Escalation call, and which stage is deterministic
- [x] Explains the first-run model download and its approximate size before the reader hits it
- [x] Describes the growth path for adding a third Specialist Agent
- [x] Lists the remaining next steps that were deliberately not built
- [x] Uses the vocabulary from `CONTEXT.md`; themed department names appear only in prose and prompts, never as code identifiers

**On the first and second lines:** a README's prose can go stale silently, so the claims that can are pinned in `src/readme.test.ts` rather than left for a reviewer to find as lies. Both transcripts are run through the real entry point in Replay Mode and compared character-for-character; every `npm` command is checked against `package.json`, every path against the tree, and the download size against the constant that defines it. The Abstention rate and the French Question's score are asserted against the survey that produces them, because widening an Exemplar Bank is *meant* to move those — a README quoting the old ones would go quietly wrong at exactly the moment someone improved the Router.

**On the last line:** the half of that rule that binds the source tree — the themed names never being code identifiers — is asserted over all of `src` in `src/vocabulary.test.ts`, by shape rather than against a list of files. A test that had to be edited to add a third Specialist Agent would be a fifth thing this ticket's growth path doesn't mention.
