# Two Specialist Agents behind a deterministic Router

Business Questions arrive in one inbox and belong to two domains that must not
mix. "What did we spend on payroll?" is a money Question; "what does Priya
Raman earn?" is a people Question; and whoever can answer the first must not be
able to answer the second. One agent with access to everything would answer both
and quietly destroy that boundary. Two agents with a human deciding which one to
ask is not a system.

This is the system: a Question goes to the **Router**, which places it as
`finance`, `hr`, `both`, or `unclear` without answering it. A `finance` Question
goes to the **Finance Agent**, which can read the finance **Dataset** and nothing
else. An `hr` Question goes to the **HR Agent** on the same terms. A `both`
Question opens an **Agent Meeting**, where each **Specialist Agent** examines it
through its own **Scoped Tools** and the two contributions are combined into one
joint recommendation. An `unclear` Question comes back as a request to rephrase.
Every figure in every answer is checked by the **Number Audit** against the tool
results it was built from.

It runs with no API key and no spend, because **Replay Mode** is the default and
serves **Fixtures** recorded from real **Live Mode** calls.

```
Question: How much cash is left in the bank?

Route:    finance   (Local Pass)
Agent:    Finance Agent

As of September 30, 2025, Cherry Host has **$1,248,000** in the bank. With a monthly net burn of $96,000, that gives a runway of approximately **13 months** at the current rate.

Number Audit: passed — every figure in the answer above appears in a Scoped Tool result.

Similarity scores by Exemplar Bank:
  finance 0.863
  both    0.384
  hr      0.310
```

## Running it, with no key and no spend

```bash
npm install
npm run demo
```

**The first run downloads about 25MB.** The Router places most Questions with a
local embedding model (`Xenova/all-MiniLM-L6-v2`, quantized), which is fetched
once into `.model-cache/` and reused from disk afterwards. It takes a few
seconds on a normal connection, it is announced on stderr while it happens, and
it is the only network access any default run makes. Later runs start
immediately and need no network at all.

`npm run demo` runs the seven demo Questions through the same entry point you
would use yourself. Between them they cover all four Routes, both Router stages,
an out-of-domain refusal, an Agent Meeting, and a Number Audit failure —
`src/demo.ts` says what each Question is there to show.

Ask one Question at a time with:

```bash
npm run ask -- "What does Priya Raman earn?"
```

In Replay Mode the Questions that can be answered are the recorded ones, which
is the demo set. Anything else stops with a Fixture miss naming the record
command — see [Replay Mode and Fixtures](#replay-mode-and-fixtures) for why that
is a loud error rather than a quiet call to the API.

The tests run on the same path, so the whole suite is free and offline too:

```bash
npm test
npm run typecheck
```

## Live Mode, and what it costs

Live Mode takes two things — the `--live` flag and an `ANTHROPIC_API_KEY` in the
environment. Neither half alone gets there, which is what stops a test run or a
casual invocation from spending:

```bash
ANTHROPIC_API_KEY=sk-... npm run ask -- --live "How much cash is left in the bank?"
```

Asking with the flag and no key stops the run and says so. A key sitting in the
environment of someone who did not pass the flag arms nothing; the run says that
too, on stderr, rather than failing.

The whole project runs under a hard **$5** budget cap on a personal account. One
Question in Live Mode is between one and five model calls — one per round of
Scoped Tool results fed back, plus the answer, plus an Escalation if the Local
Pass abstained, and only one in total if Escalation ends at `unclear`. The
recorded demo set, all seven Questions, was 16 calls and cost **$0.1172**, about
2.3% of the cap. `docs/recording-pass.md` carries the full bill, including the
first pass that was discarded.

Recording is the only sanctioned spend, and it is a separate command rather than
a flag on `npm run ask`, so an ordinary run cannot drift into it:

```bash
ANTHROPIC_API_KEY=sk-... npm run record -- --demo
```

## The architecture, and why

### The Router, in two stages

The Router maps a Question to a Route without answering it. Routing is a
classification over four labels, and the obvious move — asking a model — costs a
round-trip on every Question and gives a non-deterministic answer to a decision
that has to be testable. So the **Local Pass** runs first: it embeds the Question
locally and scores it by maximum cosine similarity against three **Exemplar
Banks** (`finance`, `hr`, `both`). Two named thresholds in
`src/router/thresholds.ts` carry the hard cases — a score floor, below which the
Local Pass abstains, and a top-two margin, below which the Question is
cross-cutting and the Route is `both`.

A Question the Local Pass cannot place is not refused. The **Abstention**
triggers **Escalation**: one model call, no tools, no message history, returning
one of the same three Routes or `unclear`. Escalation is always on — there is no
flag that disables it and no pure-local mode, because two routing behaviours
drift apart and a reviewer would see the good one only by knowing to ask for it.

The ordering is the whole design. The common case stays free and deterministic,
and both spend and non-determinism are confined to exactly the Questions a purely
local Router would have failed outright. Which stage decided is reported on every
run, so a free verdict is distinguishable from a paid one, and the per-bank
scores are printed with it so a surprising verdict shows its working.

Two words that are easy to conflate and are kept apart deliberately: an
**Abstention** is the Local Pass declining, and it never reaches the operator;
`unclear` is a Route, and only Escalation can return it. `LocalRoute` in
`src/domain/route.ts` makes confusing them a type error.

Routing is tuned by editing data — a phrasing in `src/router/exemplar-banks/`,
or a threshold — never by editing Router logic. `docs/exemplar-bank-coverage.md`
records what the Banks cover, what they deliberately do not, and what each of
those decisions was measured to cost. ADR 0002 and ADR 0005 carry the reasoning.

### Isolation by Scoped Tools, not by filtering

Each Specialist Agent owns a Dataset and is handed only its own Scoped Tools.
There is no shared data layer, no shared Dataset, and no tool that reads across
the boundary. The Finance Agent cannot reach an individual salary because the HR
Agent holds the tool that exposes one and the Finance Agent does not; the Finance
Agent's payroll tool returns a company-wide total and the number of people it
covers, because that is the only shape it can return.

The alternative — one data layer with a caller identity and per-request filtering
— was rejected because it makes isolation a runtime property enforced by correct
filter logic, which can be got wrong and must be tested for. Here isolation is
structural: an agent cannot request data it has no tool for.

**How to verify it by reading.** The claim is about wiring, so it is checkable in
four places and takes about two minutes:

1. `src/agents/finance/tools.ts` and `src/agents/hr/tools.ts` each end with the
   agent's whole tool set as a literal array. What an agent can read is what is
   in that array.
2. `src/agents/specialist-agent.ts` hands the model `agent.tools` and executes
   from the same list. There is no registry to look a tool up in, so an agent
   asking for a tool it does not hold is told what it actually has.
3. Each agent's Dataset is imported by its own tools and by nothing else, and
   both are deep-frozen (`src/agents/deep-freeze.ts`).
4. The Agent Meeting (`src/agents/meeting.ts`) calls the same `askAgent` loop
   with the same tool sets. Nothing widens during a meeting.

The tests assert the same shape rather than a filter's behaviour, because there
is no filter: `src/agents/isolation.test.ts` asserts the two agents share no tool
instance and no tool name, and each agent's own `isolation.test.ts` asserts what
its tools cannot be made to return. ADR 0004 has the decision.

### The `LLMClient` seam

Every model call in the system — from a Specialist Agent, from Escalation, from
the meeting's synthesis — goes through one small interface in
`src/llm/client.ts`. Two implementations sit behind it: a live adapter over
`@anthropic-ai/sdk` targeting `claude-sonnet-5`, and a replay adapter serving
Fixtures. Nothing above the seam knows which it is holding.

The seam exists because Replay Mode is what plugs into it, so
provider-independence comes free rather than being built for its own sake. No
second provider adapter ships: an OpenAI adapter nobody runs would be untested
code defending against a requirement that does not exist. Swapping providers
means writing one file against a documented interface. ADR 0003.

It is also the single substitution permitted anywhere in the test suite.
Everything above it is exercised through its real wiring.

### Replay Mode and Fixtures

A Fixture is keyed by a deterministic digest of the entire request — model,
system prompt, message history, and tool schemas. Editing a prompt or a tool
schema therefore moves the key, and the recording made against the old wording
stops being served.

A miss is a hard error naming the missing key and the record command. Replay Mode
never falls through to the live API and never invents an answer, because those
are the two ways a replay layer stops being evidence of anything. Each recording
also carries an integrity digest over its own request and response, so a Fixture
nudged by hand until a test goes green fails loudly instead of passing quietly —
Fixtures are recorded, never written. `fixtures/README.md` and ADR 0001 carry the
rule.

### The Number Audit

An agent that writes prose about numbers will eventually state a figure that came
from nowhere, and in a finance answer that is not a cosmetic flaw. So every
figure in an answer must appear in the Scoped Tool results that answer was built
from. A figure that does not is named, and the answer is marked unaudited rather
than shown as though it passed.

The audit checks provenance, not arithmetic. A figure the agent computed is a
figure no tool returned — that is precisely what it is for. Currency symbols and
thousands separators are formatting; dates are whole values rather than three
small numbers; a quarter label is a name rather than the number in it. A
percentage passes only if a tool returned it, which means some correct answers —
"payroll was 62% of expenses", derived from two grounded figures — are marked
unaudited. That cost is paid knowingly: with a dozen figures in evidence there
are over a hundred ratios, so accepting derived percentages would make them the
one place an invented figure passed unchallenged.

The demo shows this failing, on purpose. The recorded Agent Meeting states a
year-to-date operating loss and a payroll percentage that no Scoped Tool
returned, and the audit names both. Re-recording until a clean sample came back
would demonstrate the prompt instead of the check. ADR 0006 and
`src/audit/number-audit.ts` carry the full rule.

### The Agent Meeting

`both` is the Route for a Question neither Dataset answers alone — "should we
hire more people?" is a headcount Question and a cash Question at once. Each
attendee examines it through its own Scoped Tools and produces a contribution;
the contributions are then combined, by a call that holds no tools of its own,
into one joint recommendation that says which agent supplied which fact.

The agents share nothing during a meeting. Cross-cutting work is done by
combining two scoped views, which is exactly why this flow exists rather than one
agent reaching wider. Each contribution is audited against its own agent's tool
results; only the recommendation is audited against both agents' results pooled,
because the recommendation is where the two domains are legitimately combined.

The contributions are audited and named but not printed: the meeting exists to
produce a decision rather than a transcript, and a contribution that failed its
own audit is still reported.

## What a run tells you

Every run reports the Route, the stage that decided it, who answered, the answer,
the Number Audit's verdict, and the per-bank similarity scores. Here is a
Question the Exemplar Banks do not cover, rescued by Escalation:

```
Question: When did Ben Carter start?

Route:    hr        (Escalation)
Agent:    HR Agent

Ben Carter, a Junior Engineer on the Engineering team, started on **February 3, 2025** (per records as of September 30, 2025).

Number Audit: passed — every figure in the answer above appears in a Scoped Tool result.

Similarity scores by Exemplar Bank:
  hr      0.336
  finance 0.217
  both    0.170

The Local Pass abstained — nothing cleared the 0.4 score floor —
so this Question went to Escalation, which is the only routing step that spends.
```

Five words, most of them a name the embedding model has never met, so there is
little sentence frame left to match on: 0.336 against the hr Bank, under the 0.4
floor. One small call places it and the HR Agent answers it anyway.

## Limitations

Two of these are properties a reviewer would otherwise meet as bugs, so they are
named here rather than left to be discovered.

**The Router's vocabulary is only as good as its Exemplar Banks.** An
unanticipated phrasing does not misroute — it abstains at the Local Pass and
escalates, which costs one model call and usually produces the right Route. That
is the accepted trade, and the uncomfortable half of it is this: a thin Exemplar
Bank now shows up as **spend rather than as a visible misroute**. The failure
mode got quieter, not smaller. A run that escalates often is a signal to go and
widen a Bank, and `npm run survey` measures the Abstention rate over a realistic
day's Questions so that signal is a number rather than a hunch — it currently
sits at 21%, and it is not meant to reach zero, because a Question no Dataset
answers is supposed to escalate.

**Ambiguous Questions are no longer free.** An earlier design promised that vague
input costs nothing; that promise was withdrawn deliberately, and ADR 0005
records the reversal. Which stage is which:

- The **Local Pass** is deterministic and costs nothing. It runs locally, places
  the same Question the same way every time, and is asserted directly in the
  tests with no fake.
- **Escalation** is neither. It is one model call — no tools, no history — and it
  is the only routing step in the system that spends. It is exercised through
  Fixtures like every other model call, so the suite stays hermetic despite it.

An Escalation verdict is not cached, so asking the same unplaceable Question
twice escalates twice.

Beyond those two:

- **The embedding model is English-only.** A French Question scores 0.193 against
  its best Bank — that is the wrong model, not a thin Bank, and covering it means
  translated Banks and a multilingual model.
- **A misroute degrades rather than lying.** "Who won the customer of the year
  award?" lands on the HR Agent, which holds no tool that answers it and says so.
  That is the designed failure, but it is still a wasted turn.
- **A Number Audit failure does not suppress the answer.** The operator sees what
  the agent claimed, with the failure named above it, because a system that
  swallows its own bad output teaches nobody anything.
- **Datasets are hardcoded JSON** and the answers are only as current as they
  are. There is no database, by design.

## Adding a third Specialist Agent

The growth path is four pieces of data and one line of wiring. Nothing about it
requires touching the agent runtime, the Router logic, or the seam — the HR Agent
arrived as exactly this and no more:

1. A **Dataset**: hardcoded JSON plus a typed reader, like
   `src/agents/hr/dataset.ts`, deep-frozen so a tool result cannot be edited on
   its way to the Number Audit.
2. A set of **Scoped Tools**: read-only functions over that Dataset alone,
   exported as one array, like `src/agents/hr/tools.ts`. The array is the
   isolation guarantee in its literal form.
3. A system **prompt** that names the agent's domain, names what it cannot see,
   and tells it to decline rather than speculate. The third part is the one that
   is easy to leave out and the one that turns a misroute into a visible refusal.
4. An **Exemplar Bank** of phrasings for the new Route, in
   `src/router/exemplar-banks/`, with rows added to the routing table in
   `src/router/local-pass.test.ts` first.

Then one line in the `AGENT_FOR` table in `src/ask.ts`, and a recording pass for
the new Questions.

One thing a third agent would force open first: `both` names a pair, and with
three domains it no longer does. The Route vocabulary would need revisiting
before the meeting's attendee list did.

## Next steps, deliberately not built

- **Caching Escalation verdicts.** The same unplaceable Question escalates every
  time it is asked. Worth doing if Escalation ever becomes common; today the
  cheaper fix is widening a Bank.
- **Feeding Escalation verdicts back into the Exemplar Banks.** Tempting and
  automatic, and it would let routing drift without anyone deciding to. Tuning
  stays a deliberate data edit.
- **A second provider adapter.** The seam is the deliverable; an untested adapter
  is not.
- **Queueing, retries, and rate-limit handling.** A real deployment needs all
  three around the `LLMClient`, and the seam is where they would go.
- **Multi-turn conversation.** Each Question is answered on its own; there is no
  history and no follow-up.
- **Multilingual routing**, which means a different embedding model and
  translated Banks, not more exemplars.
- **The other department agents**, and the platform layers above and below this
  one. Only the Finance Agent and the HR Agent are built here.
- **Persistence, authentication, and multi-tenancy.** No production concerns are
  addressed; none were asked for.

## Repository map

| Path | What is in it |
| --- | --- |
| `src/cli.ts` | The entry point: a Question in, a Route and an answer out. |
| `src/ask.ts` | The whole system in one function, and the table mapping Routes to agents. |
| `src/router/` | The Local Pass, Escalation, the thresholds, and the Exemplar Banks. |
| `src/agents/` | The agent runtime, the two Specialist Agents, their Datasets and Scoped Tools. |
| `src/audit/number-audit.ts` | The Number Audit, and the full statement of its rule. |
| `src/llm/` | The `LLMClient` seam, the live adapter, Fixtures, mode selection, pricing. |
| `src/demo.ts` | The demo Question set, and what each Question is there to show. |
| `src/survey.ts` | The Abstention survey: what routing a realistic day would cost. |
| `docs/adr/` | The six decisions, with the options rejected and why. |
| `docs/exemplar-bank-coverage.md` | What the Banks cover, what they do not, and what that was measured to cost. |
| `docs/recording-pass.md` | What the shipped Fixtures cost, to four decimal places. |
| `fixtures/` | The recordings Replay Mode serves. |

## Commands

| Command | What it does |
| --- | --- |
| `npm run demo` | Runs the demo Question set. Replay Mode: no key, no spend. |
| `npm run ask -- "<Question>"` | Answers one Question. Add `--live` to call the API. |
| `npm run survey` | Reports the Abstention rate — the routing bill — with no calls. |
| `npm run record -- --demo` | Live Mode. Re-records the Fixture set. Spends money. |
| `npm test` | The whole suite, on the replay path. |
| `npm run typecheck` | `tsc --noEmit`. |

---

The departments are themed after the platform's own: the Finance Agent is Noah,
the HR Agent is Eva. The names live in prompts and in prose like this one, and
never in a code identifier — `CONTEXT.md` is the authority on that and on the
rest of the vocabulary this README uses.
