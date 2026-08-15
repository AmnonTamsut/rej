# 07 — Demo Question set and the full Fixture set

**What to build:** The set of Questions the system demonstrates itself with, and one deliberate recording pass that captures Fixtures for all of them.

Choosing these Questions is a design decision, not an afterthought — they are what a reviewer sees first. The set must cover all four Routes, at least one Question the Local Pass abstains on so Escalation is visible in the demo, at least one out-of-domain refusal, and the "should we hire more people?" Agent Meeting the assessment calls out by name.

Recording is the only sanctioned spend in the project. Do it once, deliberately, for the full set — not question by question. Re-record only when a prompt or a tool schema changes, which the Fixture keying will force anyway.

After the pass, the entire suite and the entire demo must run from a clean clone in Replay Mode with no key, no spend, and no network beyond the one-time embedding model download.

The recorded-not-written rule needs to be stated where a contributor will actually hit it, not only in an ADR. A Fixture edited by hand to make a test pass destroys the thing the demo is claiming.

**Blocked by:** 06 — Agent Meeting for the `both` Route; 09 — Widen the Exemplar Banks (which must land first, or this pass records against Banks that are about to change).

**Note from 09:** `SURVEY_QUESTIONS` in `src/survey.ts` already holds 25 Questions written as the candidates this set would be drawn from, and `npm run survey` prices them — 5 of them abstain and would reach Escalation. It is not the demo set and does not decide it: the survey deliberately avoids phrasings copied from an Exemplar Bank, so it asks "Should we be hiring right now?" where the demo must say "Should we hire more people?" in the assessment's own words. Choose the demo set on its own terms, then bring the two into step so the Abstention rate keeps being measured over what the demo actually asks.

**Status:** done

- [x] The demo Question set is written down as the deliberate set it is, with each Question's purpose clear
- [x] The set covers `finance`, `hr`, `both`, and `unclear`
- [x] The set includes a Question the Local Pass abstains on, exercising Escalation
- [x] The set includes an out-of-domain Question producing a refusal
- [x] The set includes "should we hire more people?" driving a full Agent Meeting
- [x] Fixtures for the whole set are captured in one recording pass
- [x] The spend for the pass is measured and recorded
- [x] The full suite passes from a clean clone in Replay Mode with no key
- [x] The full demo runs from a clean clone with no key
- [x] The recorded-not-written rule is stated where a contributor changing Fixtures will encounter it

**The set is seven Questions** (`DEMO_QUESTIONS` in `src/demo.ts`), each carrying a `shows` line saying what it is in the set for, and `npm run demo` prints that line above the run so a reviewer reads the intent before the output. Every Route and stage in the set is declared as data and checked: the Local Pass half for free in `demo.test.ts`, the rest against the shipped Fixtures. Seven rather than twenty because each Question costs money to record, and a set nobody can afford to re-record is a set that rots.

**On the sixth line:** the shipped Fixtures are one pass, and the first pass is not the one that shipped. It recorded two Questions whose outcomes showed nothing — the Finance Agent asked which quarter "last quarter" meant (the Dataset holds Q1, Q2, Q3 and year to date, so it was right to ask), and in the meeting both agents offered to fetch figures rather than fetching them. Neither was a bad model response; both were the demo asking the wrong thing. The payroll Question now names its quarter, and `contributionBrief` in `meeting.ts` tells each attendee its answer will be combined with another's, so it reads its tools instead of offering to. Then one pass, from an empty `fixtures/`.

**On the seventh line:** the spend is measured rather than asserted. Token counts come back from the API on every call and leave the live adapter through a callback — a side channel, so no token count enters a Fixture or crosses the `LLMClient` seam — are priced in `src/llm/pricing.ts`, and are printed as the last line the record command writes. `docs/recording-pass.md` carries that output: $0.1172 for the shipped pass, $0.1931 across both passes.

**On the eighth and ninth lines:** both are checked as processes, not function calls. `offline.test.ts` runs `src/demo.ts` with the key stripped from the environment and every outbound connection pointed at a dead proxy, and asserts the demo's own closing line. That is the acceptance line for a clean clone, minus the clone.

**On the tenth line:** the rule is in three places now, and the new one is the file itself — `note` is the first field of every recording, so a contributor about to change a number reads it above the number. It sits outside the integrity seal deliberately: it says nothing about what the model returned, so deleting a comment should not be reported as tampering with an answer.

**From review:** the worst finding was one this work introduced and nearly shipped — `RECORD_COMMAND` is the text of every Fixture-miss error, and pointing it at `--demo` would have told a contributor who missed on their own ad-hoc Question to spend money recording seven other Questions and hit the same miss again. The miss now leads with the Question form and offers the demo pass second, with a test on the order. Two smaller ones taken: the unknown-flag guard duplicated between the two commands moved into `command.ts`, and `--demo` beside a named Question is now refused rather than silently recording the set and dropping the Question. Declined: renaming `shows` to `purpose` — the field holds a sentence completing "this Question shows …", which is what the heading prints.

**The recorded meeting fails its Number Audit, and ships that way.** The Finance Agent worked out a $1,021,000 operating loss and a 62% payroll share from figures its tools returned separately; no Scoped Tool returned either, and the audit named both. Its prompt already forbids that, which is the point — the audit exists because a prompt is a request. Re-recording until a clean sample came back would demonstrate the prompt rather than the check, and would make the demo a curated set of runs that went well. `demo.test.ts` pins the failure, so a later re-recording that comes back clean goes red instead of quietly disagreeing with what the demo says it shows.
