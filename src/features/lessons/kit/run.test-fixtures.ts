// ============================================================
// Lesson sound run test fixtures — the tunes, the voices heard, and sound on
// ============================================================
//
// Shared by kit/run.test.ts (a run heard to its end, or stopped where it
// stands) and kit/run-chords.test.ts (chords, a note's own tone and level,
// runs joined as one, and every sound stopping). A tune's voices are heard
// through a spy on `Sound.voice` (`listen`); a sung line's voice is built for
// real on the fake AudioContext the sound tests use (`soundOn`,
// sound-doubles.test-fixtures.ts).

import { vi } from 'vitest'
import { hz } from './notes'
import type * as RunKit from './run'
import type { Run, RunNote } from './run'
import { playLine, playNote, playNotes } from './run'
import type { Voice } from './sound'
import { contourOf, Sound } from './sound'
import { FakeContext } from './sound-doubles.test-fixtures'

/** The release a stop gives each voice, seconds: the kit's short release, as kit/tune-line.ts's stop uses. */
export const SHORT_RELEASE = 0.08

/** A two-note tune: C4 for half a second, then D4 for a second, 1.5 s in all. */
export const TUNE: readonly RunNote[] = [
  { t: 0, midi: 60, dur: 0.5 },
  { t: 0.5, midi: 62, dur: 1 },
]

/** A chord: C3 held for 2 s under an E3 of half a second, listed last, so the list's last note ends first. */
export const CHORD: readonly RunNote[] = [
  { t: 0, midi: 48, dur: 2 },
  { t: 0, midi: 52, dur: 0.5 },
]

/** A sung line: A3 held for a second, then a glide up to C4 over a second, 2 s in all. */
export const LINE = contourOf(220, [{ hold: 1 }, { glide: 1, to: hz(60) }])

/** Each kind of run, silent, and how long it lasts, milliseconds. */
export const RUNS: readonly { kind: string; start: () => Run; ms: number }[] = [
  {
    kind: 'a sung line',
    start: () => playLine(LINE, { audible: false }),
    ms: 2000,
  },
  {
    kind: 'a tune',
    start: () => playNotes(TUNE, { audible: false }),
    ms: 1500,
  },
  {
    kind: 'one note',
    start: () => playNote(57, 0.75, { audible: false }),
    ms: 750,
  },
]

/** What a run's promise has said so far: nothing while it runs. */
export function outcome(run: Run): { heard?: boolean } {
  const seen: { heard?: boolean } = {}
  void run.done.then((heard) => {
    seen.heard = heard
  })
  return seen
}

/** A voice a run started: its MIDI note, and the release of each stop it was given. */
export interface HeardVoice {
  readonly midi: number
  readonly stops: (number | undefined)[]
}

/** Every voice a run starts from now on, in order, heard through a spy on `Sound.voice`. */
export function listen(): HeardVoice[] {
  const heard: HeardVoice[] = []
  vi.spyOn(Sound, 'voice').mockImplementation((freq: number) => {
    const v: HeardVoice = {
      midi: Math.round(69 + 12 * Math.log2(freq / 440)),
      stops: [],
    }
    heard.push(v)
    const voice: Voice = {
      alive: true,
      setFreq: () => undefined,
      setGain: () => undefined,
      stop: (release?: number) => {
        v.stops.push(release)
      },
    }
    return voice
  })
  return heard
}

/**
 * Sound on, as after a first tap, in fresh run and sound modules, so the
 * context they make is the fake one stubbed in; the caller's afterEach
 * unstubs it (`vi.unstubAllGlobals`).
 */
export async function soundOn(): Promise<{
  runs: typeof RunKit
  slack: number
  ctx: FakeContext
}> {
  vi.resetModules()
  FakeContext.last = null
  vi.stubGlobal('AudioContext', FakeContext)
  const kit = await import('./sound')
  const runs = await import('./run')
  kit.Sound.set('on')
  const ctx = FakeContext.last as FakeContext | null
  if (ctx === null) throw new Error('no context was made')
  return { runs, slack: kit.SLACK, ctx }
}
