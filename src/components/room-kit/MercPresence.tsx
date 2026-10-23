// ============================================================
// MercPresence — live Merc where the device can draw him, his still where it cannot
// ============================================================
//
// One per host: the host owns it and hands it the pose its screens ask for;
// the screens never mount a Merc of their own. Where the device can draw him
// (a GPU, and no request for less motion) the box holds the shader Merc of
// the rooms (MercView) over his still. Everywhere else it holds the still
// alone, and MercView is never mounted, so nothing asks for his renderer.
// The still stays up until the live Merc has drawn; a stage that cannot draw
// never says it is ready, so the still stays for good.
//
// MercView is imported statically. It is a small shell: the renderer behind
// it comes in through a dynamic import when he mounts (MercView.tsx).
//
// What the device can draw is decided once, when the box is made. A singer
// who changes the motion setting while a screen is open keeps the Merc it
// opened with.
//
// `data-presence` on his box says which of the two shows: "still", until the
// live Merc has drawn, then "live". The CSS and the tests read it.

import type { JSX } from 'solid-js'
import { createSignal, onCleanup, Show } from 'solid-js'
import type { MercState } from '@/lib/merc/constants'
import { canRunLiveMerc } from '@/lib/merc/gpu-gate'
import styles from './MercPresence.module.css'
import { MercView } from './MercView'
import { prefersReducedMotion } from './reduced-motion'
import { SILENT_VOICE } from './room-constants'

export interface MercPresenceProps {
  /** His pose, read as it changes; the still ignores it. */
  state: () => MercState
  /** His still: shown where he cannot be drawn, and until he has drawn. */
  stillSrc: string
  /**
   * What the still shows, when the screen's own words do not say it.
   * Default: nothing. He is decoration, and a screen reader skips him.
   */
  alt?: string
  /** The width and height of his box, in px. */
  size: number
  class?: string
  /** The box's id; the live Merc inside it takes `${testId}-live`. */
  testId: string
}

export function MercPresence(props: MercPresenceProps): JSX.Element {
  const live = !prefersReducedMotion() && canRunLiveMerc()
  const [drawn, setDrawn] = createSignal(false)
  let frame = 0

  // MercView says ready as his stage starts drawing, before the first draw.
  // The still waits two screen frames, as the lessons' stills do
  // (merc-duo.ts), so it steps aside onto a Merc who is on screen.
  const stepAside = (): void => {
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        frame = 0
        setDrawn(true)
      })
    })
  }

  onCleanup(() => {
    if (frame !== 0) cancelAnimationFrame(frame)
  })

  return (
    <div
      class={
        props.class === undefined
          ? styles.presence
          : `${styles.presence} ${props.class}`
      }
      style={{ width: `${props.size}px`, height: `${props.size}px` }}
      data-testid={props.testId}
      data-presence={drawn() ? 'live' : 'still'}
    >
      <img
        class={styles.still}
        src={props.stillSrc}
        alt={props.alt ?? ''}
        draggable={false}
      />
      <Show when={live}>
        <MercView
          state={props.state}
          voice={() => SILENT_VOICE}
          class={styles.live}
          testId={`${props.testId}-live`}
          onReady={stepAside}
        />
      </Show>
    </div>
  )
}
