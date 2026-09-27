// ============================================================
// KaraokeStudioScreen — the Karaoke studio, on the shell's stack
// ============================================================
//
// The studio (src/features/karaoke-room/KaraokeStudio.tsx) is the old
// Karaoke tab, and it carries the whole panel with it, so it loads when it
// is first opened rather than with the shell. Back, and a song handed back
// to the room, both pop it.

import type { JSX } from 'solid-js'
import { lazy, Suspense } from 'solid-js'
import { popScreen } from './run-shell-store'

const KaraokeStudio = lazy(async () =>
  import('@/features/karaoke-room/KaraokeStudio').then((m) => ({
    default: m.KaraokeStudio,
  })),
)

export function KaraokeStudioScreen(): JSX.Element {
  return (
    <Suspense fallback={<div class="mp-studio-loading" aria-busy="true" />}>
      <KaraokeStudio onDone={popScreen} />
    </Suspense>
  )
}
