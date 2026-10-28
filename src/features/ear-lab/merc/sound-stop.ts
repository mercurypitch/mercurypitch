// ============================================================
// The sound taken away mid-run, noticed: the app put away, a call or
// Siri taking the audio session (iOS says 'interrupted'; a context
// suspended under a sounding question was taken, not paused by the
// app), or the route changing under the singer, headphones out first.
// The room decides what a stop does; this only tells it why.
// ============================================================

import { createEffect, on, onCleanup, onMount } from 'solid-js'
import { audioRoute } from '@/stores/audio-route-store'
import type { SoundStop } from './merc-lines'

export function watchSoundStop(watch: {
  running: () => boolean
  sounding: () => boolean
  context: () => AudioContext | null | undefined
  stop: (cause: SoundStop) => void
}): void {
  onMount(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') watch.stop('away')
    }
    document.addEventListener('visibilitychange', onVisibility)
    onCleanup(() =>
      document.removeEventListener('visibilitychange', onVisibility),
    )
  })
  createEffect(
    on(watch.running, (live) => {
      const ctx = watch.context()
      if (!live || !ctx) return
      const onState = (): void => {
        const state = ctx.state as string
        if (
          state === 'interrupted' ||
          (state === 'suspended' && watch.sounding())
        ) {
          watch.stop('interrupted')
        }
      }
      ctx.addEventListener('statechange', onState)
      onCleanup(() => ctx.removeEventListener('statechange', onState))
    }),
  )
  createEffect(
    on(
      audioRoute,
      (now, before) => {
        if (before === undefined || before === null || now === before) return
        watch.stop(
          before === 'headphones' || before === 'bluetooth'
            ? 'headphones'
            : 'route',
        )
      },
      { defer: true },
    ),
  )
}
