# 06 — Agent Meeting for the `both` Route

**What to build:** The flow the `both` Route was reserved for. Ask "should we hire more people?" and get one joint recommendation back — not a partial answer from one domain, and not two answers pasted together.

Each Specialist Agent independently examines the Question through its own Scoped Tools and produces a contribution. The contributions are then combined into a single joint recommendation that cites which domain supplied which fact, so the operator can see that the headcount figures came from HR and the cash position came from Finance.

The agents do not share tools or Datasets during the meeting. Cross-cutting work is done by combining two scoped views — that is precisely why the Agent Meeting exists rather than one agent being allowed to reach wider.

The Number Audit from ticket 05 extends here: it runs on each contribution and on the synthesis. A figure that appears in the joint recommendation but in neither agent's tool results is an audit failure like any other.

**Blocked by:** 04 — HR Agent answers people Questions end-to-end; 05 — Number Audit on agent answers.

**Status:** done — delivered by 1e155a0, e8cff58

- [x] A cross-cutting Question routes `both` and opens an Agent Meeting
- [x] Each Specialist Agent examines the Question through its own Scoped Tools only
- [x] No tool or Dataset is shared between the agents during the meeting
- [x] The output is a single joint recommendation, not two concatenated answers
- [x] Both domains are represented in the recommendation
- [x] The recommendation attributes facts to the domain that supplied them
- [x] The Number Audit runs on each contribution and on the synthesis
- [x] A figure in the synthesis that appears in neither agent's tool results fails the audit visibly
- [x] Tested end-to-end through the entry point against Fixtures, with no key and no spend

**On the fifth and sixth lines:** both domains being represented, and each fact being attributed, are asked of the synthesis in prose and cannot be asserted offline — in Replay Mode the recommendation is whatever was recorded, so every attribution a test matches is a string that test scripted. What is asserted is everything up to that point: both contributions are in what the synthesis was handed (`ask.test.ts`, and a meeting that dropped one leaves the suite red), and the recorded demo run shows the attribution for real. The same limit applies to every prompt in this system and is the reason the Number Audit exists — it is the one claim about a model's output that is checked rather than hoped for.

**On the seventh line:** a contribution is audited against its own agent's Scoped Tool results, and only the synthesis is audited against both agents' pooled together. Pooling at the contribution level would let a figure the HR Agent invented be excused by the Finance Agent's evidence, which is the isolation boundary leaking through the check that exists to protect it.

**On the eighth line:** the failure names which text it lands on. A figure with no Scoped Tool result behind it cannot appear in a recommendation that passed its own audit, so a failing contribution beside a passing recommendation is reported as exactly that rather than as "what you are reading is unaudited" — a warning the operator can check and find untrue is a warning they will stop reading.
