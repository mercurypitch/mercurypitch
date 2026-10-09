// ============================================================
// MercView — Merc's canvas, mounted once and driven by accessors
// ============================================================
//
// The renderer (src/lib/merc) loads in a chunk of its own on first use, so
// the room draws at once and Merc arrives when his shader is ready. Without
// WebGL2 the stage is a no-op and the room carries on without him: the
// exercise never depends on the picture.

import type { JSX } from 'solid-js'
import { createEffect, onCleanup, onMount, untrack } from 'solid-js'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { MercStage } from '@/lib/merc/stage'

export interface MercViewProps {
  state: () => MercState
  /** Read every frame while he sings; not reactive. */
  voice: () => MercVoice
  class?: string
  style?: JSX.CSSProperties
}

export function MercView(props: MercViewProps): JSX.Element {
  let host: HTMLDivElement | undefined
  let stage: MercStage | null = null
  let disposed = false
  let frame = 0

  // The stage takes the voice pushed, so it is handed over once a frame.
  const feed = (): void => {
    frame = 0
    if (disposed || stage === null) return
    stage.setVoice(props.voice())
    frame = requestAnimationFrame(feed)
  }

  onMount(() => {
    void import('@/lib/merc/stage').then((merc) => {
      if (disposed || host === undefined) return
      stage = merc.mountMercStage(host, {
        transparent: true,
        quality: 'medium',
        // Whatever he is doing by the time his chunk arrives.
        state: untrack(() => props.state()),
      })
      if (stage.ok) frame = requestAnimationFrame(feed)
    })
  })

  createEffect(() => {
    const next = props.state()
    stage?.setState(next)
  })

  onCleanup(() => {
    disposed = true
    if (frame !== 0) cancelAnimationFrame(frame)
    stage?.destroy()
    stage = null
  })

  return (
    <div
      ref={host}
      class={props.class}
      style={props.style}
      aria-hidden="true"
      data-testid="long-note-merc"
      data-merc-state={props.state()}
    />
  )
}
