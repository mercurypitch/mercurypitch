// ============================================================
// LegendScreen — the Legend room, as the shell pushes it
// ============================================================
//
// The lazy chunk's way in (NativeShell.tsx, behind NATIVE_LEAGUES). The
// room is a premium room: full-bleed, and Back out of it is the bar's
// (premium-rooms.ts), so the screen adds nothing of its own.

import type { JSX } from 'solid-js'
import { LegendRoom } from './LegendRoom'

export function LegendScreen(): JSX.Element {
  return <LegendRoom />
}
