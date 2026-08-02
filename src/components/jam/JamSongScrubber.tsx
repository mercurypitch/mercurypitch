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
// two people dragging the playhead is a room nobody can sing in.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { formatClock } from '@/lib/format-time'
import styles from './JamSongScrubber.module.css'

interface JamSongScrubberProps {
  positionSec: () => number
  durationSec: () => number
  canSeek: boolean
  onSeek: (toSec: number) => void
}

export const JamSongScrubber: Component<JamSongScrubberProps> = (props) => {
  const fraction = () => {
    const d = props.durationSec()
    if (d <= 0) return 0
    return Math.min(1, Math.max(0, props.positionSec() / d))
  }

  const seekFromEvent = (e: MouseEvent) => {
    if (!props.canSeek) return
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    props.onSeek(ratio * props.durationSec())
  }

  return (
    <div class={styles.scrubber}>
      <span class={styles.time}>{formatClock(props.positionSec())}</span>
      <div
        class={styles.track}
        classList={{ [styles.trackSeekable]: props.canSeek }}
        onClick={seekFromEvent}
        role={props.canSeek ? 'slider' : 'progressbar'}
        aria-label="Song position"
        aria-valuemin={0}
        aria-valuemax={Math.round(props.durationSec())}
        aria-valuenow={Math.round(props.positionSec())}
        tabindex={props.canSeek ? 0 : -1}
        onKeyDown={(e) => {
          if (!props.canSeek) return
          // Ten seconds a press: a song is minutes long, so single seconds
          // would take a hundred presses to cross a verse.
          const step =
            e.key === 'ArrowLeft' ? -10 : e.key === 'ArrowRight' ? 10 : 0
          if (step === 0) return
          e.preventDefault()
          const next = Math.min(
            props.durationSec(),
            Math.max(0, props.positionSec() + step),
          )
          props.onSeek(next)
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
