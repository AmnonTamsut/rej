# The walkthrough video

A four-and-a-half minute explainer of the system: the problem the assessment
brief states, then each section of the solution in the order the decisions were
made, then the system running on real recorded output. No narration.

Rendered from HTML with [HyperFrames](https://hyperframes.heygen.com) — the
composition is a DOM whose timing is declared in `data-*` attributes and whose
motion is one paused, seekable GSAP timeline per scene. The renderer seeks each
frame independently, so the output is deterministic: same input time, same
pixels, every run.

## Layout

| Path              | What is in it                                                                 |
| ----------------- | ----------------------------------------------------------------------------- |
| `build.mjs`       | The scene content and the design system. **Edit this, not the HTML.**         |
| `index.html`      | Generated. The thin orchestrator: twenty scene slots, the ground, the rail.   |
| `compositions/`   | Generated. One sub-composition per scene, `s01`–`s20`.                        |
| `design.md`       | Brand truth — palette, type, structure, and the motion rules each scene cites.|
| `BRIEF.md`        | The confirmed intent this was built from.                                     |
| `STORYBOARD.md`   | The frame-by-frame plan, with each scene's duration and cited motion.         |
| `assets/gsap.min.js` | Vendored, not fetched — see below.                                         |

`index.html` and `compositions/` are build output. They are committed so the
project renders from a clean clone without running the generator first, but the
generator is the source: hand-editing a scene file will be overwritten.

## Working on it

```bash
node build.mjs          # regenerate index.html + compositions/
npx hyperframes check   # lint, runtime, layout, motion, contrast — must be clean
npx hyperframes render -o out.mp4
```

`npx hyperframes preview` opens the Studio if you want to scrub it.

Snapshot a frame while iterating — the layout audit samples nine points across
four minutes, so it will not see every scene:

```bash
npx hyperframes snapshot --no-end --at 7,18,29,41,54,69,84,98,111,124,138,152,166,180,194,207,220,236,250,264
```

Those are the twenty scene midpoints. Two bugs on this build were invisible to
`check` and obvious on the contact sheet: a list whose items never revealed (they
sit at `opacity: 0` until the timeline claims them), and a terminal block running
off the bottom of the canvas.

## Two things that will bite

**GSAP is vendored into `assets/`, not loaded from a CDN.** A render-time network
fetch is a determinism hazard, and this environment's proxy blocks jsdelivr
outright — the composition silently has no `gsap` and every timeline fails to
register. If you bump the version, replace the file.

**The typeface is `DejaVu Serif`, not the Charter the deck uses.** Charter is
present in the render container only as a Type1 `.pfb`, a format Chromium
dropped, so it resolves silently to Liberation Serif — same metrics as the
default serif. It looked like it worked. Both faces are declared with
`src: local(...)`; check a rendered frame, not `fc-list`, before trusting a font.

## Provenance

Every figure, similarity score and terminal block on screen is copied from a
real `npm run demo` run in Replay Mode. Nothing was written for the slide —
including the Agent Meeting in frame 18, where the Number Audit fails on two
derived figures. That recording was kept rather than re-rolled, for the reason
ADR 0006 gives.
