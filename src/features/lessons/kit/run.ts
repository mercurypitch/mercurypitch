// ============================================================
// Lesson sound runs — a sung line, a tune or one note, each stoppable
// ============================================================
//
// A run is one sound in flight: a line sung along a contour (`playLine`),
// with a timbre if the caller brings one (kit/timbre.ts); a tune, note by
// note, each note its own voice (`playNotes`); or one note held for a moment
// (`playNote`); each in Merc's "ooh" unless the caller picks the soft tone.
// Lesson 7 plays its siren, "Twinkle" and its bands' notes this way (its
// WEB-SPEC, Audio). A run's visuals go on with the sound off, and its promise
// says whether it was heard to its end: true when it ended by itself, false
// when it was stopped, so a play cut short reveals nothing (kit/predict.ts).
// The page's one-sound owner (kit/now-playing.ts) calls a run's `stop`, never
// `Sound.stopAll`.

import { hz } from './notes'
import type { ContourPoint, Voice, VoiceOptions } from './sound'
import { contourLength, contourVoice, Sound } from './sound'

/** A note of a tune: when it starts, its MIDI note, and how long it lasts, seconds. */
export interface RunNote {
  readonly t: number
  readonly midi: number
  readonly dur: number
}

/** A sound in flight: `done` is true when it ended by itself, false when stopped. */
export interface Run {
  readonly done: Promise<boolean>
  stop(): void
}

export interface RunOptions {
  /** Decided once by the caller, so a run is all sound or all silent. */
  readonly audible: boolean
  readonly kind?: VoiceOptions['kind']
  readonly gain?: number
  readonly timbre?: VoiceOptions['timbre']
}

/** A run that ends by itself after `seconds`, unless stopped first. */
function timed(
  seconds: number,
  stopSound: () => void,
  timers: number[] = [],
): Run {
  let settle: (heard: boolean) => void = () => undefined
  let over = false
  const done = new Promise<boolean>((resolve) => {
    settle = resolve
  })
  const end = (heard: boolean): void => {
    if (over) return
    over = true
    timers.forEach((id) => window.clearTimeout(id))
    settle(heard)
  }
  timers.push(window.setTimeout(() => end(true), seconds * 1000))
  return {
    done,
    stop() {
      if (over) return
      stopSound()
      end(false)
    },
  }
}

/** A sung line along `points`; `stop` ends its voice within a short release. */
export function playLine(points: readonly ContourPoint[], o: RunOptions): Run {
  const v: Voice | null = o.audible
    ? contourVoice(points, { kind: o.kind ?? 'merc', timbre: o.timbre })
    : null
  return timed(contourLength(points), () => v?.stop(0.08))
}

/** A tune, note by note, each its own voice, ending with its last-ending note; `onNote` hears each as it starts. */
export function playNotes(
  notes: readonly RunNote[],
  o: RunOptions & { readonly onNote?: (n: RunNote, i: number) => void },
): Run {
  const timers: number[] = []
  const voices: Voice[] = []
  notes.forEach((n, i) => {
    timers.push(
      window.setTimeout(() => {
        if (o.audible) {
          const v = Sound.voice(hz(n.midi), {
            kind: o.kind ?? 'merc',
            dur: n.dur,
            gain: o.gain,
          })
          if (v !== null) voices.push(v)
        }
        o.onNote?.(n, i)
      }, n.t * 1000),
    )
  })
  // in a chord, or a list out of order, the note that ends last need not be listed last
  const length = notes.reduce((end, n) => Math.max(end, n.t + n.dur), 0)
  return timed(
    length,
    () => {
      voices.forEach((v) => v.stop(0.08))
    },
    timers,
  )
}

/** One note held for `seconds`. */
export function playNote(midi: number, seconds: number, o: RunOptions): Run {
  return playNotes([{ t: 0, midi, dur: seconds }], o)
}
