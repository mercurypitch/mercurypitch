# Code metrics — what to measure, and what each number is worth

Companion to [CODE-HEALTH.md](CODE-HEALTH.md), which reports the numbers. This
document explains **why those metrics and not others**, and how much each one
deserves to be believed.

It exists because metrics go wrong in two opposite directions and both are
expensive. Take them too seriously and you get metric theatre: a dashboard
nobody acts on, a gate that gets disabled the week it turns red, and a
30-complexity function split into three mutually-dependent 10-complexity
helpers that improves every number while making the code harder to read.
Dismiss them entirely and you lose the only early warning you get on a 342k-line
codebase that no one person reads.

The position taken here: **measure a lot, gate almost nothing, ratchet the
rest.**

---

## 1. The one rule that makes the rest work

**Ratchet, don't threshold.**

An absolute threshold on an existing large codebase has two possible fates. Set
it above today's reality and it never fires. Set it at or below, and the build
is red on day one, and within a week someone adds an ignore file. Neither
produces better code.

A ratchet asks a different question: _is this worse than the last agreed
baseline?_ That question has a useful answer immediately, on any codebase, at
any level of debt. It also correctly distinguishes the two things you care about
— direction and velocity — from the thing you do not (the absolute number, which
is mostly a function of the codebase's age and size).

That is what `pnpm metrics:check` does. The baseline lives in
`docs/agent/code-metrics.baseline.json` and is a **record of agreed debt**, not
a high-water mark to hide behind. When a regression is deliberate, run
`pnpm metrics:update` and explain it in the commit message.

Consequence worth stating: **never publish an aggregate score anywhere a person
could be ranked by it.** That is the Goodhart failure mode, and it converts every
metric on this page into a target to be gamed.

---

## 2. The metrics we collect, ranked by how much they are worth

### Tier 1 — believe these

**Type coverage and type escapes** (`explicitAny`, `tsIgnore`, `nonNullAssertions`)

Not really a "metric" so much as a direct measurement of how much of the codebase
the compiler is actually checking. There is no interpretation layer to get wrong:
an `any` is a hole, and the count of holes is the count of holes. At 99.78%
coverage and 7 explicit `any` in 342k lines, this is the number that says most
about the codebase.

Good: >99%. Concerning: <95%. Evidence: **direct measurement, not a proxy.**

**Import cycles**

A cycle is a _binary defect_, not a degree. Either two modules can be understood
and loaded independently or they cannot. It makes module-initialisation order
significant, which is a class of bug that shows up only under production
bundling — the worst place to find one.

Good: 0. Any other number is a worklist. The right gate is "no new cycles",
which is exactly what the ratchet gives.

**Layer-boundary violations**

The only metric here that measures the _architecture_ rather than the code. Its
value is that it is defined by a rule someone wrote down on purpose, so a
violation is unambiguous: `src/lib` importing `src/stores` is not a judgement
call.

Good: 0 per rule. Evidence: **definitional** — it measures conformance to your
own stated design, so it is exactly as valid as that design.

**Churn × complexity hotspots**

The metric with the best claim to predicting _where_ defects will land, and the
one to read first when deciding what to work on.

The reasoning (Adam Tornhill, _Your Code as a Crime Scene_ / CodeScene):
complexity alone ranks code nobody touches; churn alone ranks trivial files that
change constantly. The product ranks code that is both hard to understand and
under active change — where a reader's time and a bug's odds both concentrate.
CodeScene's published case data puts prioritised hotspots at ~5.5% of a codebase
and ~23% of its defects.

Supporting evidence is independent of the vendor: Nagappan & Ball (Microsoft,
ICSE 2005) found _relative_ code churn predicts defect density well
(R² ≈ 0.81) while _absolute_ commit counts do not (R² ≈ 0.05) — which is why
this must be normalised, and why raw "most-changed files" lists are close to
worthless.

There is no threshold. It produces a **ranking**, and reading the top 10–20 is
the correct use.

> **Requires real git history.** A shallow clone silently produces a ranking
> from whatever handful of commits it happens to have — which looks like a
> result and is not one. This repo was cloned shallow (51 commits); after
> `git fetch --unshallow` it has 2,138. The harness now detects this and reports
> `skipped` rather than inventing a ranking.

### Tier 2 — useful, with a caveat you must keep saying out loud

**Cognitive complexity** (SonarSource S3776)

Genuinely validated, but _not_ for what people usually claim.

- It predicts **comprehension time**, not defect count. Muñoz Barón, Wyrich & Wagner (ESEM 2020) meta-analysed ~24,000 understandability evaluations across 427 snippets: weighted mean correlation **0.54** with time-based measures, **0.65** among the significant ones. Against _correctness_ of comprehension: mixed and non-significant.
- It is **not merely a proxy for size** at function level. Landman et al. (2016), 17.6M Java methods and 6.3M C functions: method-level R² of 0.40–0.44 against SLOC (0.68–0.71 log-transformed). Counter-intuitively the correlation gets _weaker_ for larger functions (R² 0.40 → 0.14 as minimum size rises), because variance in complexity explodes as size grows.
- At **file** level it _is_ mostly a proxy for size: log-log R² reaches **0.90**. A file-level complexity dashboard is a LOC dashboard with extra steps. Report it per function.
- The threshold of **15 is vendor convention**, not a finding. It is hard-coded as `DEFAULT_THRESHOLD = 15` in the `eslint-plugin-sonarjs` this repo already installs; SonarSource set it per-language by developer tolerance (25 for C/C++), not from defect data.

Practical reading: 15 or under is the target, over 25 deserves a comment
explaining why, and over 50 is a refactor ticket. Treat the total as a
**reading-cost worklist**, ratchet the count, never gate on it absolutely.

Why cognitive rather than cyclomatic: cyclomatic charges +1 per `switch` case
(so a flat, readable dispatch scores as badly as deep nesting) and has a floor
of 1 per function, which makes any aggregate above function level just a
function count. Cognitive complexity charges no cost of entry and adds a nesting
penalty, so aggregating it is meaningful.

**Duplication** (jscpd)

Cheap, fast, and occasionally finds something real. Convention is <3%
acceptable, >5% concerning — both **vendor convention with no calibration study
behind them**. At 2.2% this repo is fine, and the number is best read as a
ranked list of clone pairs, not a figure to defend.

> One configuration trap worth knowing: jscpd's default `--max-lines 1000` and
> `--max-size 100kb` would silently skip `StemMixer.tsx` (7,721 lines),
> `piano-roll.ts` (5,954) and `App.tsx` (4,183) — exactly the files most likely
> to contain copy-paste. A duplication report that quietly excluded the largest
> files would be worse than none.

**File and function size**

Crude, and highly correlated with everything else here — which is the argument
both for and against it. For it: it needs no tooling, no interpretation, and no
one argues about what it means. Against: it is the metric most easily gamed by
splitting a file in half.

Used here as a ratchet on the _counts_ over 800 and 1500 lines, because those
counts track something real about navigability that per-file numbers do not.

### Tier 3 — collected but explicitly not trusted

**Line coverage**

Collected, reported, deliberately **not gated**. See CODE-HEALTH.md §5 for the
empirical reason: of eight deliberate mutations to production code during this
audit, six survived, and every survivor sits in code that line coverage reports
as fully exercised. The arc-physics tests execute every line of their subject
while asserting against a _copy_ of it. A repo-wide 80% gate would have been
green through all of it.

Coverage measures _execution_, not _assertion_. It is a floor detector — 0%
coverage is genuinely informative — and nothing more. The useful gate forms are
a per-glob threshold on small pure modules, and a ratchet on total covered lines
so that deleting tests is visible.

**Maintainability Index**

Not collected, on purpose. The original formula is a fixed regression over
Halstead volume, cyclomatic complexity and LOC, fitted to 1990s Hewlett-Packard
codebases and never revalidated. Ostberg & Wagner's critique is the standard
reference. Its components are already reported individually and more honestly.

**Halstead metrics**

Not collected. They correlate ~0.91 with LOC (Herraiz & Hassan), so they add
essentially nothing over counting lines, and they are ill-defined for TypeScript
syntax anyway.

**Abstractness and distance from the main sequence**

Not collected. `abstract class` is essentially absent from idiomatic TypeScript
and interfaces are type-erased, so abstractness collapses to ~0 and the distance
metric degenerates into `1 − instability`, carrying no independent information.

Instability itself (`I = Ce / (Ce + Ca)`) is available via
`depcruise --output-type metrics` and is worth reading **descriptively**, to find
hub folders with both high afferent and high efferent coupling. There is no
validated cut-point, so it must not be a gate.

**Composite "maintainability ratings"**

Any single letter grade for a codebase. SonarQube's default A/B boundary scored
AUC 0.60 against human expert labels — barely above chance. The individual rule
violations underneath are sound; the composite is not.

---

## 3. Commands

```bash
pnpm metrics          # everything above, human-readable
pnpm metrics:json     # the full record, including per-violation samples
pnpm metrics:check    # ratchet against the baseline; exits 1 on regression
pnpm metrics:update   # re-freeze the baseline (say why in the commit message)

pnpm arch             # layer violations and cycles, by rule
pnpm arch:graph       # SVG of the module graph (needs graphviz)
pnpm lint:audit       # the raw complexity and security warnings
pnpm audit:dup        # duplication, with clone locations
```

The optional tools (`dependency-cruiser`, `jscpd`) are devDependencies. When
they are absent the harness reports `skipped` for those sections rather than
failing, so a contributor with a partial install still gets the cheap metrics.

---

## 4. What we deliberately do not do

- **No metric is a per-person statistic.** Ever.
- **No absolute quality gate** on complexity, coverage, duplication or file size. Ratchets only.
- **No composite score.** Each number is reported on its own terms, with its own evidence strength.
- **No metric without a stated confidence.** If the evidence for a threshold is vendor convention, this document says so.

---

## 5. Sources

- Campbell, _Cognitive Complexity: a new way of measuring understandability_, SonarSource white paper v1.7
- Muñoz Barón, Wyrich & Wagner, _An Empirical Validation of Cognitive Complexity as a Measure of Source Code Understandability_, ESEM 2020 (arXiv:2007.12520)
- Landman, Serebrenik, Bouwers & Vinju, _Empirical analysis of the relationship between CC and SLOC_, JSEP 2016
- Herraiz & Hassan, _Beyond Lines of Code: Do We Need More Complexity Metrics?_, in _Making Software_ (O'Reilly, 2010)
- Nagappan & Ball, _Use of Relative Code Churn Measures to Predict System Defect Density_, ICSE 2005
- Tornhill, _Your Code as a Crime Scene_ / _Software Design X-Rays_
- Ostberg & Wagner, _On Automatically Collectable Metrics for Software Maintainability Evaluation_
- D'Ambros, Lanza & Robbes, on change coupling as a defect predictor, WCRE 2009
