/**
 * Emits the HyperFrames project: `index.html` plus one sub-composition per
 * scene under `compositions/`.
 *
 * The scene content lives here rather than in nineteen hand-written HTML files
 * so that the design system is stated once. Everything this emits is ordinary
 * HyperFrames HTML — the generator is an authoring convenience, not a runtime.
 *
 * Run: node build.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const W = 1920;
const H = 1080;

/* ------------------------------------------------------------------ *
 * Design tokens — `design.md` is the authority; this mirrors it.
 * ------------------------------------------------------------------ */

const T = {
  ground: "#131218",
  panel: "#1B1A23",
  panel2: "#232130",
  ink: "#EDEBF3",
  inkSoft: "#A8A4B4",
  inkFaint: "#8A8698",
  rule: "#332F3E",
  ruleFirm: "#4A4658",
  fin: "#E4A768",
  finWash: "#2A2018",
  finEdge: "#7A5C39",
  hr: "#A09EF2",
  hrWash: "#1E1D34",
  hrEdge: "#4C4A9B",
  warn: "#EE8878",
  warnWash: "#2E1B18",
  good: "#74C9A0",
  serif: `"DejaVu Serif", Georgia, serif`,
  mono: `"Liberation Mono", "DejaVu Sans Mono", monospace`,
};

/**
 * Both faces are installed in the render container, so they are declared with
 * `src: local(...)` rather than shipped as files — no download, nothing to go
 * stale. Charter was the deck's face and is deliberately not used here: it is
 * present only as a Type1 `.pfb`, which Chromium dropped support for, so it
 * resolves silently to Liberation Serif. Measured, not assumed.
 */
const FONT_FACES = `
  @font-face { font-family: "DejaVu Serif"; font-weight: 400; font-style: normal;
               src: local("DejaVu Serif"), local("DejaVu Serif Book"); }
  @font-face { font-family: "DejaVu Serif"; font-weight: 700; font-style: normal;
               src: local("DejaVu Serif Bold"); }
  @font-face { font-family: "DejaVu Serif"; font-weight: 400; font-style: italic;
               src: local("DejaVu Serif Italic"); }
  @font-face { font-family: "Liberation Mono"; font-weight: 400; font-style: normal;
               src: local("Liberation Mono"), local("Liberation Mono Regular"); }
  @font-face { font-family: "Liberation Mono"; font-weight: 700; font-style: normal;
               src: local("Liberation Mono Bold"); }
`;

/* ------------------------------------------------------------------ *
 * Scene builder. Each block records a reveal descriptor so the emitted
 * timeline is explicit — no DOM queries at runtime.
 * ------------------------------------------------------------------ */

class Scene {
  constructor(id, act, dur) {
    this.id = id;
    this.act = act;
    this.dur = dur;
    this.parts = [];
    this.reveals = [];
    this.extras = [];
    this.n = 0;
  }

  /** Unique, composition-prefixed id — the only guard against collisions. */
  key(tag) {
    this.n += 1;
    return `${this.id}-${tag}${this.n}`;
  }

  /** `waterfall-entry`: binary opacity, whip up from below, power4.out. */
  wf(html, weight = "normal") {
    const id = this.key("w");
    this.parts.push(html.replace("@ID@", id));
    this.reveals.push({ kind: "wf", id, weight });
    return this;
  }

  /** `spring-pop-entrance`: scale 0 → 1, power3.out, no overshoot. */
  pop(html, gap = 0.42) {
    const id = this.key("p");
    this.parts.push(html.replace("@ID@", id));
    this.reveals.push({ kind: "pop", id, gap });
    return this;
  }

  eyebrow(text, tone = "") {
    return this.wf(
      `<p class="eyebrow ${tone}" id="@ID@">${text}<i></i></p>`,
      "light",
    );
  }

  claim(text, size = 96) {
    return this.wf(
      `<h2 class="claim" id="@ID@" style="font-size:${size}px">${text}</h2>`,
      "anchor",
    );
  }

  lede(text) {
    return this.wf(`<p class="lede" id="@ID@">${text}</p>`, "normal");
  }

  /** Pinned to the bottom edge — the caveat or the cost. */
  note(text) {
    return this.pop(`<p class="note" id="@ID@">${text}</p>`, 0.5);
  }

  cards(items) {
    const inner = items
      .map((c) => {
        const id = this.key("c");
        this.reveals.push({ kind: "pop", id, gap: 0.46 });
        return `<div class="card ${c.tone || ""}" id="${id}">
            <span class="tag">${c.tag}</span>
            <h3>${c.head}</h3>
            <p>${c.body}</p>
          </div>`;
      })
      .join("");
    this.parts.push(`<div class="cards">${inner}</div>`);
    return this;
  }

  steps(items) {
    const inner = items
      .map((s, i) => {
        const id = this.key("s");
        this.reveals.push({ kind: "pop", id, gap: 0.5 });
        return `<div class="step" id="${id}">
            <span class="idx">${String(i + 1).padStart(2, "0")}</span>
            <div><h3>${s.head}</h3><p>${s.body}</p></div>
          </div>`;
      })
      .join("");
    this.parts.push(`<div class="steps">${inner}</div>`);
    return this;
  }

  bullets(items) {
    const inner = items
      .map((b) => {
        const id = this.key("b");
        this.reveals.push({ kind: "pop", id, gap: 0.34 });
        return `<li id="${id}">${b}</li>`;
      })
      .join("");
    this.parts.push(`<ul class="bullets">${inner}</ul>`);
    return this;
  }

  /** `stat-bars-and-fills`: scaleX growth, transform-only. */
  scores(caption, rows, footer) {
    const capId = this.key("sc");
    this.reveals.push({ kind: "pop", id: capId, gap: 0.4 });
    const inner = rows
      .map(([bank, val]) => {
        const id = this.key("sb");
        this.reveals.push({ kind: "bar", id, value: val, gap: 0.26 });
        const tone = bank === "finance" ? "fin" : bank === "hr" ? "hr" : "";
        return `<div class="score ${tone}">
            <span class="bank">${bank}</span>
            <span class="track"><i id="${id}"></i></span>
            <span class="val">${val.toFixed(3)}</span>
          </div>`;
      })
      .join("");
    const footId = this.key("sf");
    this.reveals.push({ kind: "pop", id: footId, gap: 0.4 });
    this.parts.push(
      `<div class="scoreblock">
         <span class="tag" id="${capId}">${caption}</span>
         <div class="scores">${inner}</div>
         <p class="scorefoot" id="${footId}">${footer}</p>
       </div>`,
    );
    return this;
  }

  /** A real terminal block. Lines arrive as one pop, then hold. */
  term(lines) {
    const id = this.key("t");
    this.reveals.push({ kind: "pop", id, gap: 0.5 });
    this.parts.push(`<pre class="term" id="${id}">${lines}</pre>`);
    return this;
  }

  raw(html) {
    this.parts.push(html);
    return this;
  }

  /**
   * Two side-by-side labelled lists. Every item registers its own reveal —
   * `.bullets li` starts at `opacity: 0`, so raw markup here would render an
   * empty frame that no automated gate catches.
   */
  twoLists(a, b) {
    const col = (c) => {
      const tagId = this.key("ct");
      this.reveals.push({ kind: "pop", id: tagId, gap: 0.34 });
      const lis = c.items
        .map((it) => {
          const id = this.key("cl");
          this.reveals.push({ kind: "pop", id, gap: 0.3 });
          return `<li id="${id}">${it}</li>`;
        })
        .join("");
      return `<div class="col"><span class="tag" id="${tagId}">${c.tag}</span>
        <ul class="bullets tight">${lis}</ul></div>`;
    };
    this.parts.push(`<div class="cols">${col(a)}${col(b)}</div>`);
    return this;
  }
}

/* ------------------------------------------------------------------ *
 * The film.
 * ------------------------------------------------------------------ */

const ACT_1 = "The problem";
const ACT_2 = "The solution";
const ACT_3 = "It runs";

const scenes = [];
const S = (id, act, dur) => {
  const s = new Scene(id, act, dur);
  scenes.push(s);
  return s;
};

/* ---- Act I — the problem ---------------------------------------- */

S("s01", ACT_1, 9)
  .eyebrow("A walkthrough in twenty frames")
  .claim("Two Specialist Agents behind a deterministic Router.", 92)
  .lede(
    "A command-line system that takes a business Question and chooses its own route to an answer — to the Finance Agent, to the HR Agent, or to a meeting between them.",
  )
  .note(
    "The problem is the one the assessment brief states. The solution is the five sections we settled on, each with the decision behind it on the record.",
  );

S("s02", ACT_1, 11)
  .eyebrow("The inbox")
  .claim("Money Questions and people Questions land in the same inbox.", 84)
  .cards([
    {
      tone: "fin",
      tag: "A money Question",
      head: "“What did we spend on payroll?”",
      body: "Belongs to Finance. Answering it needs the expense lines and a payroll total.",
    },
    {
      tone: "hr",
      tag: "A people Question",
      head: "“What does Priya Raman earn?”",
      body: "Belongs to HR. Answering it needs one named person's salary.",
    },
  ])
  .note(
    "The operator asking either one should not have to know which department owns it. That is the whole reason a Router exists.",
  );

S("s03", ACT_1, 11)
  .eyebrow("The boundary")
  .claim("But the data behind them cannot be pooled.", 92)
  .lede(
    "Whoever answers <b>“what did we spend on payroll?”</b> must not be able to read <b>what any individual earns</b>. The two Questions arrive together, and their answers have to come from different places.",
  )
  .note("Two obvious builds fail, each in its own way. Next frame.");

S("s04", ACT_1, 12)
  .eyebrow("Two obvious builds, both wrong")
  .claim("Neither answer survives the boundary.", 92)
  .cards([
    {
      tag: "The obvious build",
      head: "One agent with access to everything",
      body: "Answers both kinds of Question on day one — and quietly destroys the boundary, because nothing in it distinguishes a payroll total from a salary.",
    },
    {
      tag: "The other obvious build",
      head: "Two agents and a human choosing",
      body: "Keeps the boundary and hands the routing decision back to the person asking. That is not a system; it is two chat windows.",
    },
  ]);

S("s05", ACT_1, 13)
  .eyebrow("Three problems sitting behind it")
  .claim("Splitting the agents creates three new problems.", 84)
  .steps([
    {
      head: "Some Questions genuinely need both domains",
      body: "“Should we hire more people?” is a headcount Question and a cash Question at once. Neither agent can answer it alone, and neither should reach wider.",
    },
    {
      head: "An agent writing prose about numbers will invent one",
      body: "Sooner or later it states a figure that came from nowhere. In a finance answer that is not a cosmetic flaw — someone acts on it.",
    },
    {
      head: "The reviewer has no API key, and every call costs money",
      body: "A system that only demonstrates itself by spending money demonstrates itself to nobody. A test suite that bills on every run is one nobody runs.",
    },
  ]);

/* ---- Act II — the solution --------------------------------------- */

const DIAGRAM = `
<svg class="diagram" viewBox="0 0 1700 620" role="img"
     aria-label="A Question enters the Local Pass; an Abstention escalates; the Route sends the Question to the Finance Agent, the HR Agent, an Agent Meeting, or a clarification request. The two agents share no data layer.">
  <rect class="bx bx-n" x="2" y="270" width="188" height="66" rx="33"/>
  <text class="lb" x="96" y="311" text-anchor="middle">Question</text>

  <rect class="bx bx-n" x="250" y="190" width="330" height="96" rx="3"/>
  <text class="lb" x="415" y="234" text-anchor="middle">Local Pass</text>
  <text class="lbs" x="415" y="266" text-anchor="middle">free · deterministic</text>

  <rect class="bx bx-n" x="250" y="358" width="330" height="96" rx="3"/>
  <text class="lb" x="415" y="402" text-anchor="middle">Escalation</text>
  <text class="lbs" x="415" y="434" text-anchor="middle">one model call, no tools</text>

  <rect class="bx" x="650" y="250" width="152" height="86" rx="3"/>
  <text class="lb" x="726" y="300" text-anchor="middle">Route</text>

  <path class="wire" d="M190 303 H218 V238 H246"/>
  <path class="wire-d" d="M415 286 V354"/>
  <text class="lbs" x="432" y="328">Abstention</text>
  <path class="wire" d="M580 238 H614 V285 H646"/>
  <path class="wire" d="M580 406 H614 V301 H646"/>

  <rect class="bx bx-f" x="880" y="18" width="760" height="126" rx="3"/>
  <text class="lbs lbs-f" x="912" y="52">finance</text>
  <text class="lb lb-f" x="912" y="94">Finance Agent</text>
  <text class="lbs lbs-f" x="912" y="126">revenue · expenses · cash · payroll total</text>

  <line class="split" x1="872" y1="172" x2="1698" y2="172"/>
  <text class="lbs" x="872" y="164">no shared layer · no tool reads across</text>

  <rect class="bx bx-h" x="880" y="196" width="760" height="126" rx="3"/>
  <text class="lbs lbs-h" x="912" y="230">hr</text>
  <text class="lb lb-h" x="912" y="272">HR Agent</text>
  <text class="lbs lbs-h" x="912" y="304">headcount · vacancies · attrition · salaries</text>

  <rect class="bx" x="880" y="374" width="760" height="104" rx="3"/>
  <text class="lbs" x="912" y="408">both</text>
  <text class="lb" x="912" y="450">Agent Meeting</text>

  <rect class="bx" x="880" y="506" width="760" height="104" rx="3"/>
  <text class="lbs" x="912" y="540">unclear</text>
  <text class="lb" x="912" y="582">Ask the operator to rephrase</text>

  <path class="wire" d="M802 293 H842 V81 H876"/>
  <path class="wire" d="M802 293 H842 V259 H876"/>
  <path class="wire" d="M802 293 H842 V426 H876"/>
  <path class="wire" d="M802 293 H842 V558 H876"/>
</svg>`;

S("s06", ACT_2, 15)
  .eyebrow("The shape of it")
  .claim("One Question in. Two lanes that never touch.", 82)
  .pop(`<div class="figure" id="@ID@">${DIAGRAM}</div>`, 0.5);

S("s07", ACT_2, 15)
  .eyebrow("Section 1 of 5 · The Router — ADR 0005", "neutral")
  .claim("The free stage runs first. Only what it cannot place reaches the paid one.", 74)
  .pop(
    `<div class="tablewrap" id="@ID@"><table class="cmp">
      <thead><tr><th></th><th>Local Pass</th><th>Escalation</th></tr></thead>
      <tbody>
        <tr><th>Mechanism</th><td class="hi">Vector embedding, on this machine</td><td>One model call — no tools, no history</td></tr>
        <tr><th>Model</th><td class="hi"><code>all-MiniLM-L6-v2</code>, quantized</td><td>Claude</td></tr>
        <tr><th>Decides by</th><td class="hi">Cosine similarity against three Exemplar Banks</td><td>A one-word reply naming a Route</td></tr>
        <tr><th>Thresholds</th><td class="hi">Abstains below <code>0.40</code>; <code>both</code> inside <code>0.05</code></td><td>—</td></tr>
        <tr><th>Costs</th><td class="hi">Nothing, and repeats exactly</td><td>One call, and does not</td></tr>
      </tbody></table></div>`,
    0.5,
  )
  .note(
    "An <b>Abstention</b> is the Local Pass declining, and never reaches the operator. <code>unclear</code> is a Route only Escalation can return. The type system makes confusing the two an error.",
  );

S("s08", ACT_2, 14)
  .eyebrow("Section 1 · What the thresholds actually do")
  .claim("Two numbers carry every hard case.", 92)
  .scores(
    "Placed for nothing — “How much cash is left in the bank?”",
    [
      ["finance", 0.874],
      ["both", 0.394],
      ["hr", 0.309],
    ],
    "Clears the 0.40 floor, and the top two are 0.480 apart — well outside the 0.05 margin. Route: finance, decided by the Local Pass, at no cost.",
  )
  .note(
    "The floor sits at 0.40 because the nearest Questions either side are “Is anyone quitting more than usual?” at 0.436 and “What time does the office open?” at 0.340. A real gap, not a cluster.",
  );

S("s09", ACT_2, 13)
  .eyebrow("Section 1 · The same two numbers, failing")
  .claim("Below the floor, the Local Pass abstains.", 88)
  .scores(
    "Abstained — “When did Ben Carter start?”",
    [
      ["hr", 0.35],
      ["finance", 0.239],
      ["both", 0.164],
    ],
    "Five words, most of them a name the embedding model has never met. Nothing clears the floor, so Escalation places it — correctly — as hr.",
  )
  .note(
    "Routing is tuned by editing data: a phrasing in an Exemplar Bank, or a threshold. Never by editing Router logic.",
  );

S("s10", ACT_2, 13)
  .eyebrow("Section 1 · The cost of the trade")
  .claim("The failure mode got quieter, not smaller.", 92)
  .cards([
    {
      tag: "What we gained",
      head: "An unanticipated phrasing still gets answered",
      body: "Exemplar Banks cannot be written to cover everything. Escalation is what stops that limit from being a dead end.",
    },
    {
      tone: "bad",
      tag: "What we gave up",
      head: "Ambiguous input is no longer free",
      body: "A thin Bank now shows up as <b>spend</b> rather than as a visible misroute. <code>npm run survey</code> puts the Abstention rate at 21%.",
    },
  ])
  .note(
    "An earlier spec promised that vague input costs nothing. That promise was withdrawn on purpose, and ADR 0005 carries the reasoning so the reversal is on the record.",
  );

S("s11", ACT_2, 14)
  .eyebrow("Section 2 of 5 · Isolation — ADR 0004")
  .claim("Isolation is wiring, not policy.", 96)
  .cards([
    {
      tone: "fin",
      tag: "Finance Agent · Noah",
      head: "revenue · expenses · cash · payroll total",
      body: "Its payroll tool returns a company-wide total and the headcount it covers, <b>because that is the only shape it can return</b> — not because a filter stripped the rest.",
    },
    {
      tone: "hr",
      tag: "HR Agent · Eva",
      head: "headcount · vacancies · attrition · salaries",
      body: "It holds the tool that exposes an individual salary. The Finance Agent cannot call it, because there is no registry to look another agent's tool up in.",
    },
  ])
  .note(
    "The rejected alternative: one data layer with a caller identity and per-request filtering. A filter I wrote fails open and silent. A tool that does not exist cannot be called.",
  );

S("s12", ACT_2, 14)
  .eyebrow("Section 2 · Three layers, one load-bearing")
  .claim("A system prompt is not a security boundary.", 92)
  .steps([
    {
      head: "Prompt — what the agent <i>should</i> do",
      body: "Names its domain and tells it to decline rather than speculate, so a misroute surfaces as a refusal. Shapes behaviour; guarantees nothing.",
    },
    {
      head: "Tools — what the agent <i>can</i> do",
      body: "Its own array of Scoped Tools, and no registry holding anyone else's. This is what ships, and what the tests assert.",
    },
    {
      head: "Database — what the agent <i>may</i> do",
      body: "A per-agent role with row-level security. The layer I would not ship to production without, because the two above it are code I wrote.",
    },
  ])
  .note(
    "Routing sits outside the boundary and reads no Dataset. So a misroute is a wrong answer, never a leak — and routing accuracy is never a security control.",
  );

S("s13", ACT_2, 14)
  .eyebrow("Section 3 of 5 · The Agent Meeting")
  .claim("Cross-cutting work combines two scoped views. It never widens one.", 76)
  .steps([
    {
      head: "Gather — each attendee answers alone",
      body: "Every attendee answers the same Question through its own Scoped Tools and returns a contribution with the tool results attached. These run in parallel. No agent sees another's data.",
    },
    {
      head: "Synthesis — one call, holding no tools",
      body: "It receives the contributions and combines them into one recommendation, attributing each fact to the agent that supplied it. A decision, not a transcript.",
    },
  ])
  .note(
    "That bounds a meeting at <b>N+1 calls</b>, keeps it reproducible, and means the only thing crossing a department boundary is a sentence an agent chose to publish.",
  );

S("s14", ACT_2, 14)
  .eyebrow("Section 4 of 5 · The Number Audit — ADR 0006")
  .claim("Every figure must appear in the tool results it was built from.", 78)
  .lede(
    "“Only use figures from your tools” is a request to a model. The audit is the enforcement. It checks <b>provenance, not arithmetic</b> — a figure the agent computed is a figure no tool returned.",
  )
  .cards([
    {
      tag: "The tolerance we rejected",
      head: "A percentage derived from two audited figures",
      body: "A dozen figures in evidence yield over a hundred ratios. Percentages would become the one place an invented figure passed unchallenged.",
    },
    {
      tag: "The tolerance we kept",
      head: "Dates are values; quarter labels are names",
      body: "Reading <code>2025-09-30</code> as 2025, 9 and 30 would hand an answer a free “30 months of runway”. So a date is matched whole.",
    },
  ]);

S("s15", ACT_2, 14)
  .eyebrow("Section 5 of 5 · Replay Mode — ADR 0001 &amp; 0003")
  .claim("Clone it, install it, run it. No key, no spend, no network.", 82)
  .bullets([
    "<b>One seam.</b> Every agent, and Escalation too, reaches the model through one small <code>LLMClient</code>. Live and replay are two implementations of it, not a branch inside the agents.",
    "<b>Keyed by the whole request</b> — a digest over the model, system prompt, message history and tool schemas, so editing a prompt invalidates the recording it produced.",
    "<b>A miss is a hard error</b> naming the missing key. Never a quiet call to the live API, never a fabricated answer.",
    "<b>Recorded, never written.</b> A hand-edited Fixture would make the demo stop meaning what it claims to mean.",
  ])
  .note(
    "That replay adapter is the one substitution permitted anywhere in the suite. Everything above the seam is exercised through its real wiring.",
  );

/* ---- Act III — it runs ------------------------------------------- */

S("s16", ACT_3, 13)
  .eyebrow("The ordinary case", "fin")
  .claim("Placed for nothing, answered from one tool, audited.", 84)
  .term(
    `Question: <b>How much cash is left in the bank?</b>

Route:    <s class="rf">finance</s>   (Local Pass)
Agent:    <s class="rf">Finance Agent</s>

As of September 30, 2025, Cherry Host has <b>$1,248,000</b> in the bank.
With a monthly net burn of <b>$96,000</b>, that gives a runway of
approximately <b>13 months</b> at the current rate.

<s class="ok">Number Audit: passed</s> <s class="dim">— every figure above appears in a tool result.</s>`,
  )
  .note(
    "No key, nothing spent. Every run reports the Route, the stage that decided it, who answered, the audit's verdict and the scores behind the decision.",
  );

S("s17", ACT_3, 13)
  .eyebrow("Escalation earning its cost", "hr")
  .claim("A phrasing the Banks never anticipated.", 88)
  .term(
    `Question: <b>When did Ben Carter start?</b>

Route:    <s class="rh">hr</s>        (Escalation)
Agent:    <s class="rh">HR Agent</s>

Ben Carter, a Junior Engineer on the Engineering team, started on
<b>February 3, 2025</b> (per records as of September 30, 2025).

<s class="ok">Number Audit: passed</s>
<s class="dim">The Local Pass abstained — nothing cleared the 0.4 score floor — so this
Question went to Escalation, the only routing step that spends.</s>`,
  )
  .note(
    "One negative assertion guards this: a Question the Local Pass <i>places</i> must not escalate. Silent escalation would pass every other test in the suite.",
  );

S("s18", ACT_3, 16)
  .eyebrow("The audit failing, on purpose")
  .claim("The demo ships a meeting where the check fires.", 88)
  .term(
    `Question: <b>Should we hire more people?</b>

Route:    <s class="rb">both</s>      (Local Pass)
Meeting:  <s class="rf">Finance Agent</s>, <s class="rh">HR Agent</s>

<b>Fill the existing open roles; do not add headcount beyond them.</b>

[…] the Finance Agent reports a year-to-date operating loss of
roughly $1,021,000, with payroll the largest expense line at
$3,100,000 (62% of expenses) for 48 people.

<s class="bad">Number Audit: FAILED — no Scoped Tool result accounts for
1,021,000, 62 in the joint recommendation above.</s>`,
  )
  .note(
    "Both figures are derived — the loss from revenue minus expenses, the percentage from payroll over expenses. Correct arithmetic; no tool returned either.",
  );

S("s19", ACT_3, 14)
  .eyebrow("The end of the line")
  .claim("When neither stage can place it, it asks rather than guesses.", 80)
  .term(
    `Question: <b>How do I fix the printer?</b>

Route:    <s class="rb">unclear</s>   (Escalation)

<s class="dim">  hr 0.160    finance 0.135    both 0.096</s>

Neither the Local Pass nor Escalation could place this Question, so I
would rather ask than guess. Could you rephrase it, saying whether you
are asking about money or about people — or both?`,
  )
  .note(
    "Compare the near miss: “Who won the customer of the year award?” scores 0.421 against hr, clears the floor, and lands on the HR Agent — which holds no tool for it and says so. A misroute degrades into a visible refusal.",
  );

S("s20", ACT_3, 14)
  .eyebrow("What we did not build")
  .claim("The limits are written down, not discovered.", 92)
  .twoLists(
    {
      tag: "Known limits, on the record",
      items: [
        "The embedding model is <b>English-only</b>. A French Question scores 0.193 against its best Bank.",
        "<b>Escalation verdicts are not cached</b>, so the same unplaceable Question escalates every time.",
        "A Number Audit failure <b>does not suppress the answer</b>.",
      ],
    },
    {
      tag: "Deliberately next, not now",
      items: [
        "<b>Caching Escalation verdicts</b> — today the cheaper fix is widening a Bank.",
        "<b>Feeding verdicts back into the Banks</b> — it would let routing drift without anyone deciding to.",
        "<b>A second provider adapter</b> — the seam is the deliverable; an untested adapter is not.",
      ],
    },
  )
  .note(
    "Adding a third Specialist Agent is four pieces of data and one line of wiring. One thing it forces open first: <code>both</code> names a pair, and with three domains it no longer does.",
  );

/* ------------------------------------------------------------------ *
 * Emit.
 * ------------------------------------------------------------------ */

const TOTAL = scenes.reduce((a, s) => a + s.dur, 0);

const sharedCss = `${FONT_FACES}
  #root { position: absolute; inset: 0; overflow: hidden; }
  #root .glow {
    position: absolute; left: -240px; top: -300px; width: 1500px; height: 1200px;
    background: radial-gradient(closest-side, rgba(160,158,242,.16), rgba(160,158,242,0) 72%);
    pointer-events: none;
  }
  #root .stage {
    position: absolute; inset: 0; padding: 62px 110px 74px;
    display: flex; flex-direction: column;
    font-family: ${T.serif}; color: ${T.ink};
  }
  #root .slate {
    display: flex; justify-content: space-between; align-items: baseline;
    font-family: ${T.mono}; font-size: 24px; letter-spacing: .16em;
    text-transform: uppercase; color: ${T.inkFaint};
    padding-bottom: 20px; border-bottom: 2px solid ${T.rule}; flex: none;
  }
  #root .slate .ct { font-variant-numeric: tabular-nums; }
  #root .body { flex: 1 1 auto; min-height: 0; padding-top: 46px; display: flex; flex-direction: column; }

  #root .eyebrow {
    display: flex; align-items: center; gap: 22px; margin: 0 0 26px;
    font-family: ${T.mono}; font-size: 24px; letter-spacing: .18em;
    text-transform: uppercase; color: ${T.inkFaint}; opacity: 0;
  }
  #root .eyebrow i { display: block; flex: 1; height: 2px; background: ${T.rule}; }
  #root .eyebrow.fin { color: ${T.fin}; }
  #root .eyebrow.hr { color: ${T.hr}; }

  #root .claim {
    margin: 0 0 30px; line-height: 1.1; font-weight: 700; letter-spacing: -.018em;
    max-width: 25ch; opacity: 0;
  }
  #root .lede {
    margin: 0 0 30px; font-size: 38px; line-height: 1.42; color: ${T.inkSoft};
    max-width: 46ch; opacity: 0;
  }
  #root .lede b, #root .card p b, #root .bullets b, #root .note b { color: ${T.ink}; font-weight: 700; }

  #root .note {
    margin: auto 0 0; padding-top: 24px; border-top: 2px solid ${T.rule};
    font-family: ${T.mono}; font-size: 23px; line-height: 1.58;
    color: ${T.inkFaint}; max-width: 108ch; opacity: 0;
  }
  #root .note b { color: ${T.inkSoft}; }

  #root code {
    font-family: ${T.mono}; font-size: .88em; background: ${T.panel2};
    padding: 2px 9px; border-radius: 3px; color: ${T.ink};
  }

  #root .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; }
  #root .card {
    border: 2px solid ${T.rule}; background: ${T.panel}; border-radius: 3px;
    padding: 34px 38px 38px; opacity: 0; transform-origin: 50% 50%; will-change: transform;
  }
  #root .card h3 { margin: 0 0 14px; font-size: 35px; line-height: 1.22; font-weight: 700; }
  #root .card p { margin: 0; font-size: 29px; line-height: 1.45; color: ${T.inkSoft}; }
  #root .card.fin { border-color: ${T.finEdge}; background: ${T.finWash}; }
  #root .card.fin h3, #root .card.fin .tag { color: ${T.fin}; }
  #root .card.hr { border-color: ${T.hrEdge}; background: ${T.hrWash}; }
  #root .card.hr h3, #root .card.hr .tag { color: ${T.hr}; }
  #root .card.bad { border-color: ${T.warn}; background: ${T.warnWash}; }
  #root .card.bad h3, #root .card.bad .tag { color: ${T.warn}; }

  #root .tag {
    display: block; margin-bottom: 14px; font-family: ${T.mono}; font-size: 21px;
    letter-spacing: .16em; text-transform: uppercase; color: ${T.inkFaint};
  }

  #root .steps { display: flex; flex-direction: column; gap: 30px; }
  #root .step { display: grid; grid-template-columns: 68px 1fr; gap: 22px; align-items: start; opacity: 0;
                transform-origin: 0% 50%; will-change: transform; }
  #root .step .idx {
    font-family: ${T.mono}; font-size: 23px; color: ${T.inkFaint};
    padding-top: 10px; font-variant-numeric: tabular-nums;
  }
  #root .step h3 { margin: 0 0 8px; font-size: 34px; font-weight: 700; }
  #root .step p { margin: 0; font-size: 28px; line-height: 1.44; color: ${T.inkSoft}; max-width: 62ch; }

  #root .bullets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 22px; }
  #root .bullets li {
    position: relative; padding-left: 34px; font-size: 30px; line-height: 1.42;
    color: ${T.inkSoft}; max-width: 76ch; opacity: 0;
    transform-origin: 0% 50%; will-change: transform;
  }
  #root .bullets li::before {
    content: ""; position: absolute; left: 0; top: .66em; width: 18px; height: 2px; background: ${T.ruleFirm};
  }
  #root .bullets.tight li { font-size: 27px; gap: 18px; }

  #root .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; }

  #root .tablewrap { opacity: 0; transform-origin: 50% 50%; will-change: transform; }
  #root .cmp { border-collapse: collapse; width: 100%; font-size: 28px; }
  #root .cmp th, #root .cmp td { text-align: left; vertical-align: top; padding: 17px 24px; border-bottom: 2px solid ${T.rule}; }
  #root .cmp thead th {
    font-family: ${T.mono}; font-size: 21px; letter-spacing: .14em; text-transform: uppercase;
    color: ${T.inkFaint}; font-weight: 400; border-bottom: 2px solid ${T.ruleFirm};
  }
  #root .cmp tbody th {
    font-family: ${T.mono}; font-size: 22px; color: ${T.inkFaint}; font-weight: 400; white-space: nowrap;
  }
  #root .cmp td { color: ${T.inkSoft}; }
  #root .cmp td.hi { color: ${T.ink}; }

  #root .scoreblock { display: flex; flex-direction: column; gap: 20px; }
  #root .scores { display: flex; flex-direction: column; gap: 16px; }
  #root .score {
    display: grid; grid-template-columns: 150px 1fr 120px; align-items: center; gap: 26px;
    font-family: ${T.mono}; font-size: 27px; color: ${T.inkSoft};
  }
  #root .score .track { display: block; height: 18px; background: ${T.panel2}; border-radius: 2px; overflow: hidden; }
  #root .score .track i {
    display: block; width: 100%; height: 100%; background: ${T.ruleFirm};
    transform-origin: 0% 50%; will-change: transform;
  }
  #root .score.fin .track i { background: ${T.fin}; }
  #root .score.fin .bank { color: ${T.fin}; }
  #root .score.hr .track i { background: ${T.hr}; }
  #root .score.hr .bank { color: ${T.hr}; }
  #root .score .val { text-align: right; font-variant-numeric: tabular-nums; }
  #root .scorefoot {
    margin: 6px 0 0; font-size: 28px; line-height: 1.44; color: ${T.inkSoft}; max-width: 84ch; opacity: 0;
  }

  #root .term {
    margin: 0; font-family: ${T.mono}; font-size: 24px; line-height: 1.54;
    background: ${T.panel2}; border: 2px solid ${T.rule}; border-radius: 3px;
    padding: 28px 34px; color: ${T.inkSoft}; white-space: pre-wrap;
    opacity: 0; transform-origin: 50% 50%; will-change: transform;
  }
  #root .term b { color: ${T.ink}; font-weight: 700; }
  #root .term s { text-decoration: none; }
  #root .term .rf { color: ${T.fin}; }
  #root .term .rh { color: ${T.hr}; }
  #root .term .rb { color: ${T.ink}; }
  #root .term .ok { color: ${T.good}; }
  #root .term .bad { color: ${T.warn}; }
  #root .term .dim { color: ${T.inkFaint}; }

  #root .figure { opacity: 0; transform-origin: 50% 50%; will-change: transform; }
  #root .diagram { display: block; width: 100%; height: auto; }
  #root .bx { fill: ${T.panel}; stroke: ${T.ruleFirm}; stroke-width: 2; }
  #root .bx-n { fill: ${T.panel2}; }
  #root .bx-f { fill: ${T.finWash}; stroke: ${T.finEdge}; }
  #root .bx-h { fill: ${T.hrWash}; stroke: ${T.hrEdge}; }
  #root .lb { font-family: ${T.mono}; font-size: 28px; fill: ${T.ink}; }
  #root .lbs { font-family: ${T.mono}; font-size: 21px; fill: ${T.inkFaint}; }
  #root .lb-f, #root .lbs-f { fill: ${T.fin}; }
  #root .lb-h, #root .lbs-h { fill: ${T.hr}; }
  #root .wire { stroke: ${T.ruleFirm}; stroke-width: 2.5; fill: none; }
  #root .wire-d { stroke: ${T.ruleFirm}; stroke-width: 2.5; fill: none; stroke-dasharray: 7 7; }
  #root .split { stroke: ${T.ruleFirm}; stroke-width: 2; stroke-dasharray: 4 9; }
`;

const F = 1 / 60;
const WF = {
  anchor: { y: 74, d: 0.19, gap: 2 * F },
  normal: { y: 46, d: 0.16, gap: -F },
  light: { y: 34, d: 0.13, gap: -F },
};

/** Build the explicit, seek-safe timeline for one scene. */
function timelineFor(scene) {
  const out = [];
  let t = 0.10;

  for (const r of scene.reveals) {
    if (r.kind === "wf") {
      const w = WF[r.weight];
      out.push(`  tl.set("#${r.id}", { opacity: 1, y: ${w.y} }, ${t.toFixed(3)});`);
      out.push(
        `  tl.to("#${r.id}", { y: 0, duration: ${w.d}, ease: "power4.out" }, ${t.toFixed(3)});`,
      );
      t += w.d + w.gap;
    } else if (r.kind === "pop") {
      t += r.gap;
      out.push(
        `  tl.fromTo("#${r.id}", { scale: 0.94, opacity: 0, y: 22 },` +
          ` { scale: 1, opacity: 1, y: 0, duration: 0.52, ease: "power3.out" }, ${t.toFixed(3)});`,
      );
    } else if (r.kind === "bar") {
      t += r.gap;
      out.push(
        `  tl.fromTo("#${r.id}", { scaleX: 0 },` +
          ` { scaleX: ${r.value.toFixed(3)}, duration: 0.62, ease: "power3.out" }, ${t.toFixed(3)});`,
      );
    }
  }

  // `sine-wave-loop` — one ambient breath behind the content, finite repeats.
  const half = 3.4;
  const reps = Math.max(0, Math.floor(scene.dur / half) - 1);
  out.push(
    `  tl.fromTo("#${scene.id}-glow", { scale: 1, opacity: 0.34 },` +
      ` { scale: 1.14, opacity: 0.52, duration: ${half}, ease: "sine.inOut", yoyo: true, repeat: ${reps} }, 0);`,
  );

  return out.join("\n");
}

fs.mkdirSync(path.join(DIR, "compositions"), { recursive: true });

scenes.forEach((s, i) => {
  const counter = `${String(i + 1).padStart(2, "0")} / ${scenes.length}`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!-- Head is metadata for this source file only; the runtime discards it. -->
  </head>
  <body>
    <template>
      <style>${sharedCss}</style>

      <div id="root" data-composition-id="${s.id}"
           data-width="${W}" data-height="${H}" data-duration="${s.dur}">
        <div class="glow" id="${s.id}-glow" data-layout-ignore="true"></div>
        <div class="stage">
          <div class="slate">
            <span>${s.act}</span>
            <span class="ct">${counter}</span>
          </div>
          <div class="body">
${s.parts.map((p) => "            " + p.trim()).join("\n")}
          </div>
        </div>
      </div>

      <script>
        window.__timelines = window.__timelines || {};
        (function () {
          var tl = gsap.timeline({ paused: true });
${timelineFor(s)}
          window.__timelines["${s.id}"] = tl;
        })();
      </script>
    </template>
  </body>
</html>
`;
  fs.writeFileSync(path.join(DIR, "compositions", `${s.id}.html`), html);
});

/* ---- index.html — thin orchestrator ------------------------------ */

let at = 0;
const slots = scenes
  .map((s) => {
    const slot = `      <div id="el-${s.id}" data-composition-id="${s.id}"
           data-composition-src="compositions/${s.id}.html"
           data-start="${at}" data-duration="${s.dur}" data-track-index="1"
           data-width="${W}" data-height="${H}"></div>`;
    at += s.dur;
    return slot;
  })
  .join("\n\n");

const index = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <!-- GSAP is vendored, not fetched from a CDN: a render-time network fetch is
         both a determinism hazard and unreachable behind this environment's proxy. -->
    <script src="assets/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${T.ground}; }
      #root { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; }
      /* Scene slots stretch over the persistent ground. */
      #root > div[data-composition-src] { position: absolute; inset: 0; }
      /* The ground is a full-bleed CHILD — a background on the root itself can
         be dropped by the producer's frame compositing and render black. */
      #hf-ground { position: absolute; inset: 0; background: ${T.ground}; }
      #hf-rail { position: absolute; left: 0; right: 0; bottom: 0; height: 5px; background: ${T.rule}; }
      #hf-rail-fill {
        position: absolute; inset: 0; background: ${T.ruleFirm};
        transform-origin: 0% 50%; will-change: transform;
      }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main"
         data-start="0" data-duration="${TOTAL}"
         data-width="${W}" data-height="${H}" data-fps="30">

      <div id="hf-ground" class="clip" data-start="0" data-duration="${TOTAL}" data-track-index="0"></div>

${slots}

      <div id="hf-rail" class="clip" data-start="0" data-duration="${TOTAL}" data-track-index="2">
        <div id="hf-rail-fill"></div>
      </div>
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      (function () {
        var tl = gsap.timeline({ paused: true });
        // One root tween: the progress rail fills once across the whole film.
        tl.fromTo("#hf-rail-fill", { scaleX: 0 }, { scaleX: 1, duration: ${TOTAL}, ease: "none" }, 0);
        window.__timelines["main"] = tl;
      })();
    </script>
  </body>
</html>
`;

fs.writeFileSync(path.join(DIR, "index.html"), index);

/* ---- STORYBOARD.md — the dispatch artifact ----------------------- */

let sat = 0;
const board = `---
format: ${W}x${H}
duration: ${TOTAL}s
message: "Two agents, one inbox, and a boundary the system holds by construction"
arc: "Problem → the five sections of the solution, in decision order → the system running"
audience: "an assessment reviewer reading the repo"
mode: autonomous
---

${scenes
  .map((s, i) => {
    const block = `## Frame ${i + 1} — ${s.act}

- status: animated
- src: compositions/${s.id}.html
- duration: ${s.dur}s
- transition_in: cut
- poster: ${Math.min(s.dur - 0.5, 4).toFixed(1)}
- motion: waterfall-entry (eyebrow, claim) + spring-pop-entrance (body blocks) + sine-wave-loop (ambient)${
      s.id === "s08" || s.id === "s09" ? " + stat-bars-and-fills" : ""
    }
- start: ${sat}s
`;
    sat += s.dur;
    return block;
  })
  .join("\n")}`;

fs.writeFileSync(path.join(DIR, "STORYBOARD.md"), board);

console.log(
  `wrote ${scenes.length} scenes + index.html — total ${TOTAL}s (${Math.floor(TOTAL / 60)}m ${TOTAL % 60}s)`,
);
