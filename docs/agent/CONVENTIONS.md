# Conventions — MercuryPitch

Derived by measuring the current tree, not aspirational. Each rule shows the
count that justifies it, so you can tell a real convention from one file's
habit. Where the codebase is genuinely split, the rule is marked **OPEN** and
listed in [QUESTIONNAIRE.md](QUESTIONNAIRE.md) rather than guessed at.

Companion docs: [INDEX.md](INDEX.md) for the module map,
[MISTAKES.md](MISTAKES.md) for recurring failures.

---

## 1. Naming

| Thing             | Convention                                     | Evidence                        |
| ----------------- | ---------------------------------------------- | ------------------------------- |
| Component files   | `PascalCase.tsx`                               | 121 / 124 in `src/components/`  |
| Library files     | `kebab-case.ts`                                | 117 / 125 in `src/lib/`         |
| Store files       | `<domain>-store.ts`                            | 25 / 26 in `src/stores/`        |
| Hooks             | `useThing.ts`, one hook per file               | 41 in `src/features/`           |
| Controllers       | `use<Feature><Concern>Controller.ts`           | 6 in `src/features/stem-mixer/` |
| Props interfaces  | `interface <Component>Props`                   | 195 vs 0 using `type`           |
| Module constants  | `SCREAMING_SNAKE_CASE`                         | 180 exported                    |
| Internal handlers | `handleThing`                                  | 251 distinct                    |
| Callback props    | `onThing`                                      | 266 distinct                    |
| CSS modules       | `<Component>.module.css`, beside the component | 120 files                       |

Tab identifiers come from `src/features/tabs/constants.ts` (`TAB_SINGING`,
`TAB_KARAOKE`, …). Never write a raw tab string.

## 1a. Exports

New components use `export function Foo(props: FooProps)`. **No default
exports.** Named exports keep grep and auto-import honest.

This is a rule for new code. The 108 existing files using `export const` or
`export default` are fine as they are — do not migrate them opportunistically.

## 1b. Where new code goes

New user-facing surfaces go in `src/features/<name>/`. `src/components/` is for
genuinely cross-feature, reusable UI only — `ConfirmDialog`, `Skeleton`,
`icons`.

Direction for new work, not a migration mandate. `src/components/` still holds
325 files including the largest in the repo; see
[REFACTOR-PLAN.md](REFACTOR-PLAN.md) for what moves and when.

## 2. Imports

Use the `@/` alias for anything outside the current directory — 2458 uses
versus 204 relative `../` imports. Relative imports are for siblings only
(`./types`, `./demo-song`).

Import order follows the Prettier plugin already configured; run `pnpm check`
rather than sorting by hand.

## 3. SolidJS

**Never destructure props.** 35 components take `props`, zero destructure it.
Destructuring reads the value once and severs reactivity.

```tsx
// wrong
export function Card({ title }: CardProps) {
  return <h2>{title}</h2>
}
// right
export function Card(props: CardProps) {
  return <h2>{props.title}</h2>
}
```

**Read accessors synchronously.** Calling a signal inside an async callback
detaches it from the owner and warns about computations created outside a root.

```tsx
// wrong
onClick={() => { void (async () => { await del(activeTrack().id) })() }}
// right
onClick={() => { const t = activeTrack(); void (async () => { await del(t.id) })() }}
```

**`<For>` recreates rows on store commits.** A commit mid-gesture cancels an
in-flight drag. Buffer gesture state locally and commit on release.

**Resetting a value-bound signal clobbers `currentTarget.value`** if you read
the event target after the reset. Capture the value first.

## 4. State

| Scope                     | Use                                            | Where                                   |
| ------------------------- | ---------------------------------------------- | --------------------------------------- |
| Component-local           | `createSignal`                                 | in the component                        |
| Shared across one feature | a controller hook returning an object          | `src/features/<name>/use*Controller.ts` |
| App-wide                  | a store module of exported signals + functions | `src/stores/<domain>-store.ts`          |
| Persisted                 | `createPersistedSignal` from `@/lib/storage`   | any store                               |

Stores export bare signal pairs and plain functions — there is no store class
or context wrapper. Clamp in the exported setter, not at every call site (see
`transport-store.ts`).

A store that persists must have an entry in `DEFAULT_SETTINGS` or its own
default; a persisted signal with no default reads `undefined` for every
existing user on upgrade.

## 5. Styling

- **Component-scoped:** `<Component>.module.css` next to the component. 120 files.
- **Feature-global:** a plain `.css` in the feature dir. Only 3 exist — prefer a module.
- **App-global:** `src/styles/*.css`. 10 files, several 40–90 KB. Add here only
  for cross-cutting tokens or shared surface styling.
- **Themes:** adding a preset requires all three of `THEME_PRESETS`,
  `THEME_INFO`, and a `body[data-theme='x']` block in `app.css`.

Never `<header>` or `<footer>` for page content — global rules target those
tags. Pages inside `.main-content` need `flex-shrink: 0`.

## 6. Tests

| Kind              | Location                                            | Runner             |
| ----------------- | --------------------------------------------------- | ------------------ |
| Unit, algorithmic | `src/tests/` (197 files)                            | Vitest             |
| Unit, colocated   | `<module>.test.ts` beside source (38 in `src/lib/`) | Vitest             |
| End-to-end        | `src/e2e/` (34 files)                               | Playwright         |
| Behavioural specs | `docs/specs/*.ears.md`                              | prose, EARS format |

**New unit tests are colocated** — `<module>.test.ts` beside the source.
`src/tests/` keeps cross-module and integration tests. A colocated test moves
and dies with its subject, which matters during
[the refactor](REFACTOR-PLAN.md). The 197 existing files in `src/tests/` stay
where they are.

Pointer-driven controls (drag, scrub, swipe) need a real-mouse Playwright spec
that fails before the fix and passes after, tagged `@smoke`. Synthetic events
pass against broken code.

## 7. Comments and file headers

Every module gets a banner header — 581 files use this exact form:

```ts
// ============================================================
// Name — one line saying what it is
// ============================================================
//
// Optional body: why it exists, the invariant that is easy to break, the
// gotcha that cost someone an afternoon. Skip if there is nothing to say.
```

The header is load-bearing: `scripts/gen-agent-index.mjs` harvests the first
sentence into [INDEX.md](INDEX.md). A file with no header shows up there as
`_(no header comment)_`. Falls back to a JSDoc block directly above the first
export.

Document **why**, not what. The signature already says what.

**This is a convention, not a gate.** CI does not fail on a missing header —
enforcing it would only produce filler headers, which read as documentation
while saying nothing, and those are worse than an honest blank. The rule is:

> Adding a module to `src/features/`, `src/lib/`, `src/stores/`, or
> `workers/` — give it a header. Substantially reworking one — check the
> header still describes what the file does.

The `_(no header comment)_` entries in the index are the worklist. If they
start accumulating, that is the signal to do a pass, not to add a CI rule.

## 8. Formatting

CI is the affected-code formatting authority. PR Gate checks the generated
index and diff whitespace before installing dependencies, then runs
non-mutating changed-file Prettier and ESLint plus the typecheck, tests, and
builds for each affected workspace. Root `pnpm check:ci` remains available as
the equivalent non-mutating syntax gate for the main app. Once per work item,
before its first PR push, run `pnpm pr:prepare`; it regenerates the index and
applies Prettier and ESLint fixes only to files changed from `origin/main`. Run
the relevant workspace typecheck separately, also once. `pnpm check` remains
available as a full-tree local fix pass, but it is not a per-commit gate. Do
not hand-format; do not argue with the formatter.

No emojis anywhere — code, UI, logs, commits, PR text. Use an SVG icon
component from `src/components/icons`.

---

## Private paths in public docs

This repo is public. When a doc references the owner's private material
(archived plans, ops notes, backups), write the location as
`<user-dotfiles>/…` — e.g. `<user-dotfiles>/mercurypitch/archive-2026-07/`.
The token stands for the private notes root the owner (and agents, via
private instructions) can resolve; never write a real home-directory path.

## Open questions

Settled 2026-07-28: exports (§1a), where new code goes (§1b), test placement
(§6), CI enforcement (§8), header comments as convention not gate (§7), spec
location (§6 — `docs/specs/*.ears.md`, `tests/ears/` retired).
Settled 2026-08-01: real D1 migrations (Q8) — the tracked chain in
`workers/db-worker/migrations/` landed with the 2026-07 integration train
(#374); applied files are never edited, new DDL gets a new numbered file.

Still open — see [QUESTIONNAIRE.md](QUESTIONNAIRE.md):

| #   | Question          | Current state                                                                |
| --- | ----------------- | ---------------------------------------------------------------------------- |
| 4   | File size ceiling | 24 files over 1.2k LOC (recounted 2026-08-01); refactor pass tracked in #379 |
| 5   | Global CSS growth | `uvr.css` 88 KB, `vocal-analysis.css` 79 KB; split tracked in #379           |
