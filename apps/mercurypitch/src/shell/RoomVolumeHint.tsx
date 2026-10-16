// ============================================================
// RoomVolumeHint: "turn it up", over a premium room, while the phone is low
// ============================================================
//
// A room's notes, demos and Merc's call play through the phone's volume, and
// at the bottom of it they are gone: the room looks broken. The phone says
// how loud it is (AudioOutput through NativeDeviceApi.audioOutput) when the
// room opens and on a press of a volume key, and volume-hint.ts decides
// from that whether this shows. It goes the moment the volume rises. A
// press can come with no word from the phone, so while this is up, and
// whenever the app comes back, it reads the volume again.
//
// ShellScreens mounts it over each premium room, so no room draws it and
// none of them changes for it. It sits in the bar over the room's title,
// the one place no room uses (RoomVolumeHint.module.css says what is where),
// and takes no taps. The web never shows it: there the app has no reading of
// the volume and nothing is registered to ask.

import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import type { NativeAudioOutput, NativeAudioOutputReading, } from '@/stores/native-shell-store'
import { nativeDeviceApi, pushedBarEnd } from '@/stores/native-shell-store'
import { VolumeLowIcon, VolumeOffIcon } from './icons'
import styles from './RoomVolumeHint.module.css'
import type { VolumeHint } from './volume-hint'
import { nextVolumeHint, VOLUME_HINT_START } from './volume-hint'

// Two lines at most in the bar beside a level pill and "?" (177 px on a
// 390 px phone).
export const HINT_SILENT = 'The volume is at zero. Turn it up.'
export const HINT_LOW = 'Turn the volume up to hear the notes.'

/** The gap kept between the hint and the room's controls in the bar. */
const GAP_PX = 8

/** How often the volume is read again while the hint is up. */
export const READ_AGAIN_MS = 500

export interface RoomVolumeHintProps {
  /** The phone's output; the registered native device's when not given. */
  output?: NativeAudioOutput
}

/**
 * Where the hint ends, in px from the right edge: at the room's controls in
 * the bar. Null leaves it to the stylesheet (no bar: a fixture, a test).
 */
function rightEdge(): number | null {
  const end = pushedBarEnd()
  if (end === null) return null
  const box = end.getBoundingClientRect()
  if (box.width === 0) return 12
  return Math.max(12, window.innerWidth - box.left + GAP_PX)
}

export const RoomVolumeHint: Component<RoomVolumeHintProps> = (props) => {
  const [hint, setHint] = createSignal<VolumeHint>(VOLUME_HINT_START)
  const [right, setRight] = createSignal<number | null>(null)
  const take = (reading: NativeAudioOutputReading): void => {
    setRight(rightEdge())
    setHint((last) => nextVolumeHint(last, reading))
  }
  // The room's controls come and go (none while a take runs), and the hint
  // ends where they begin.
  const remeasure = (): void => void setRight(rightEdge())
  window.addEventListener('resize', remeasure)
  const end = pushedBarEnd()
  const controls =
    end === null || typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(remeasure)
  if (end !== null)
    controls?.observe(end, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  onCleanup(() => {
    window.removeEventListener('resize', remeasure)
    controls?.disconnect()
  })

  // Read once, as the room opens: a room is not handed a new phone.
  // eslint-disable-next-line solid/reactivity -- read once, on mount
  const output = props.output ?? nativeDeviceApi()?.audioOutput
  if (output !== undefined) {
    let heard = 0
    let asking = false
    let open = true
    const stop = output.watch((reading) => {
      heard += 1
      take(reading)
    })
    const ask = (): void => {
      if (!open || asking) return
      asking = true
      const before = heard
      output.read().then(
        (reading) => {
          asking = false
          // A change heard meanwhile is newer than this answer, which is
          // then dropped.
          if (open && heard === before && reading !== null) take(reading)
        },
        () => {
          asking = false
        },
      )
    }
    ask()

    // A change can come with no word from the phone. iOS tells the app of
    // the volume through the app's own audio session, which the system ends
    // whenever it suspends the app and the app starts again only after a
    // call (docs/agent/MISTAKES.md); developers report that an inactive
    // session hears no change. Android says nothing when a stream is muted
    // or unmuted without its level moving. So while the hint is up, and
    // whenever the app comes back, the volume is read again.
    const inFront = (): boolean => document.visibilityState !== 'hidden'
    createEffect(() => {
      if (!hint().shown) return
      const timer = window.setInterval(() => {
        if (inFront()) ask()
      }, READ_AGAIN_MS)
      onCleanup(() => window.clearInterval(timer))
    })
    const back = (): void => {
      if (inFront()) ask()
    }
    document.addEventListener('visibilitychange', back)
    onCleanup(() => {
      open = false
      document.removeEventListener('visibilitychange', back)
      stop()
    })
  }

  return (
    <div
      class={styles.slot}
      style={right() === null ? undefined : { right: `${String(right())}px` }}
      role="status"
      data-testid="room-volume-slot"
    >
      <Show when={hint().shown}>
        <div
          class={styles.hint}
          data-testid="room-volume-hint"
          data-silent={hint().silent ? 'true' : 'false'}
        >
          <Show when={hint().silent} fallback={<VolumeLowIcon size={18} />}>
            <VolumeOffIcon size={18} />
          </Show>
          <span class={styles.words}>
            {hint().silent ? HINT_SILENT : HINT_LOW}
          </span>
        </div>
      </Show>
    </div>
  )
}
