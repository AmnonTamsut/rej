# Replay-first execution with fixtures recorded from real calls

Status: accepted

A reviewer must be able to clone the repo and see the system work without an Anthropic key, and a test suite that calls a paid API on every run is one nobody runs often. So Replay Mode is the default: agent answers are served from Fixtures captured from real Live Mode calls against `claude-sonnet-5`, and `--live` is the opt-in path that spends money. Every test runs against the replay path, so the suite is hermetic and costs nothing.

## Considered options

- **Hand-written mock responses.** Cheaper still, but they drift from what the model actually returns, and a demo built on invented output would misrepresent the system's behaviour to a reviewer grading prompt quality.
- **Live calls everywhere, key required.** Honest, but makes the repo unrunnable for anyone without a key, puts the bill at the mercy of test runs, and makes CI impossible.

## Consequences

Fixtures go stale when prompts change: any prompt or tool-schema edit invalidates the recording it produced, and re-recording is a deliberate Live Mode run. The recorded-not-written rule is what makes the demo trustworthy, so a Fixture must never be edited by hand to make a test pass.
