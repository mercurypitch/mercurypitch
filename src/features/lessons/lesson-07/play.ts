// ============================================================
// Lesson 7 sounds — Merc's siren, "Twinkle" and one note, each stoppable
// ============================================================
//
// Every sound on the page is one of these runs (WEB-SPEC, Audio): Merc's
// siren, a glide in Merc's "ooh" that follows the siren's path, in its
// pressed sound (kit/timbre.ts); "Twinkle", note by note; or one note held
// for a moment, a band's middle note in the soft tone or the push note in
// Merc's "ooh" at one quiet level. A run's visuals go on with the sound off,
// and its promise says whether it was heard to its end: true when it ended
// by itself, false when it was stopped, so a play cut short reveals
// nothing (kit/predict.ts). The page's one-sound owner
// (kit/now-playing.ts) calls a run's `stop`, never `Sound.stopAll`.

import { hz } from '@/features/lessons/kit/notes'
import type { ContourPoint, Voice, VoiceOptions, } from '@/features/lessons/kit/sound'
import { contourLength, contourVoice, Sound, } from '@/features/lessons/kit/sound'
import type { TuneNote } from './range-data'

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

/** A tune, note by note, each its own voice; `onNote` hears each as it starts. */
export function playNotes(
  notes: readonly TuneNote[],
  o: RunOptions & { readonly onNote?: (n: TuneNote, i: number) => void },
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
  const last = notes[notes.length - 1]
  const length = last === undefined ? 0 : last.t + last.dur
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
