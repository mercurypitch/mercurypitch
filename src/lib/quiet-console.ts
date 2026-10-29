// ── Quiet console ────────────────────────────────────────────────────
// What the browser console shows on the production site.
//
// About 170 `console.log`/`info`/`debug` calls across the app narrate what
// it is doing: stem loads, jam ICE states, funnel events, worker
// boots. On a diagnostic build (local dev, PR previews, the dev domain)
// that narration is the point. On mercurypitch.com it is noise in front of
// anybody who opens DevTools, and none of it is for them.
//
// So on a production page those three methods do nothing, and `warn` and
// `error` are untouched: a warning or an error is something worth reading
// wherever it happens. Gating once here, rather than wrapping 170 call
// sites in `if (IS_DIAGNOSTIC_BUILD)`, is what keeps the next one from
// shipping loud.
//
// Three ways back to the full console on production:
// - Settings' developer console switch (the same key the floating console
//   reads), for looking at a real device without a rebuild.
// - The e2e build (VITE_E2E_LAB_ACCESS=1), whose specs listen for
//   `[kn-funnel]` lines.
// - Any diagnostic build, as above.
//
// The crash card does not lose its log: global-error-handler.ts wraps these
// methods AFTER this module runs, so every call still lands in its buffer
// and only the final hand-off to the real console is silent. That ordering
// is why each page entry imports this module first.
//
// Tests: src/lib/quiet-console.test.ts.

import { IS_DIAGNOSTIC_BUILD } from '@/lib/defaults'
import { DEVELOPER_CONSOLE_KEY } from '@/lib/developer-console'

/** The methods that only narrate. `warn` and `error` are never here. */
export const QUIET_METHODS = ['log', 'info', 'debug'] as const

export function shouldQuietConsole(input: {
  diagnosticBuild: boolean
  e2eBuild: boolean
  developerConsoleOn: boolean
}): boolean {
  return !(input.diagnosticBuild || input.e2eBuild || input.developerConsoleOn)
}

function readDeveloperConsoleOn(): boolean {
  try {
    return globalThis.localStorage?.getItem(DEVELOPER_CONSOLE_KEY) === 'true'
  } catch {
    // Storage that throws on touch (a locked-down browser) means no switch.
    return false
  }
}

const noop = (): void => undefined

/** Silence the narrating methods on `target` when the build calls for it. */
export function quietConsole(
  target: Pick<Console, (typeof QUIET_METHODS)[number]>,
  quiet: boolean,
): void {
  if (!quiet) return
  for (const method of QUIET_METHODS) target[method] = noop
}

quietConsole(
  console,
  shouldQuietConsole({
    diagnosticBuild: IS_DIAGNOSTIC_BUILD,
    e2eBuild: import.meta.env.VITE_E2E_LAB_ACCESS === '1',
    developerConsoleOn: readDeveloperConsoleOn(),
  }),
)
