// ============================================================
// ContactLight: the glow where the voice meets the path, now
// ============================================================
//
// The glide rooms draw Merc over the voice's head and the lit front (Lip
// roll's bay, Ng slides' bridge), so nothing used to answer the moment a
// singer found the note. This does, at the point of contact: a glow on
// the target at the playhead, in the room's lit colour while the engine
// has the voice on the path (contact-light.ts), with a ring that catches
// the moment the voice comes on. Merc stands on that point while the
// voice is on it, so each room sizes the glow to show round him. Off, a
// small neutral mark stays on the target while Merc rides the voice
// away from it, so it also marks where to go.
//
// Cheap to composite: the room moves one box by transform each frame; the
// two glows are radial gradients painted once, cross-faded by opacity; the
// ring is a transform and an opacity animation. No filter, no blending
// mode. Reduced motion: the colour changes, with no fade and no ring.

import type { JSX } from 'solid-js'
import { onMount } from 'solid-js'
import type { ContactState } from './contact-light'
import { createContactTracker } from './contact-light'
import styles from './ContactLight.module.css'

/** A room's glow: CSS backgrounds for the lit glow, the dim one, the ring. */
export interface ContactPalette {
  readonly on: string
  readonly off: string
  readonly ring: string
}

/** The ring's run, ms, and its scale from and to. */
const RING_MS = 420
const RING_FROM = 0.55
const RING_TO = 1.35

export interface ContactLightApi {
  /** One screen frame: the glow's centre in the room, px, and its state. */
  show: (x: number, y: number, state: ContactState) => void
  /** Hidden, nothing caught: a new run, the intro, the result. */
  reset: () => void
}

export interface ContactLightProps {
  /** The glow's half-width and half-height, px. */
  readonly rx: number
  readonly ry: number
  readonly palette: ContactPalette
  /** Reduced motion: the colour changes only. */
  readonly reduced: boolean
  readonly testId: string
  readonly onReady: (api: ContactLightApi) => void
}

export function ContactLight(props: ContactLightProps): JSX.Element {
  let host: HTMLDivElement | undefined
  let ring: HTMLDivElement | undefined
  const tracker = createContactTracker()
  let state: ContactState = 'hidden'
  let placed = ''
  let catches = 0

  const setState = (next: ContactState): void => {
    if (next === state || host === undefined) return
    state = next
    host.dataset.state = next
  }

  const ringOut = (): void => {
    if (props.reduced || ring === undefined) return
    if (typeof ring.animate !== 'function') return
    ring.animate(
      [
        { transform: `scale(${RING_FROM})`, opacity: 0.95 },
        { transform: `scale(${RING_TO})`, opacity: 0 },
      ],
      { duration: RING_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
    )
    catches += 1
    if (host !== undefined) host.dataset.catches = String(catches)
  }

  const api: ContactLightApi = {
    show: (x, y, next) => {
      if (host === undefined) return
      if (next !== 'hidden') {
        const at = `translate3d(${(x - props.rx).toFixed(1)}px,${(y - props.ry).toFixed(1)}px,0)`
        if (at !== placed) {
          placed = at
          host.style.transform = at
        }
      }
      if (tracker.step(performance.now() / 1000, next)) ringOut()
      setState(next)
    },
    reset: () => {
      tracker.reset()
      setState('hidden')
    },
  }

  onMount(() => props.onReady(api))

  return (
    <div
      ref={host}
      class={styles.light}
      classList={{ [styles.reduced]: props.reduced }}
      style={{
        width: `${(2 * props.rx).toFixed(1)}px`,
        height: `${(2 * props.ry).toFixed(1)}px`,
      }}
      aria-hidden="true"
      data-state="hidden"
      data-catches="0"
      data-testid={props.testId}
    >
      <div
        class={`${styles.glow} ${styles.off}`}
        style={{ background: props.palette.off }}
      />
      <div
        class={`${styles.glow} ${styles.on}`}
        style={{ background: props.palette.on }}
      />
      <div
        ref={ring}
        class={styles.ring}
        style={{ background: props.palette.ring }}
      />
    </div>
  )
}
