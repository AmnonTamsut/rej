# 04 — HR Agent answers people Questions end-to-end

**What to build:** The second Specialist Agent, on the runtime ticket 04 established. Ask a people Question in plain language and get an answer back through the same interface that serves money Questions — the operator does not need to know which agent owns the Question.

The HR Agent holds its own system prompt, its own hardcoded JSON Dataset, and its own Scoped Tools covering headcount, vacancies, attrition, and individual salaries. It has no access to company financials, and no tool it holds reads across the boundary. There is no shared data layer, no caller identity, and no per-request filtering anywhere in the system.

Its system prompt names its domain and its limits the same way the Finance Agent's does, and it declines out-of-domain Questions rather than guessing at data it cannot see.

This ticket closes the isolation guarantee. Ticket 03 asserted the Finance half at the point the Finance Agent was built; here the HR half is asserted, plus the one assertion that needs both agents in existence — that no tool instance is shared between them.

Reuse the agent runtime from ticket 03. If it does not fit the HR Agent cleanly, change it there rather than writing a second loop.

**Blocked by:** 03 — Finance Agent answers money Questions end-to-end.

**Status:** ready-for-agent

- [ ] A people Question asked at the entry point routes `hr` and returns an answer grounded in HR Scoped Tool results
- [ ] Money and people Questions are asked through the same entry point with no agent selection by the operator
- [ ] The HR Agent is handed only its own tool schemas
- [ ] Scoped Tools are read-only and tested directly as pure functions
- [ ] A structural test asserts the HR Agent holds no tool returning company financials
- [ ] A structural test asserts no tool instance is shared between the Finance Agent and the HR Agent
- [ ] There is no shared Dataset, no shared data layer, and no tool that reads across the domain boundary
- [ ] The system prompt states the agent's domain and what it cannot see
- [ ] A Question outside the people domain produces a stated refusal
- [ ] The agent runtime from ticket 03 is reused, not duplicated
- [ ] The end-to-end path is tested through the entry point against Fixtures, with no key and no spend
