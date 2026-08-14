# Per-agent data isolation by Scoped Tools, not filtered shared access

Status: accepted

Each Specialist Agent owns a Dataset and is handed only its own Scoped Tools; there is no shared data layer, no shared Dataset, and no tool that reads across the boundary. The Finance Agent cannot reach individual salaries because the HR Agent holds the tools that expose them and the Finance Agent does not — the Finance Agent's payroll tool returns aggregates only, because that is the only shape its tool can return.

The alternative — one data layer with a caller identity and per-request filtering — was rejected because it makes isolation a runtime property enforced by correct filter logic, which can be got wrong and must be tested for. Here isolation is structural: an agent cannot request data it has no tool for, so the guarantee holds by construction and is visible in the wiring rather than in a policy check.

## Consequences

Cross-cutting work cannot be done by one agent reaching wider; it has to go through the Agent Meeting, where each agent contributes from its own tools. Adding a genuinely shared read later means adding an explicit tool to both agents — a deliberate act, which is the point.
