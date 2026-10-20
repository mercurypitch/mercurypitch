// ============================================================
// Draft switch — whether this build shows the draft lessons on a page no worker served
// ============================================================
//
// True on `pnpm dev`, the dev site, PR previews and the e2e bundle; false in
// the production build. Every build carries every lesson page, and the site
// worker decides at run time which are live, from the admin console's state
// and its environment's own default for drafts (src/lesson-gate.ts, the
// LESSON_DRAFTS var in wrangler.jsonc). This is the default of a page no
// worker served, which carries no state of its own (page-state.ts): a
// production bundle on its own lists no draft. The list of drafts is
// drafts.ts; the build side, and why the value is keyed on the Vite mode,
// is tools/draft-lessons.ts.
//
// A compile-time constant: vite.config.ts pins
// `import.meta.env.VITE_DRAFT_LESSONS` to "1" or "0" with a `define`, so the
// comparison folds, and scripts/assert-draft-lessons.mjs reads the default
// off the finished bundle. Read it at module scope only; a test that needs
// the other value stubs the variable and re-imports the module that reads it.

export const DRAFTS_SHOWN: boolean = import.meta.env.VITE_DRAFT_LESSONS === '1'
