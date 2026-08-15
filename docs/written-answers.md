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

Fifteen employees at two to three requests a minute is forty-five a minute, and
that is not the number that hits the limit. This is Layer 3 traffic —
per-employee assistants drafting in one person's voice over their retrieved
history — and one request is an agent turn: several API calls, each carrying a
large context. The ceiling is per-organisation and meters requests, input tokens
and output tokens separately, so with meetings bursting N+1 calls on the same
key, the input-token limit binds first. Rate limits and cost are therefore one
problem, because tokens are the unit of both: one governor at the seam every call
already passes through (`src/llm/client.ts`) serves both, and the rest is
reducing what must pass through it.

1. **Meter what the limit meters.** One queue, a bucket per dimension. Output
   tokens are unknown before the call, so the queue reserves an estimate and
   reconciles against reported usage — counting requests alone leaves you under
   the request ceiling and throttled anyway. It paces on the remaining quota each
   response reports rather than waiting to be refused, and honours `retry-after`
   on a 429. Admission by priority: someone waiting on a reply outranks a meeting,
   which outranks a report. Work that cannot be served in time fails visibly, with
   its place in the queue — a queue whose failures are silent is how a rate limit
   becomes a support ticket about "the AI being slow".
2. **Keep non-interactive work off the interactive budget.** Nightly reports,
   competitor monitoring, and the backfill that learns an employee's style are not
   answers anyone is waiting for; they belong on the batch endpoint — half price,
   separate limits — so a report cannot contend with a person. And the cheapest
   call is the one not made: the Local Pass places a Question against the Exemplar
   Banks on the machine.
3. **Cache the prefix, scope the cache, size the model.** An assistant's system
   prompt, tool schemas, and one employee's style context are a large stable
   prefix reused on every draft they make; cached, it reads at about a tenth of
   input price and pays for itself on the second request. Shared department
   answers cache too, but the key must include the caller's read scope — text
   alone hands one department's answer to another and makes the cache the one path
   around the boundary in question 1 — plus a version stamp of the data, so an
   answer expires when the tables move rather than on a timer. Cheaper tokens are
   the same lever as fewer: placing a Question and combining contributions need no
   frontier model, and the spread across tiers is roughly fivefold.

All of it under a hard per-user and per-day spend cap with metering, because an
agent platform without a ceiling is one runaway loop from a memorable invoice.
