// ============================================================
// SingerSheetHost — where the singer sheet is drawn, once per app
// ============================================================
//
// App.tsx mounts this on the web and NativeShell.tsx on the phone, so a
// board anywhere opens the one sheet (singer-sheet-store.ts). The sheet's
// code loads the first time a sheet is asked for: a page nobody reports
// from carries none of it on its first paint.

import type { JSX } from 'solid-js'
import { createEffect, createSignal, lazy, Show, Suspense } from 'solid-js'
import { singerSheetOpen } from '@/stores/singer-sheet-store'
import type { SingerSheetProps } from './SingerSheet'

const SingerSheet = lazy(async () =>
  import('./SingerSheet').then((module) => ({ default: module.SingerSheet })),
)

export function SingerSheetHost(props: SingerSheetProps): JSX.Element {
  // Once loaded it stays, so a second open is at once and a close can play.
  const [wanted, setWanted] = createSignal(false)
  createEffect(() => {
    if (singerSheetOpen()) setWanted(true)
  })
  return (
    <Show when={wanted()}>
      <Suspense>
        <SingerSheet onSignIn={props.onSignIn} />
      </Suspense>
    </Show>
  )
}
