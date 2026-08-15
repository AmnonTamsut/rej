# Fixtures

Every file in this directory is a recording of one real call to the Claude API,
captured by the record command. Replay Mode — the default — serves these, which
is how the whole system runs with no key and no spend.

## Fixtures are recorded, never written

Do not create or edit a file here by hand, and in particular do not edit one to
make a test pass. The demo's claim is that Replay Mode shows what the model
actually said; a hand-written answer quietly turns that claim into a lie, and it
is the reviewer, not the author, who finds out.

The rule is stated in three places, because a rule only in an ADR is a rule
nobody meets at the moment they are about to break it: here, on the first line of
every recording (`note`), and in the error Replay Mode raises when a file no
longer matches itself.

That last one is enforcement, as far as it usefully goes: each recording carries
an `integrity` digest over its own request and response, and Replay Mode refuses
a file whose contents no longer match it. That will not stop someone determined
to recompute the digest — it stops the edit that actually happens, which is a
value nudged until a test goes green. The `note` sits outside the digest on
purpose: it says nothing about what the model returned, so deleting a comment
should not read as tampering with an answer.

## Recording

```
ANTHROPIC_API_KEY=... npm run record -- --demo
```

`--demo` records the whole demo Question set — `DEMO_QUESTIONS` in
`src/demo.ts` — in one deliberate pass. That is how the recordings here were
made, and re-recording is the same one command rather than a Question at a time.
Naming Questions instead (`npm run record -- "<Question>"`) records just those.

This is a Live Mode run and the only sanctioned spend in the project. The
command reports what the pass cost in tokens and dollars as it finishes;
`docs/recording-pass.md` records what the shipped set cost.

## Why a Fixture goes missing

A Fixture is keyed by a digest of the entire request — model, system prompt,
message history, and tool schemas. Editing a system prompt or a tool schema
therefore moves the key, and the recording made against the old prompt is no
longer served. That is deliberate: a stale recording surfaces as a loud miss
naming the record command, never as a wrong answer.

Replay Mode never falls through to the live API on a miss, and never invents an
answer. Re-record instead.
