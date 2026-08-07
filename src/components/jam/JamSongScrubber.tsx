// ── JamSongScrubber ───────────────────────────────────────────────────
// Where you are in the song, and (if you are the host) how to move.
//
// Deliberately not StemMixerTransport: that takes twenty-odd props
// spanning layout, mic, monitoring, stems and lyrics -- it is the mixer's
// whole control bar, and a jam room would drag all of it in for a
// progress line. This is the small self-contained piece.
//
// Only the host can seek. A guest still sees the position, because
// knowing where you are in the song is not a privilege, but a room with
// two people dragging the playhead is a room nobody can sing in. The
// guest gets the same slider marked aria-disabled rather than a
// progressbar: "a control you may not use" is the room's actual rule,
// and the host can change hands mid-song, so the element must not change
// type underneath a screen reader when it does.
//
// The bar used to carry a bare onClick. Tapping jumped; dragging did
// nothing at all, on a mouse or a finger. It now runs on the shared
// pointer drag gesture, which brings touch, pointer capture and the
// keyboard contract with it. While the pointer is down the bar previews
// and broadcasts NOTHING; release commits one seek. A jam seek is
// audible in every room in the session, so a drag that emitted per move
// would machine-gun everybody singing.

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import type { DragGestureOptions } from '@/components/shared/drag-gesture'
import { dragGesture } from '@/components/shared/drag-gesture'
import { formatClock } from '@/lib/format-time'
import styles from './JamSongScrubber.module.css'

interface JamSongScrubberProps {
  positionSec: () => number
  durationSec: () => number
  canSeek: boolean
  onSeek: (toSec: number) => void
}

export const JamSongScrubber: Component<JamSongScrubberProps> = (props) => {
  /** Non-null only while a pointer is down: what the bar SHOWS, which
   *  during a drag is the finger rather than the song. */
  const [scrubSec, setScrubSec] = createSignal<number | null>(null)
  let trackRef: HTMLDivElement | undefined

  const shownSec = () => scrubSec() ?? props.positionSec()

  const fraction = () => {
    const d = props.durationSec()
    if (d <= 0) return 0
    return Math.min(1, Math.max(0, shownSec() / d))
  }

  const secFromPointer = (event: PointerEvent): number => {
    const rect = trackRef?.getBoundingClientRect()
    if (rect === undefined || rect.width <= 0) return props.positionSec()
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    )
    return ratio * props.durationSec()
  }

  const drag: DragGestureOptions = {
    // A tap is a press and a release, so this is also the click path.
    onStart: (event) => setScrubSec(secFromPointer(event)),
    onEnd: (_event, reason) => {
      const to = scrubSec()
      setScrubSec(null)
      // pointercancel means the gesture was taken away -- a system swipe,
      // an incoming call. The room should not lurch because of that.
      if (reason === 'pointerup' && to !== null) props.onSeek(to)
    },
    slider: {
      getAriaLabel: () => 'Song position',
      getValue: () => Math.round(shownSec()),
      getMin: () => 0,
      getMax: () => Math.round(props.durationSec()),
      // Ten seconds a press: a song is minutes long, so single seconds
      // would take a hundred presses to cross a verse.
      getStep: () => 10,
      getPageStep: () => 30,
      getValueText: () => formatClock(shownSec()),
      getValueFromPointer: secFromPointer,
      isDisabled: () => !props.canSeek,
      onChange: (value) => props.onSeek(value),
      onPointerValue: setScrubSec,
    },
  }

  return (
    <div class={styles.scrubber}>
      {/* Reads the drag target mid-scrub, so you can see where you are
          about to drop the room before you let go. */}
      <span class={styles.time}>{formatClock(shownSec())}</span>
      <div
        ref={(element) => {
          trackRef = element
          dragGesture(element, () => drag)
        }}
        class={styles.track}
        classList={{
          [styles.trackSeekable]: props.canSeek,
          [styles.trackScrubbing]: scrubSec() !== null,
        }}
      >
        <div class={styles.fill} style={{ width: `${fraction() * 100}%` }} />
        <Show when={props.canSeek}>
          <div class={styles.knob} style={{ left: `${fraction() * 100}%` }} />
        </Show>
      </div>
      <span class={styles.time}>{formatClock(props.durationSec())}</span>
    </div>
  )
}
