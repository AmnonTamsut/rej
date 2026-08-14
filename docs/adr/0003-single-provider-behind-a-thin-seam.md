# One provider, shipped behind a thin client seam

Status: accepted

The project uses the Claude API only, via `@anthropic-ai/sdk`, but every agent talks to it through a small `LLMClient` interface rather than the SDK directly. The seam exists because it is also what Replay Mode plugs into — the replay adapter and the live adapter are two implementations of the same interface — so provider-independence comes free rather than being built for its own sake.

No second provider adapter is shipped. Writing an OpenAI adapter nobody runs would be untested code defending against a requirement that does not exist; the seam is the deliverable, and swapping providers means writing one file against a documented interface.
