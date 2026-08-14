# 06 — Agent Meeting for the `both` Route

**What to build:** The flow the `both` Route was reserved for. Ask "should we hire more people?" and get one joint recommendation back — not a partial answer from one domain, and not two answers pasted together.

Each Specialist Agent independently examines the Question through its own Scoped Tools and produces a contribution. The contributions are then combined into a single joint recommendation that cites which domain supplied which fact, so the operator can see that the headcount figures came from HR and the cash position came from Finance.

The agents do not share tools or Datasets during the meeting. Cross-cutting work is done by combining two scoped views — that is precisely why the Agent Meeting exists rather than one agent being allowed to reach wider.

The Number Audit from ticket 05 extends here: it runs on each contribution and on the synthesis. A figure that appears in the joint recommendation but in neither agent's tool results is an audit failure like any other.

**Blocked by:** 04 — HR Agent answers people Questions end-to-end; 05 — Number Audit on agent answers.

**Status:** ready-for-agent

- [ ] A cross-cutting Question routes `both` and opens an Agent Meeting
- [ ] Each Specialist Agent examines the Question through its own Scoped Tools only
- [ ] No tool or Dataset is shared between the agents during the meeting
- [ ] The output is a single joint recommendation, not two concatenated answers
- [ ] Both domains are represented in the recommendation
- [ ] The recommendation attributes facts to the domain that supplied them
- [ ] The Number Audit runs on each contribution and on the synthesis
- [ ] A figure in the synthesis that appears in neither agent's tool results fails the audit visibly
- [ ] Tested end-to-end through the entry point against Fixtures, with no key and no spend
