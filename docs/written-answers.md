# The three written answers

The assessment's three questions, answered for the platform as described — eight
department agents over one Supabase database, fifteen employees using personal
assistants. The repository is the small version built end-to-end: two agents
rather than eight, hardcoded Datasets rather than 228 tables. Where an answer
below names something that exists in the code, it is cited.

## 1 — Agent Isolation

A system prompt is not a security boundary. "You are Noah, you only see finance
tables" is a request to a model, and a request is the wrong mechanism for a
guarantee that has to hold on the run where the model is confused, jailbroken, or
simply wrong. So I would enforce isolation in three layers and treat only the
bottom one as load-bearing. The prompt shapes behaviour: it names the agent's
domain, names what it cannot see, and tells it to decline rather than speculate —
that last clause is what turns a misroute into a visible refusal instead of an
invented answer. The tool layer bounds capability: each agent is constructed with
its own array of Scoped Tools and there is no registry to look another agent's
tool up in, so an agent cannot request data it holds no tool for — in this repo
that is `src/agents/finance/tools.ts` and `src/agents/hr/tools.ts`, and
`src/agents/isolation.test.ts` asserts the two arrays share no tool instance and
no tool name. The database layer bounds authority: each agent's tools execute
under their own Postgres role with row-level security, so Noah's connection
cannot read HR tables even if the tool wiring is one day got wrong. That third
layer is the one I would not ship without, because the first two are code I wrote
and the whole point is to survive my own mistakes.

The alternative I rejected is one shared data layer with a caller identity and
per-request filtering. It is less code and it centralises the rules, but it makes
isolation a runtime property that depends on filter logic being correct on every
path — a class of bug that is invisible until it leaks. Structural isolation
costs duplication across eight agents and gives up cross-department joins by
design, which is the right trade here: cross-domain work goes through the Agent
Meeting (question 2) rather than through a wider query. Where a figure genuinely
must cross, the tool returns an aggregate shape and only that shape — the finance
payroll tool returns a company total and a headcount, never a row per person, so
there is no filtered version of it to get wrong.

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
