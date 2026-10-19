// ============================================================
// Draft switch — whether this build shows the draft lessons
// ============================================================
//
// True on `pnpm dev`, the dev site, PR previews and the e2e bundle; false in
// the production build. The list of drafts is drafts.ts; the build side,
// and why the value is keyed on the Vite mode, is tools/draft-lessons.ts.
//
// A compile-time constant: vite.config.ts pins
// `import.meta.env.VITE_DRAFT_LESSONS` to "1" or "0" with a `define`, so the
// comparison folds and a production bundle carries no trace of a draft's
// page. Read it at module scope only; a test that needs the other value
// stubs the variable and re-imports the module that reads it.

export const DRAFTS_SHOWN: boolean = import.meta.env.VITE_DRAFT_LESSONS === '1'
