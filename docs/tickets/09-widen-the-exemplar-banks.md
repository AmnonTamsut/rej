# 09 — Widen the Exemplar Banks against unanticipated phrasings

**What to build:** Routing that survives the phrasings a real operator actually types, so that a Question the system can obviously answer is placed by the Local Pass rather than paid for at Escalation.

The gap is measured, not suspected. Asked with a role, "What does our head of engineering earn?" scores 0.768 against the hr Exemplar Bank and is placed for free. Asked with a name, "What does Priya Raman earn?" scores 0.347 — under the 0.4 score floor — and abstains. It is not misrouted; it escalates, gets the right Route, and quietly spends on every run. That is the failure mode ADR 0005 names as the uncomfortable half of the trade: a thin Exemplar Bank shows up as spend rather than as a visible misroute.

A name is not weak evidence for a domain, it is no evidence at all — the embedding model has never met Priya Raman, so replacing a role title with a name removes the signal the Local Pass was reading rather than weakening it. Named individuals are the clearest family, and the one to cover first, but they are not the only one: slang and typos, Questions in another language, indirect phrasings that never name their subject, and topics no Bank owns yet all land the same way. Decide which families this ticket covers and record the rest as known and deliberate rather than discovering them at the demo.

This is a data edit. The Local Pass has no rules and no keywords — it embeds the Question, embeds the Bank, and takes the best cosine similarity — so routing is tuned by adding phrasings to a Bank or by changing the two thresholds, never by editing Router logic.

Widening a Bank is not free of consequence. The thresholds are calibrated against measured scores, and the routing table holds Questions sitting deliberately close to both of them — one at a top-two gap of 0.015 that must stay `both`, one at 0.061 that must stay `hr`. Exemplars added carelessly drag neighbouring Questions across the top-two margin and collapse single-domain Questions into `both`. Moving a boundary is not the same as filling a gap, and the routing table is what tells the two apart.

**This must land before ticket 07.** The recording pass is the project's only sanctioned spend, and it records against whatever the Banks say at the time. Widening them afterwards changes which Questions abstain, which changes which Questions reach Escalation, which invalidates the recordings that pass captured — and re-recording is real money against a hard cap.

**Blocked by:** 06 — Agent Meeting for the `both` Route.

**Blocks:** 07 — Demo Question set and the full Fixture set. (The file number is append-only and does not reflect the working order.)

**Status:** done

- [x] A Question naming an individual rather than a role is placed as `hr` by the Local Pass instead of abstaining
- [x] Each newly covered phrasing enters the routing table as a row that fails before the Bank edit and passes after it
- [x] No Router logic changes: the only edits are Exemplar Bank data and, if re-calibrated, the two thresholds
- [x] Every Question already in the routing table keeps its verdict, including the two sitting nearest the top-two margin
- [x] Every score quoted in a threshold comment is re-measured and corrected, or removed rather than left stale
- [x] The added exemplars are a deliberate, reviewable set — each one a phrasing an operator would plausibly type, not bulk-generated filler
- [x] The phrasing families deliberately left uncovered are written down where the next person tuning the Banks will find them
- [x] The Abstention rate over the demo Question set is measured before and after, so the change is shown to reduce spend rather than assumed to

**What the Banks gained:** ten phrasings, all in `hr.json`, in two families. Eight cover a Question that names an individual — what someone earns, when they joined, which team they are on, their job title, whether they are a contractor. Two cover a pay Question that names nobody: "Who is the highest paid person here?" and "Who is the most expensive person on the payroll?". `finance.json` and `both.json` are untouched, and so are the two thresholds — the numbers in `thresholds.ts` changed only in their comments, which now quote re-measured scores.

**On the second family.** The named-individual family was the ticket's brief; the superlative one was found while measuring it and covered because its failure was worse. "Who is our most expensive person?" scored finance 0.535 against hr 0.301 and was placed `both` — a salary Question, which only the HR Agent can see a salary for, sent to a Route that convenes the Finance Agent to help answer it. An Abstention costs one small call; that costs an Agent Meeting and puts the wrong domain in the room. It is now hr at 0.738.

**On the eighth line:** the demo Question set does not exist yet — ticket 07 chooses it — so the rate is measured over the 25 Questions it will be drawn from, written down as `SURVEY_QUESTIONS` in `src/survey.ts` and runnable as `npm run survey`. Over that set the Abstention rate went from 36% (9 of 25) to 20% (5 of 25). The five that remain are the ones that should: office hours, the holiday policy, the printer, a Question in French, and the poem. A test pins that exact list, because an Abstention creeping back in is spend on every run rather than a visible misroute — the failure ADR 0005 calls the quiet one. When ticket 07 settles the demo set, the two should be brought into step.

The survey deliberately asks nothing in an Exemplar Bank's own words, and a second test enforces it: a Question copied from a Bank scores about 1.0 against itself and would flatter the rate into meaning nothing. That is why the survey says "Should we be hiring right now?" where the demo will say "Should we hire more people?".

**On the fourth line:** widening one Bank moved Questions the edit was not aimed at, which is the risk the line is guarding. "What are we paying the engineering team in total?" tightened from a top-two gap of 0.015 to 0.012 and "How many roles are we trying to fill?" loosened from 0.061 to 0.068 — both keep their verdicts, but the margins moved without being touched, so the whole routing table is the check after a Bank edit rather than the new rows.

**On the survey being larger than the data edit.** The Bank change is ten lines of JSON; the measurement around it is a command, a set of Questions, and three tests. That is deliberate: the eighth line asks for a rate measured before and after, and a number written down once is a number nobody can re-measure after the next Bank edit. The code review flagged the imbalance and it is accepted rather than trimmed — `npm run survey` is what makes the next widening's claim checkable too.

**What was left uncovered, and why:** written up in `docs/exemplar-bank-coverage.md` with a measured score against each. A terse Question built around a name ("When did Ben Carter start?", 0.336) stays under the floor because in five words the unknown name is most of the text — more exemplars moved it by hundredths, and the floor cannot come down to meet it without also placing "What time does the office open?" at 0.340. Reporting lines are hr but absent from the Dataset, so placing them buys nothing. Other languages score 0.169–0.193 against an English-only embedding model, which is the wrong model rather than a thin Bank. Slang and typos were measured and already work ("whats our headcont" places hr at 0.590), so nothing was added for them. Topics no Dataset owns are supposed to abstain, and adding exemplars for them would route them confidently to an agent that cannot answer them.
