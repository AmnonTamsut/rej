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

Eight agents in an open conversation is the version that does not work: cost is
unbounded, ordering is non-deterministic, and each agent has to be shown the
others' output, which quietly undoes the isolation from question 1. I would run
it as two phases instead. In the gather phase every attendee answers the same
question independently through its own Scoped Tools and returns a contribution
with the tool results that produced it attached — these run in parallel, no agent
sees another's data, and the cost is exactly one turn per attendee. In the
synthesis phase a single call holding **no tools of its own** receives the
contributions and combines them into one recommendation that attributes each fact
to the agent that supplied it. That bounds a meeting at N+1 calls, keeps it
reproducible, and means the only thing crossing a department boundary is a
sentence an agent chose to publish. `src/agents/meeting.ts` is this, for two
attendees.

Hallucinated numbers get a mechanical check rather than a better prompt, because
a prompt saying "only use figures from your tools" is again a request. Every
figure appearing in a contribution must also appear in that agent's own tool
results; every figure in the joint recommendation must appear in the attendees'
pooled results. A figure that does not is named and the text is marked unaudited
— shown, not suppressed, because hiding an agent's bad output teaches the
operator nothing. The rule checks provenance rather than arithmetic, which means
a derived figure fails on purpose: "revenue is up 12%" computed from two grounded
numbers is rejected, because with a dozen figures in evidence there are hundreds
of available ratios, and accepting derived percentages would make them the one
place an invented number passed unchallenged. That costs some correct answers,
which I would rather pay than run a check with a known hole in it.
`src/audit/number-audit.ts` and ADR 0006 have the full rule; the shipped demo
includes a meeting where this check fails, kept rather than re-recorded.

## 3 — Scale, rate limits, and cost

Fifteen employees at two to three requests a minute is thirty to forty-five
requests a minute — small in absolute terms, but bursty, and the limits that bite
are per-key and cover tokens as well as requests. The first move is that every
call in the system already goes through one seam (`src/llm/client.ts`), so
queueing, retries and limiting are one implementation behind one interface rather
than fifteen call sites to remember. Behind it I would put a single shared queue
with a token-bucket limiter configured from the account's actual requests- and
tokens-per-minute, admission by priority so an employee waiting on a chat reply
goes ahead of an overnight report, and backoff on 429 that honours `retry-after`
rather than guessing. Work that cannot be served in time fails visibly to the
person waiting, with its place in the queue, instead of being dropped or retried
forever — a queue whose failures are silent is how a rate limit turns into a
support ticket about "the AI being slow".

The largest saving is not calling the model at all, which is why the Local Pass
scores a Question against Exemplar Banks locally rather than asking a model: it
removes one model call from every single request and costs nothing per call after
a one-time model download. On top of that, three caches. Prompt caching on the long stable prefix — system prompt
plus tool schemas is most of the tokens on a short question, and it barely
changes between calls. A response cache for repeated questions, keyed on the
question plus a version stamp of the underlying data, so an answer expires when
the tables move rather than on a timer someone has to guess. And caching routing
verdicts, which this repo deliberately does not do yet — the same unplaceable
question escalates every time, and it is listed as a next step rather than
pretended away. Finally, model choice per step: placing a Question and combining
contributions do not need the largest model, and picking per step against an eval
is a bigger lever than tuning prompts by hand. All of it under a hard
per-user and per-day spend cap with metering, because an agent platform without a
ceiling is one runaway loop away from a memorable invoice — this project ran under
a $5 cap and `docs/recording-pass.md` accounts for every cent of it.
