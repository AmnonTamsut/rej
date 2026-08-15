# 07 — Demo Question set and the full Fixture set

**What to build:** The set of Questions the system demonstrates itself with, and one deliberate recording pass that captures Fixtures for all of them.

Choosing these Questions is a design decision, not an afterthought — they are what a reviewer sees first. The set must cover all four Routes, at least one Question the Local Pass abstains on so Escalation is visible in the demo, at least one out-of-domain refusal, and the "should we hire more people?" Agent Meeting the assessment calls out by name.

Recording is the only sanctioned spend in the project and the whole thing runs under a hard budget cap. Do it once, deliberately, for the full set — not question by question. Re-record only when a prompt or a tool schema changes, which the Fixture keying will force anyway.

After the pass, the entire suite and the entire demo must run from a clean clone in Replay Mode with no key, no spend, and no network beyond the one-time embedding model download.

The recorded-not-written rule needs to be stated where a contributor will actually hit it, not only in an ADR. A Fixture edited by hand to make a test pass destroys the thing the demo is claiming.

**Blocked by:** 06 — Agent Meeting for the `both` Route; 09 — Widen the Exemplar Banks against unanticipated phrasings. (Recording before 09 lands captures Fixtures the Bank edit would invalidate, and re-recording is real money against a hard cap.)

**Status:** ready-for-agent

- [ ] The demo Question set is written down as the deliberate set it is, with each Question's purpose clear
- [ ] The set covers `finance`, `hr`, `both`, and `unclear`
- [ ] The set includes a Question the Local Pass abstains on, exercising Escalation
- [ ] The set includes an out-of-domain Question producing a refusal
- [ ] The set includes "should we hire more people?" driving a full Agent Meeting
- [ ] Fixtures for the whole set are captured in one recording pass
- [ ] The spend for the pass is recorded, and it lands inside the project budget cap
- [ ] The full suite passes from a clean clone in Replay Mode with no key
- [ ] The full demo runs from a clean clone with no key
- [ ] The recorded-not-written rule is stated where a contributor changing Fixtures will encounter it
