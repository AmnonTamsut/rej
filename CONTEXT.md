# Agent Routing Assessment

Glossary for the REJ/Cherry Host AI-engineer assessment project: two specialist AI agents behind a two-stage router, with a joint-meeting bonus flow.

## Language

### Agents and data

**Specialist Agent**:
An AI agent that answers questions for exactly one business domain, using only its own Scoped Tools. The system has two: the Finance Agent and the HR Agent.
_Avoid_: bot, assistant, expert

**Finance Agent**:
The Specialist Agent for money questions — revenue, expenses, cash, payroll cost. Themed after Noah, the platform's Finance & Billing department.
_Avoid_: Noah (as a code identifier), finance bot

**HR Agent**:
The Specialist Agent for people questions — headcount, salaries, vacancies, attrition. Themed after Eva, the platform's HR department.
_Avoid_: Eva (as a code identifier), people bot

**Dataset**:
The hardcoded mock JSON owned by exactly one Specialist Agent. There are two Datasets and no shared one.
_Avoid_: database, DB

**Scoped Tool**:
A read-only function exposed to exactly one Specialist Agent over that agent's Dataset — the only path by which any agent reads data.
_Avoid_: helper, endpoint

### Routing

**Question**:
The raw user input handed to the Router.
_Avoid_: query, prompt (overloaded with LLM prompts)

**Route**:
The Router's verdict on a Question: `finance`, `hr`, `both`, or `unclear`.
_Avoid_: intent, category

**Router**:
The component that maps a Question to a Route without answering it. It has two stages: the Local Pass and Escalation.
_Avoid_: dispatcher, classifier (names a mechanism, not the role)

**Local Pass**:
The Router's first stage, which places a Question against the Exemplar Banks without leaving the machine or spending anything. It either produces a Route or abstains.
_Avoid_: embedding pass, first stage, local stage, fast path

**Escalation**:
The Router's second stage, which places a Question the Local Pass abstained on. It is the only routing step that spends.
_Avoid_: classifier, LLM fallback, second stage, slow path

**Abstention**:
The Local Pass declining to place a Question. It is not a Route — it never reaches the operator, and its only consequence is to trigger Escalation.
_Avoid_: unclear (that is a Route, reachable only through Escalation)

**Exemplar Bank**:
A labeled set of example Questions that defines one Route for the Local Pass; there are three (finance, hr, both).
_Avoid_: training set, corpus

### Collaboration

**Agent Meeting**:
The flow in which both Specialist Agents examine one cross-cutting Question and produce a single joint recommendation. It is the flow the `both` Route is reserved for.
_Avoid_: discussion, debate, conference

**Number Audit**:
The check that every figure appearing in an agent's answer also appears in a Scoped Tool result — the system's defence against invented numbers.
_Avoid_: validation, fact-check

### Running the system

**Live Mode**:
A run in which the system calls the Claude API — from a Specialist Agent or from Escalation — requiring a key and spending real budget.
_Avoid_: production mode, online

**Replay Mode**:
The default run mode, in which every API response is served from Fixtures instead of the API, so the system runs with no key and no spend.
_Avoid_: mock mode, offline mode, cassette mode

**Fixture**:
A stored API response captured from an earlier Live Mode run, used to serve Replay Mode.
_Avoid_: mock, stub, cassette, snapshot

### Building the system

**Ticket**:
One unit of shippable behaviour, with its own acceptance criteria, written down before the work on it starts. There are nine.
_Avoid_: issue, story, task

**Slice**:
How one Ticket is built: a failing test that describes the behaviour, the smallest code that turns it green, then a review pass. A Slice is not finished when the test goes green.
_Avoid_: iteration, TDD cycle
