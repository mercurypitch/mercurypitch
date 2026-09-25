// ============================================================
// Where the voice-control HUD lives.
// ============================================================
//
// A phone puts the pill in the header, because the bottom HUD covers the
// bottom of whatever page is open. But the header is not always there:
// focus mode, Zen and the challenge stage unmount it, and a narrow viewport
// then had no HUD at all while the controller kept listening. The bottom
// HUD carries it in those modes; the lab surfaces render no header on any
// width, so there it is the only place the pill can be.
//
// The native app is the exception to all of that. Its shell draws the
// chrome and no web header, and the width test put the floating pill on a
// phone on its side wholly under the rail's first item, where no tap could
// reach it (device round 4). Voice control has no place in the native
// chrome yet, so the pill does not mount there on any width or in any mode.

export interface HudShell {
  /** The native app (`IS_NATIVE_BUILD`): never the floating pill. */
  native: boolean
  /** A lab surface is open: no app header on any width. */
  labOpen: boolean
  /** Narrow viewport: the header (when there is one) carries the pill. */
  narrow: boolean
  /** The app header is unmounted: focus mode, Zen, the challenge stage. */
  headerHidden: boolean
  voiceEnabled: boolean
}

export function bottomHudVisible(shell: HudShell): boolean {
  if (shell.native) return false
  if (shell.labOpen) return shell.voiceEnabled
  return !shell.narrow || shell.headerHidden
}
