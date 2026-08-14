# 03 — Finance Agent answers money Questions end-to-end

**What to build:** The first Specialist Agent, and with it the tool-calling runtime both agents will use. Ask a money Question in plain language and get an answer back, with the Route and the answering agent reported alongside it.

The Finance Agent holds a unique system prompt, its own hardcoded JSON Dataset, and its own Scoped Tools — read-only functions over that Dataset and nothing else. Its tools cover revenue, expenses, and cash position, plus a payroll tool that returns aggregates only. That aggregate-only shape is the isolation guarantee itself, not a filter applied to a richer result: the tool has no other shape it could return.

The agent runs a tool-calling loop against the `LLMClient`. It is handed only its own tool schemas, the model requests a tool, the Scoped Tool executes against the Finance Dataset, and the result feeds back until the model produces an answer. The tool results accumulated during the turn are retained on the result — they are the evidence the Number Audit will check against in ticket 05.

The system prompt names the agent's domain, names what it cannot see, and instructs it to decline rather than speculate when a Question falls outside its Scoped Tools. An out-of-domain Question handed to this agent produces a stated refusal, not an invented answer.

Isolation is asserted here rather than deferred: the Finance Agent's tool set is checked at the point it is created.

This ticket designs the agent runtime once. Ticket 04 reuses it rather than reinventing it.

**Blocked by:** 02 — LLMClient seam, Fixtures, and Escalation.

**Status:** ready-for-agent

- [ ] A money Question asked at the entry point routes `finance` and returns an answer grounded in Finance Scoped Tool results
- [ ] The output names the Route and the answering agent alongside the answer
- [ ] The Finance Agent is handed only its own tool schemas; no other agent's tools are reachable from it
- [ ] Scoped Tools are read-only; no Question can mutate the Dataset
- [ ] The payroll tool returns aggregates only, by construction — there is no code path by which it could return a per-person figure
- [ ] A structural test asserts the Finance Agent holds no tool capable of returning an individual's salary
- [ ] Tool results from the turn are retained on the result for later auditing
- [ ] The system prompt states the agent's domain and what it cannot see
- [ ] A Question outside the finance domain produces a stated refusal rather than a speculative answer
- [ ] Scoped Tools are tested directly as the pure functions they are
- [ ] The end-to-end path is tested through the entry point against Fixtures, with no key and no spend
- [ ] No test reaches inside the agent to assert on assembled prompts, intermediate message shapes, or call counts
