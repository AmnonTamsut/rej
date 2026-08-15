---
workflow: general-video
flow: automation
storyboard: no
message: "Two agents, one inbox, and a boundary the system holds by construction"
aspect: 1920x1080
language: en
length: 240s
angle: architecture-walkthrough
---

## Intent

An engineering walkthrough of the `agent-routing-assessment` system for a
reviewer who wants the shape of it in one pass. It states the problem the
assessment brief states, then takes the solution one section at a time in the
order the decisions were actually made, then shows the system running.

No narration and no music — the piece is read, not listened to. Register is
enterprise and plain: this is an argument about a design, and the frames should
carry the same tone as the ADRs they came from.

## Assets

- `docs/walkthrough.html` — the shipped 19-frame HTML deck. Its content and
  palette are the source; the video re-cuts both for a 1920×1080 frame.
- `docs/spec.md` — the problem statement the first five frames come from.
- `docs/adr/*.md`, `docs/written-answers.md` — the reasoning behind each section.

## Customizations

- Every figure, similarity score and terminal block is copied verbatim from a
  real `npm run demo` run in Replay Mode. Nothing on screen is written for the
  slide, including the Agent Meeting where the Number Audit fails.

## Notes

- Deliberately less text per frame than the deck. Video is read at a glance;
  the deck is read at a desk.
- Fonts must resolve without download: `Bitstream Charter` and `Liberation Mono`
  are both present in the render container. Do not reach for a webfont.
- Brass is the money lane and indigo is the people lane; the two never appear on
  the same element. That constraint is the subject, not decoration.
