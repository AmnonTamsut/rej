# The three written answers


## 1 — Agent Isolation

A system prompt is not a security boundary. "You are Noah, you only see finance
tables" is a request to a model, and it fails on the run where the model is
confused or jailbroken. Three layers, only the last load-bearing.

1. **Prompt — what the agent should do.** Names its domain and tells it to
   decline rather than speculate, so a misroute surfaces as a refusal instead of
   an invented answer. Shapes behaviour; guarantees nothing.
2. **Tools — what the agent can do.** Each agent holds its own array of Scoped
   Tools and there is no registry to find another's, so it cannot request data it
   has no tool for. Figures that must cross exist only in aggregate shape, so
   there is no filtered version to get wrong. (`src/agents/finance/tools.ts`,
   `src/agents/hr/tools.ts`, `src/agents/isolation.test.ts`.)
3. **Database — what the agent may do.** Tools run under a per-agent Postgres
   role with row-level security. Not the shared filtering rejected below: my
   filter code fails open and silent, a role the database refuses fails closed
   and loud. The layer I would not ship without, because the two above it are
   code I wrote.

Routing stays outside the boundary and reads no Dataset: the Local Pass compares
the Question against Exemplar Banks as vectors on the machine, and Escalation
sends the LLM classifier the Question text alone. So a misroute is a wrong
answer, never a leak — the wrong agent still holds only its own tools, and
routing accuracy is never a security control.

Rejected: one shared data layer with a caller identity and per-request filtering.
Less code, but isolation then depends on that filter being right on every path —
a bug invisible until it leaks. Structural isolation instead costs duplication
across eight agents and cross-department joins, which go through the Agent
Meeting (question 2).

These layers bound reads. Conversation history, logs, and what one agent
publishes to another are the same boundary in another medium.

## 2 — The AI Agent Meeting

Eight agents in an open conversation fails three ways: cost is unbounded,
ordering is non-deterministic, and each agent must be shown the others' output,
which undoes question 1. Two phases instead.

1. **Gather — each attendee answers alone.** Every attendee answers the same
   Question through its own Scoped Tools and returns a contribution with the tool
   results that produced it attached. These run in parallel; no agent sees
   another's data.
2. **Synthesis — one call, holding no tools.** It receives the contributions and
   combines them into one recommendation, attributing each fact to the agent that
   supplied it.

That bounds a meeting at N+1 calls, keeps it reproducible, and means the only
thing crossing a department boundary is a sentence an agent chose to publish.
(`src/agents/meeting.ts`, for two attendees.)

Hallucinated numbers get the Number Audit rather than a better prompt, since
"only use figures from your tools" is again a request. Every figure in a
contribution must appear in that agent's tool results, and every figure in the
joint recommendation in the attendees' pooled results. A figure that does not is
named and the text marked unaudited — shown, not suppressed, because hiding an
agent's bad output teaches the operator nothing. The rule checks provenance, not
arithmetic, so a derived figure fails on purpose: with a dozen figures in
evidence there are hundreds of available ratios, and accepting derived
percentages would make them the one place an invented number passed. That costs
some correct answers, which I would rather pay than run a check with a known
hole. (`src/audit/number-audit.ts`, ADR 0006; the shipped demo includes a meeting
where this check fails, kept rather than re-recorded.)

## 3 — Scale, rate limits, and cost

Fifteen employees at two to three requests a minute is thirty to forty-five a
minute — small, but bursty, and the limits that bite are per-key and cover tokens
as well as requests. Every call already goes through one seam
(`src/llm/client.ts`), so all of the below is one implementation behind one
interface rather than fifteen call sites to remember.

1. **Queue and limit.** One shared queue with a token-bucket limiter configured
   from the account's real requests- and tokens-per-minute; admission by priority,
   so someone waiting on a chat reply goes ahead of an overnight report; backoff
   on 429 honouring `retry-after` rather than guessing. Work that cannot be served
   in time fails visibly, with its place in the queue — a queue whose failures are
   silent is how a rate limit becomes a support ticket about "the AI being slow".
2. **Don't call the model.** The largest saving. The Local Pass places a Question
   against the Exemplar Banks locally, removing one model call from every request
   and costing nothing per call after a one-time model download.
3. **Cache what is left.** Prompt caching on the stable prefix, since system
   prompt plus tool schemas is most of the tokens on a short question. A response
   cache keyed on the Question plus a version stamp of the underlying data, so an
   answer expires when the tables move rather than on a guessed timer. And routing
   verdicts, which this repo deliberately does not cache yet — the same
   unplaceable Question escalates every time, listed as a next step rather than
   pretended away.
4. **Right-size per step.** Placing a Question and combining contributions do not
   need the largest model, and picking per step against an eval is a bigger lever
   than tuning prompts by hand.

All of it under a hard per-user and per-day spend cap with metering, because an
agent platform without a ceiling is one runaway loop from a memorable invoice.
This project ran under a $5 cap; `docs/recording-pass.md` accounts for every cent.
