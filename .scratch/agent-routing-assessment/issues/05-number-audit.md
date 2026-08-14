# 05 — Number Audit on agent answers

**What to build:** The check that stops an invented figure reaching the operator. Every numeric figure appearing in an answer must also appear in the Scoped Tool results that answer was built from. A figure that does not is surfaced on the output — the operator learns the answer is unaudited and which figure was unaccounted for.

A failure is never swallowed and the answer is never shown as though it passed. This is the difference between an operator who can act on the numbers and one who cannot.

The audit is a pure function over an answer and the tool results behind it. It runs on each Specialist Agent's answer. Ticket 06 extends it to the contributions and synthesis inside an Agent Meeting.

Tolerances are a decision, not an accident. Currency formatting and thousands separators must not read as different numbers. Percentages derived from two already-audited figures need an explicit rule. Whatever rule is chosen, document it where someone changing the audit will find it.

Test this directly rather than waiting for a Fixture that happens to hallucinate: construct an answer containing a figure absent from the tool results, assert the audit fails, and assert the failure is visible on the output of a full run through the entry point.

**Blocked by:** 03 — Finance Agent answers money Questions end-to-end.

**Status:** ready-for-agent

- [ ] Every numeric figure in an answer is checked against the Scoped Tool results retained from that turn
- [ ] An answer whose figures all appear in the tool results passes
- [ ] An answer containing a figure absent from the tool results fails, and the failing figure is named
- [ ] A failed audit is surfaced on the output of a full run; the answer is never presented as audited
- [ ] Currency formatting and thousands separators do not cause false failures
- [ ] The rule for percentages derived from audited figures is chosen deliberately and documented
- [ ] The audit is a pure function, tested directly rather than only through a recorded run
- [ ] A full run through the entry point demonstrates a visible audit failure
