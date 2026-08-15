# The recording pass: what the shipped Fixtures cost

Every recording in `fixtures/` came from one deliberate Live Mode run on
**14 August 2026**, as the `recordedAt` stamp in each file says. This is what
that run did and what it cost, so the provenance of every shipped Fixture can be
checked rather than taken on trust.

```
npm run record -- --demo
```

## What it cost

| | |
| --- | --- |
| Model calls | 16 |
| Fixtures written | 16 |
| Input tokens | 23,547 |
| Output tokens | 3,104 |
| Cost | **$0.1172** |

The figures are the record command's own, not an estimate: token counts come
back from the API on every call, are accumulated across the pass by
`src/llm/pricing.ts`, and are printed as the last line the command writes. The
cost is priced at Claude Sonnet 5's standard $3.00 / $15.00 per million, which is
an upper bound — the introductory rate of $2.00 / $10.00 applies through
31 August 2026, so the pass was billed at less than the figure above.

Re-running the command reports its own spend the same way. Add it to the tally
below rather than overwriting this one, so the provenance of the shipped
Fixtures stays readable as a history rather than a single figure.

| Pass | Date | Calls | Cost | Why |
| --- | --- | --- | --- | --- |
| 1 | 2026-08-14 | 13 | $0.0759 | First pass over the demo set. Discarded: two Questions recorded outcomes that showed nothing — the Finance Agent asked which quarter "last quarter" meant, and both agents offered to fetch figures in the meeting instead of fetching them. |
| 2 | 2026-08-14 | 16 | $0.1172 | The shipped set, after the demo's payroll Question named its quarter and meeting attendees were told their answers would be combined. |
| | | **29** | **$0.1931** | Total spent on the project to date. |

## What was recorded

One call per row is the Router's Escalation; the rest are the agents' turns —
each Scoped Tool call is a call, because the tool result goes back to the model.

| Question | Route | Calls |
| --- | --- | --- |
| How much cash is left in the bank? | finance | 2 |
| How much did we spend on payroll in Q3? | finance | 2 |
| What does Priya Raman earn? | hr | 2 |
| Should we hire more people? | both | 5 |
| When did Ben Carter start? | hr | 3 |
| Who won the customer of the year award? | hr | 1 |
| How do I fix the printer? | unclear | 1 |

The set is `DEMO_QUESTIONS` in `src/demo.ts`, which says what each Question is
there to show. Two rows are worth reading against that:

- **When did Ben Carter start?** costs three calls where the other hr Question
  costs two. The extra one is the Escalation: the Local Pass abstains on this
  phrasing, which is why the Question is in the set at all. That is the price of
  an Abstention, in one line of a bill.
- **Should we hire more people?** costs five: each agent reads its own tools and
  then answers, and the synthesis is a call with no tools at all.

## The meeting's recommendation fails its Number Audit

The recorded Agent Meeting produces a real recommendation from both domains — and
the Number Audit rejects it. The Finance Agent worked out a year-to-date
operating loss of $1,021,000 and a 62% payroll share of expenses, neither of
which any Scoped Tool returned; both are differences and ratios computed from
figures the tools returned separately. The audit names them, on the contribution
and again on the recommendation that repeated them.

It ships that way. The Finance Agent's system prompt already tells it not to
infer a figure a tool did not return, and this is a run where that instruction
was not honoured — which is the entire reason the Number Audit exists rather than
the prompt being trusted to hold. Re-recording until a clean sample came back
would demonstrate the prompt instead of the check, and would quietly turn the
demo into a curated set of runs that went well.

A test in `src/demo.test.ts` pins this, so a future re-recording that comes back
clean fails rather than silently disagreeing with what the demo says it shows.

## Why a re-recording might be needed

A Fixture is keyed by a digest of the whole request, so editing a system prompt,
a tool schema, or the meeting's contribution brief moves the key and the
recordings made against the old wording stop being served. Replay Mode then fails
loudly, naming the record command. Nothing falls through to the API and nothing
is invented — see `fixtures/README.md`.

Recording is the only sanctioned spend in the project. It needs
`ANTHROPIC_API_KEY` and refuses to run without one, and it is a separate command
from `npm run ask` rather than a flag on it, so that an ordinary run cannot drift
into spending money.
