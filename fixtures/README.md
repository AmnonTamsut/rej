# Fixtures

Every file in this directory is a recording of one real call to the Claude API,
captured by the record command. Replay Mode — the default — serves these, which
is how the whole system runs with no key and no spend.

## Fixtures are recorded, never written

Do not create or edit a file here by hand, and in particular do not edit one to
make a test pass. The demo's claim is that Replay Mode shows what the model
actually said; a hand-written answer quietly turns that claim into a lie, and it
is the reviewer, not the author, who finds out.

This is enforced as far as it usefully can be: each recording carries an
`integrity` digest over its own request and response, and Replay Mode refuses a
file whose contents no longer match it. That will not stop someone determined to
recompute the digest — it stops the edit that actually happens, which is a value
nudged until a test goes green.

## Recording

```
ANTHROPIC_API_KEY=... npm run record -- "<Question>" ["<Question>" ...]
```

This is a Live Mode run and the only sanctioned spend in the project, which runs
under a hard budget cap. Record the whole demo set in one deliberate pass rather
than a Question at a time.

## Why a Fixture goes missing

A Fixture is keyed by a digest of the entire request — model, system prompt,
message history, and tool schemas. Editing a system prompt or a tool schema
therefore moves the key, and the recording made against the old prompt is no
longer served. That is deliberate: a stale recording surfaces as a loud miss
naming the record command, never as a wrong answer.

Replay Mode never falls through to the live API on a miss, and never invents an
answer. Re-record instead.
