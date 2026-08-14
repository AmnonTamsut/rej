# What the Exemplar Banks cover, and what they deliberately do not

Read this before adding a phrasing to an Exemplar Bank. It says which families of
phrasing the Banks were widened to cover, which ones were left alone on purpose,
and what each of those decisions was measured to cost.

The Local Pass has no rules and no keywords — it embeds the Question, embeds the
Banks, and takes the best cosine similarity. So routing is tuned in exactly two
places: the phrasings in `src/router/exemplar-banks/*.json`, and the two
thresholds in `src/router/thresholds.ts`. Nothing is tuned by editing Router
logic.

## How to change a Bank

1. Add the row to the routing table in `src/router/local-pass.test.ts` first, and
   watch it fail. A phrasing that already passes is not evidence of anything.
2. Add the phrasing to the Bank. Prefer filling a gap over moving a threshold —
   see "The two thresholds" below for why.
3. Run the whole routing table, not only the new rows. An exemplar added to one
   Bank moves the margins of Questions in the others: widening the hr Bank for
   named individuals moved "What are we paying the engineering team in total?"
   from a top-two gap of 0.015 to 0.012. It stayed `both`, but it is the row that
   would have told us if it had not. `src/router/thresholds.ts` carries the
   current figures for every Question near a threshold.
4. Run `npm run survey` before and after, and compare the Abstention rate. That
   is the routing bill: an Abstention is the one thing that reaches Escalation,
   and Escalation is the only routing step that spends.

## Covered: a Question that names an individual

`What does Priya Raman earn?` used to score 0.349 against the hr Bank — 0.375
against its best, which was `both` — and abstained, while the same Question asked
with a role, `What does our head of engineering earn?`, scored 0.764 against hr
and was placed for free. A name is not weak evidence for a domain, it is no
evidence at all: the embedding model has never met Priya Raman, so a name in
place of a role removes the signal the Local Pass was reading. Eight phrasings
were added to the hr Bank, covering the frames an operator actually types: what
someone earns, when they joined, which team they are on, what their job title is,
and whether they are a contractor. Each is now a row in the routing table.

The names in those exemplars come from the HR Dataset, but nothing depends on
that. The name is noise to the model; the sentence frame around it is what
carries the routing. A Question about someone who left the company still routes
to hr, and the HR Agent answers that nobody on the roster matches.

## Covered: a pay Question that names nobody at all

`Who is our most expensive person?` scored finance 0.535 against hr 0.301 and was
placed `both`. That is the more dangerous shape of the same problem: it is a
salary Question, only the HR Agent can see a salary, and the phrasing sends it to
a Route where the Finance Agent is asked to help answer it. Two phrasings were
added; it is now hr at 0.738.

## Left uncovered, deliberately

Each of these was measured against the widened Banks. All of them abstain and
escalate, which costs one small model call and produces the right Route — they
are on this list because they are known, not because they are broken.

- **A terse Question built around a name.** `When did Ben Carter start?` scores
  0.336 and `Who does Omar Haddad report to?` 0.342 — both just under the 0.4
  floor, while their longer cousins (`When did Viktor Ilic join?`, 0.435) clear
  it. In a five-word Question the unknown name is most of the text, so there is
  little frame left to match on. Widening the Bank did move them a long way
  (0.254 and 0.220 before it), so more exemplars would eventually carry them —
  two written for these exact frames were tried and got 0.364 and 0.400, the
  second landing precisely on the floor. That is what was rejected: exemplars
  bought at a hundredth each, and a Question sitting on the threshold it has to
  clear. Left where they are, they cost one Escalation and route correctly.
- **Reporting lines.** `Who does Omar Haddad report to?` is hr, but the HR
  Dataset has no reporting line in it, so placing the Question buys nothing an
  Escalation does not: either way the HR Agent answers that it cannot see that.
- **Questions in another language.** French scores 0.193 and German 0.169 against
  their best Bank — `all-MiniLM-L6-v2` is an English model, so these are not thin
  Banks but the wrong model. Covering them means translated Banks and a
  multilingual model, which is a different decision from adding a phrasing.
- **Slang and typos.** Already work, and no exemplars were added for them:
  "How many ppl work here?" scores 0.873, "whats our headcont" 0.590, "What's our
  burn?" 0.698. Sub-word tokenisation absorbs both. Worth re-checking rather than
  assuming if the embedding model is ever swapped.
- **Topics no Dataset owns.** Office hours (0.340), the holiday policy (0.331),
  booking annual leave (0.355), the printer (0.177). These _should_ abstain: no
  Scoped Tool answers them, so escalating and coming back `unclear` with a
  clarification request is the designed behaviour, not a gap. Adding exemplars
  here would route them confidently to an agent that cannot answer them.
  One of this family is already misplaced rather than abstaining — "Who won the
  customer of the year award?" lands hr at 0.430 — and it degrades the way ADR
  0004's design intends: the HR Agent declines an out-of-domain Question visibly
  instead of inventing an answer.

## What the widening cost and bought

Measured with `npm run survey` over the 25 Questions the demo set will be drawn
from, before and after the Bank edit:

| | Abstentions | Abstention rate |
| --- | --- | --- |
| Before | 9 of 25 | 36% |
| After | 5 of 25 | 20% |

The five that remain are the ones this note says should remain: office hours, the
holiday policy, the printer, the French Question, and the poem. The rate is not
meant to reach zero — a Question no Dataset answers is supposed to reach
Escalation, and paying one small call to say `unclear` is the price of not
guessing.

## The two thresholds

Widening a Bank fills a gap. Moving a threshold moves a boundary, and the routing
table holds Questions sitting deliberately close to both — one that must stay
`both` a hair inside the top-two margin, one that must stay `finance` a hair
outside it, and one either side of the score floor. `src/router/thresholds.ts`
names those four Questions and carries their measured scores; it is the one place
those numbers live, so re-measure there rather than quoting them here.

So reach for the thresholds only when a whole region of Questions is on the wrong
side of one, and never to rescue a single phrasing.
