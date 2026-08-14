# 09 — Widen the Exemplar Banks against unanticipated phrasings

**What to build:** Routing that survives the phrasings a real operator actually types, so that a Question the system can obviously answer is placed by the Local Pass rather than paid for at Escalation.

The gap is measured, not suspected. Asked with a role, "What does our head of engineering earn?" scores 0.768 against the hr Exemplar Bank and is placed for free. Asked with a name, "What does Priya Raman earn?" scores 0.347 — under the 0.4 score floor — and abstains. It is not misrouted; it escalates, gets the right Route, and quietly spends on every run. That is the failure mode ADR 0005 names as the uncomfortable half of the trade: a thin Exemplar Bank shows up as spend rather than as a visible misroute.

A name is not weak evidence for a domain, it is no evidence at all — the embedding model has never met Priya Raman, so replacing a role title with a name removes the signal the Local Pass was reading rather than weakening it. Named individuals are the clearest family, and the one to cover first, but they are not the only one: slang and typos, Questions in another language, indirect phrasings that never name their subject, and topics no Bank owns yet all land the same way. Decide which families this ticket covers and record the rest as known and deliberate rather than discovering them at the demo.

This is a data edit. The Local Pass has no rules and no keywords — it embeds the Question, embeds the Bank, and takes the best cosine similarity — so routing is tuned by adding phrasings to a Bank or by changing the two thresholds, never by editing Router logic.

Widening a Bank is not free of consequence. The thresholds are calibrated against measured scores, and the routing table holds Questions sitting deliberately close to both of them — one at a top-two gap of 0.015 that must stay `both`, one at 0.061 that must stay `hr`. Exemplars added carelessly drag neighbouring Questions across the top-two margin and collapse single-domain Questions into `both`. Moving a boundary is not the same as filling a gap, and the routing table is what tells the two apart.

**This must land before ticket 07.** The recording pass is the project's only sanctioned spend, and it records against whatever the Banks say at the time. Widening them afterwards changes which Questions abstain, which changes which Questions reach Escalation, which invalidates the recordings that pass captured — and re-recording is real money against a hard cap.

**Blocked by:** 06 — Agent Meeting for the `both` Route.

**Blocks:** 07 — Demo Question set and the full Fixture set. (The file number is append-only and does not reflect the working order.)

**Status:** ready-for-agent

- [ ] A Question naming an individual rather than a role is placed as `hr` by the Local Pass instead of abstaining
- [ ] Each newly covered phrasing enters the routing table as a row that fails before the Bank edit and passes after it
- [ ] No Router logic changes: the only edits are Exemplar Bank data and, if re-calibrated, the two thresholds
- [ ] Every Question already in the routing table keeps its verdict, including the two sitting nearest the top-two margin
- [ ] Every score quoted in a threshold comment is re-measured and corrected, or removed rather than left stale
- [ ] The added exemplars are a deliberate, reviewable set — each one a phrasing an operator would plausibly type, not bulk-generated filler
- [ ] The phrasing families deliberately left uncovered are written down where the next person tuning the Banks will find them
- [ ] The Abstention rate over the demo Question set is measured before and after, so the change is shown to reduce spend rather than assumed to
