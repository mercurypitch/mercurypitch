// ============================================================
// Glassworks listing — whether this build offers the museum on Home
// ============================================================
//
// False in the production web build, true on dev.mercurypitch.com, PR
// previews and `pnpm dev`. The route itself is served either way; this only
// decides whether Home and its tour point at it. The build side, and why the
// value is keyed on the Vite mode, is in tools/glassworks-listing.ts.
//
// A compile-time constant: vite.config.ts pins
// `import.meta.env.VITE_GLASSWORKS_LISTED` to "1" or "0" with a `define`, so
// the comparison below folds and an unlisted build carries no trace of the
// card or the tour step. Read it at module scope only; a test that needs the
// other value stubs the variable and re-imports the module that reads it.

export const GLASSWORKS_LISTED: boolean =
  import.meta.env.VITE_GLASSWORKS_LISTED === '1'
