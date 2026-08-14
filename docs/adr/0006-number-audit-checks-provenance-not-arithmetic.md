# The Number Audit checks provenance, not arithmetic

Status: accepted

Every figure in an answer must appear in the Scoped Tool results that answer was built from. A figure that does not is reported to the operator by name, and the answer is marked unaudited rather than shown as though it passed.

The audit reads both sides with one rule — a figure is a run of digits, with thousands separators and currency symbols treated as formatting and compared by value — so the tolerances follow from the rule rather than accumulating as special cases. What it deliberately does not do is reconstruct the arithmetic behind an answer. A figure the agent computed is a figure no tool returned, and that is exactly what the audit is for.

The full rule, with the case-by-case reasoning, is documented in `src/audit/number-audit.ts`, where someone changing the audit will find it.

## Considered options

- **Accept a percentage that equals the ratio of two audited figures.** The obvious tolerance, and the one the spec calls out by name: "payroll was 62% of expenses" is derived entirely from grounded numbers, and reporting it is a false alarm. Rejected because of what it costs elsewhere: a dozen figures in evidence yield over a hundred ratios, so almost any percentage between 0 and 100 would find a pair to justify it. Percentages would become the one place an invented figure passed unchallenged, and a percentage is a perfectly good way to mislead an operator.
- **Accept figures within a rounding tolerance.** Rejected for the same reason and one more: both system prompts already instruct the agent never to round, rescale, or infer a figure. An audit looser than the instruction the agent was given leaves a gap between what the system asks for and what it enforces; this way there is one rule stated twice.
- **Suppress an answer that fails the audit.** Rejected. The operator needs to see what the agent claimed in order to judge how badly it went wrong, and a system that swallows its own bad output teaches nobody anything. The answer is shown, with the failure named above the fold.

## Consequences

- **An answer that states a derived percentage fails the audit.** This is a real cost, paid knowingly: some correct answers will be marked unaudited. It surfaces as a visible failure naming the figure, which is the failure mode we can live with — the opposite one is an invented figure passing quietly.
- **The audit's protection is uneven by size.** Dates are read in parts on both sides, so `2025-09-30` puts 2025, 9, and 30 into evidence and makes a small invented integer cheaper to account for than a large one. That is the right way round: the figures worth inventing are the money.
- **Numbers written as words are not audited.** "forty-eight people" contains no figure. Closing this would mean parsing English number phrases on both sides — more machinery than the thing it protects, and machinery that would itself need auditing.
- **The audit is pure and runs on every answer**, so it is tested directly on answers written by hand rather than on a recording that happens to hallucinate, and the Agent Meeting can hold each contribution and its synthesis to the same check by calling the same function.
