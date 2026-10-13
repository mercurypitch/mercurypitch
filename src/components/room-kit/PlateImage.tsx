// ============================================================
// PlateImage: one painted plate, shown once it is decoded
// ============================================================
//
// The room adopts the `<picture>` the singer's tap preloaded
// (plate-loader.ts) and shows it the moment its decode is done. A decode
// that takes longer than FALLBACK_MS shows the room's fallback first, a
// gradient of the plate's own band colours, and the plate fades in over it
// in FADE_MS when it is ready; a plate that will not decode leaves the
// fallback up. On leave the plate is released: its file and its pixels go
// with the room.
//
// A decode can also fail because the picture switched files under it (a
// tablet turned mid-load); the plate is asked once more before the room
// gives up on it.

import type { JSX } from 'solid-js'
import { createSignal, onCleanup, onMount } from 'solid-js'
import type { Plate, PlateSpec } from './plate-loader'
import { claimPlate, plateDecoded, releasePlate } from './plate-loader'
import styles from './PlateImage.module.css'

/** A decode slower than this shows the fallback first, ms. */
export const FALLBACK_MS = 400
/** How long a late plate takes to fade in over the fallback, ms. */
export const FADE_MS = 200

export type PlateState = 'waiting' | 'fallback' | 'ready' | 'failed'

export interface PlateImageProps {
  spec: PlateSpec
  /** The fallback's CSS background: the plate's band colours. */
  fallback: string
  class?: string
  style?: JSX.CSSProperties
  testId: string
  /** The plate is on screen (or will not be: it failed). */
  onSettled?: (state: 'ready' | 'failed') => void
}

export function PlateImage(props: PlateImageProps): JSX.Element {
  let host: HTMLDivElement | undefined
  const [state, setState] = createSignal<PlateState>('waiting')
  /** The fallback showed: the plate fades in over it. */
  const [waited, setWaited] = createSignal(false)
  let plate: Plate | null = null
  let alive = true
  let late: ReturnType<typeof setTimeout> | undefined

  const settle = (outcome: 'ready' | 'failed'): void => {
    if (!alive) return
    clearTimeout(late)
    setState(outcome)
    props.onSettled?.(outcome)
  }

  const decode = (img: HTMLImageElement, tries: number): void => {
    // A decode settles once, outside any tracked scope: it reads the room's
    // onSettled as it is at that moment, which is the one to tell.
    plateDecoded(img).then(
      // eslint-disable-next-line solid/reactivity -- read once when the decode settles
      () => settle('ready'),
      // eslint-disable-next-line solid/reactivity -- read once when the decode settles
      () => {
        if (alive && tries > 1) decode(img, tries - 1)
        else settle('failed')
      },
    )
  }

  onMount(() => {
    const mine = claimPlate(props.spec)
    plate = mine
    mine.picture.className = styles.picture
    mine.img.className = styles.image
    host?.append(mine.picture)
    late = setTimeout(() => {
      if (state() !== 'waiting') return
      setWaited(true)
      setState('fallback')
    }, FALLBACK_MS)
    decode(mine.img, 2)
  })

  onCleanup(() => {
    alive = false
    clearTimeout(late)
    if (plate !== null) releasePlate(plate)
    plate = null
  })

  return (
    <div
      ref={host}
      class={
        props.class === undefined
          ? styles.plate
          : `${styles.plate} ${props.class}`
      }
      classList={{
        [styles.ready]: state() === 'ready',
        // Only a plate that kept the room waiting fades in.
        [styles.fading]: state() === 'ready' && waited(),
      }}
      style={props.style}
      data-testid={props.testId}
      data-state={state()}
      aria-hidden="true"
    >
      <div
        class={styles.fallback}
        classList={{
          // Up while the room waits, and under a late plate as it fades in.
          [styles.fallbackShown]: waited() || state() === 'failed',
        }}
        style={{ background: props.fallback }}
      />
    </div>
  )
}
