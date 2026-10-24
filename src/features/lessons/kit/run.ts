// ============================================================
// Lesson sound runs — a sung line, a tune, a chord or one note, each stoppable
// ============================================================
//
// A run is one sound in flight: a line sung along a contour (`playLine`),
// with a timbre if the caller brings one (kit/timbre.ts); a tune, note by
// note, each note its own voice (`playNotes`); or one note held for a moment
// (`playNote`); each in Merc's "ooh" unless the caller picks the soft tone,
// and a note may take a tone and a level of its own. Notes that share an
// onset start in one timer task, so a chord's voices read one `currentTime`
// and `onNote` hears them all in that task; even at time 0 it is never
// called before `playNotes` returns. Several runs that play as one (a move:
// two held notes and a line) are one run through `allOf`. Lesson 7 plays
// its siren, "Twinkle" and its bands' notes this way (its WEB-SPEC, Audio).
//
// A run's promise says whether it was heard to its end: true when it ended
// by itself, false when it was stopped, so a play cut short reveals nothing
// (kit/predict.ts). An audible run is also stopped when every sound stops:
// the Sound switch turned off, the hush of a microphone take, a hidden page.
// A silent run (`audible: false`) sounds nothing, so it goes on: its visuals
// run to its end, as they do with sound off. The page's one-sound owner
// (kit/now-playing.ts) calls a run's `stop`, never `Sound.stopAll`.
//
// Lesson 8's beat clock (kit/beat-clock.ts) has a `Run` and `RunOptions` of
// its own: there the audio clock books each hit ahead, here timers start each
// note and end the run, and both have `done` and `stop`, so a page's
// one-sound owner can hold either.

import { hz } from './notes'
import type { ContourPoint, Voice, VoiceOptions } from './sound'
import { contourLength, contourVoice, onStopAll, Sound } from './sound'

/** A note of a tune: when it starts, its MIDI note, and how long it lasts, seconds. */
export interface RunNote {
  readonly t: number
  readonly midi: number
  readonly dur: number
  /** Its tone, in place of the run's: a chord's soft voices under a tune in Merc's "ooh". */
  readonly kind?: VoiceOptions['kind']
  /** Its level, in place of the run's. */
  readonly gain?: number
}

/** A sound in flight: `done` is true when it ended by itself, false when stopped. */
export interface Run {
  readonly done: Promise<boolean>
  stop(): void
}

export interface RunOptions {
  /** Decided once by the caller, so a run is all sound or all silent. */
  readonly audible: boolean
  /** The tone, Merc's "ooh" by default, for each note without its own; every run honours it. */
  readonly kind?: VoiceOptions['kind']
  /** The level (kit/sound.ts's default when unset), for each note without its own; every run honours it. */
  readonly gain?: number
  /** Shapes a sung line (kit/timbre.ts): `playLine` honours it, `playNotes` and `playNote` ignore it. */
  readonly timbre?: VoiceOptions['timbre']
}

// The audible runs in flight, each stopped when every sound stops. One
// listener serves them all: `onStopAll` keeps each listener it is given for
// good, so one per run would pile up.
const sounding = new Set<Run>()
onStopAll(() => {
  sounding.forEach((r) => r.stop())
})

/** A run that ends by itself after `seconds`, unless stopped first. */
function timed(
  seconds: number,
  audible: boolean,
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
    sounding.delete(run)
    timers.forEach((id) => window.clearTimeout(id))
    settle(heard)
  }
  timers.push(window.setTimeout(() => end(true), seconds * 1000))
  const run: Run = {
    done,
    stop() {
      if (over) return
      stopSound()
      end(false)
    },
  }
  if (audible) sounding.add(run)
  return run
}

/** A sung line along `points`; `stop` ends its voice within a short release. */
export function playLine(points: readonly ContourPoint[], o: RunOptions): Run {
  const v: Voice | null = o.audible
    ? contourVoice(points, {
        kind: o.kind ?? 'merc',
        gain: o.gain,
        timbre: o.timbre,
      })
    : null
  return timed(contourLength(points), o.audible, () => v?.stop(0.08))
}

/** A tune, note by note, each its own voice, ending with its last-ending note; `onNote` hears each as it starts. */
export function playNotes(
  notes: readonly RunNote[],
  o: RunOptions & { readonly onNote?: (n: RunNote, i: number) => void },
): Run {
  const timers: number[] = []
  const voices: Voice[] = []
  // one timer task for each onset, its notes in the list's order
  const onsets = new Map<number, number[]>()
  notes.forEach((n, i) => {
    const at = onsets.get(n.t)
    if (at === undefined) onsets.set(n.t, [i])
    else at.push(i)
  })
  onsets.forEach((at, t) => {
    timers.push(
      window.setTimeout(() => {
        for (const i of at) {
          const n = notes[i]
          if (o.audible) {
            const v = Sound.voice(hz(n.midi), {
              kind: n.kind ?? o.kind ?? 'merc',
              dur: n.dur,
              gain: n.gain ?? o.gain,
            })
            if (v !== null) voices.push(v)
          }
          o.onNote?.(n, i)
        }
      }, t * 1000),
    )
  })
  // in a chord, or a list out of order, the note that ends last need not be listed last
  const length = notes.reduce((end, n) => Math.max(end, n.t + n.dur), 0)
  return timed(
    length,
    o.audible,
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

/**
 * Several runs started together, as one: true only if every part ended by
 * itself. Its `stop` stops them all, and a part cut short cuts the rest, so
 * the whole resolves false at once and nothing of it sounds on unowned.
 */
export function allOf(runs: readonly Run[]): Run {
  const stop = (): void => {
    runs.forEach((r) => r.stop())
  }
  const done = new Promise<boolean>((resolve) => {
    let left = runs.length
    if (left === 0) resolve(true)
    runs.forEach((r) => {
      void r.done.then((heard) => {
        if (!heard) {
          stop()
          resolve(false)
        } else if (--left === 0) resolve(true)
      })
    })
  })
  return { done, stop }
}
