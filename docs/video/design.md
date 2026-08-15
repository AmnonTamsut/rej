# Design spec — Two Agents, One Inbox

Brand truth for the video. Derived from the shipped walkthrough deck
(`docs/walkthrough.html`), adapted to a 1920×1080 frame.

## Concept angle

The system's one guarantee is that the money lane and the people lane never
touch. So the palette carries that guarantee: **two accents that never appear on
the same element.** Everything else on the frame is neutral, which leaves the
two colours doing the only structural work on screen.

## Canvas

Dark, fixed. `1920×1080`, 30fps. A single visual world — no theme switching.

## Colour

| Token         | Hex       | Role                                             |
| ------------- | --------- | ------------------------------------------------ |
| `ground`      | `#131218` | Page ground, violet-biased near-black            |
| `panel`       | `#1B1A23` | Raised surface                                   |
| `panel-2`     | `#232130` | Terminal blocks, slate bar                       |
| `ink`         | `#EDEBF3` | Primary text                                     |
| `ink-soft`    | `#A8A4B4` | Body copy                                        |
| `ink-faint`   | `#8A8698` | Labels, notes, metadata                          |
| `rule`        | `#332F3E` | Hairlines                                        |
| `rule-firm`   | `#4A4658` | Structural rules, borders                        |
| **`fin`**     | `#E4A768` | **The money lane.** Brass — ledger, coin         |
| `fin-wash`    | `#2A2018` | Money-lane card fill                             |
| `fin-edge`    | `#7A5C39` | Money-lane card border                           |
| **`hr`**      | `#A09EF2` | **The people lane.** Indigo                      |
| `hr-wash`     | `#1E1D34` | People-lane card fill                            |
| `hr-edge`     | `#4C4A9B` | People-lane card border                          |
| `warn`        | `#EE8878` | Audit failure, rejected option                   |
| `good`        | `#74C9A0` | Audit pass                                       |

**Do:** let `fin` and `hr` be the only saturated colour on a frame. Tint the
neutrals violet, never dead grey.
**Don't:** put brass and indigo on the same element, ever. Don't add a third
accent — a third colour would say there is a third lane.

## Type

Both faces are installed in the render container and declared with
`src: local(...)`. Nothing is downloaded, at author time or render time.

- **Display / body — `DejaVu Serif`.** A sturdy text serif with a large x-height
  and heavy, squared serifs that hold their weight at 92px and stay readable at
  28px. Chosen because the project's real deliverable is written argument — ADRs
  and prose answers — not UI.
- **Utility / data — `Liberation Mono`.** Every label, score, threshold and
  terminal block. The system is a CLI; its own output is set in its own voice.

The deck this video comes from is set in Charter, and the video deliberately is
not. Charter ships in this container only as a Type1 `.pfb`, a format Chromium
dropped, so it resolves silently to Liberation Serif — identical metrics to the
default serif, measured rather than assumed. A face that cannot be verified to
render is not a typographic choice.

Scale for video: claim `88–104px`, lede `38px`, card heading `36px`, body `30px`,
labels and notes `24px`, terminal `26px`. Nothing under 24px.

## Structure

Every frame carries the same furniture, so the content is the only thing that
moves:

- **Slate bar** (top): act name left, `NN / 20` right, hairline beneath.
- **Eyebrow**: mono, uppercase, tracked, with a rule running to the right margin.
- **Claim**: the frame's single sentence, max 24ch measure.
- **Body zone**: cards, steps, score bars, or a terminal block.
- **Note** (bottom): mono, `ink-faint`, above a hairline — the caveat or cost.
- **Progress rail** (bottom edge, root-level): fills once across the whole film.

Content anchors left. Frame numbering is real sequence information: the order of
the sections is the argument.

## Motion

Cited rules from `/hyperframes-animation`:

- `waterfall-entry` — eyebrow, claim, and note arrive as one cascade from below;
  binary opacity, `power4.out`, never a fade.
- `spring-pop-entrance` — cards, steps and terminal blocks, `power3.out`, no
  overshoot. Enterprise register: smooth settle, never `back.out`.
- `stat-bars-and-fills` — the similarity-score bars grow on `scaleX`.
- `svg-path-draw` — the architecture diagram's wires draw themselves.
- `sine-wave-loop` — one ambient glow breathing behind the content, finite repeats.

Hard cuts between scenes. The frames are frames; the film should feel stepped,
not dissolved.
