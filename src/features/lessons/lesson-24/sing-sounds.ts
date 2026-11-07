// ============================================================
// Lesson 24 Sing it's sounds — Merc's notes, the drone, and the listening play
// ============================================================
//
// Every sound of Sing it (WEB-SPEC, Toys 6; FACTS 70), straight, in Merc's
// "ooh" partials with no modulator: the singing Merc's note before each
// hold, alone, 2.0 s at Merc's level; the drone on do, under each hold and
// the quiet check, held until the take ends it, below Merc's level so the
// singer hears their own voice; the sing-along's drone, 5.0 s; and "Just
// listen today"'s play, each note alone for 2.0 s, then held with the drone
// for 5.0 s, both at the note level. Where the held note and the drone sound
// together they start in one task, on one audio time, so do over the drone,
// a unison, sounds whole (FACTS 44, 69).

import { hz } from '@/features/lessons/kit/notes'
import type { Run, RunLine } from '@/features/lessons/kit/run'
import { playLines } from '@/features/lessons/kit/run'
import type { Voice as Tone } from '@/features/lessons/kit/sound'
import { contourOf, Sound } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { Degree } from './sing-plan'
import { ALONG, doOf, DRONE_GAIN, MERC_GAIN, MODEL_SEC, noteOf, } from './sing-plan'
import { NOTE_GAIN } from './sounds'

/** "Just listen today"'s notes, in the order played. */
export const LISTEN_NOTES: readonly Degree[] = ['do', 'so', 'mi']
/** Seconds of each listening note: alone, then held with the drone. */
export const LISTEN = { alone: 2, held: 5 } as const
/** Seconds the listening play lasts: three notes. */
export const LISTEN_SEC = LISTEN_NOTES.length * (LISTEN.alone + LISTEN.held)

/** One straight voice on `midi` from `t`, held `sec` seconds. */
const held = (t: number, midi: number, sec: number): RunLine => ({
  t,
  points: contourOf(hz(midi), [{ hold: sec }]),
  vibrato: null,
})

/** The singing Merc's note before a hold, alone, straight, at Merc's level. */
export const startModel = (midi: number, audible: boolean): Run =>
  playLines([held(0, midi, MODEL_SEC)], {
    audible,
    kind: 'merc',
    gain: MERC_GAIN,
    vibrato: null,
  })

/** The drone on do, held until the take or the check stops it; null while sound cannot play. */
export const startDrone = (doMidi: number): Tone | null =>
  Sound.canPlay()
    ? Sound.voice(hz(doMidi), { kind: 'merc', gain: DRONE_GAIN, vibrato: null })
    : null

/** The sing-along's drone under the singer, 5.0 s. */
export const startAlongDrone = (doMidi: number, audible: boolean): Run =>
  playLines([held(0, doMidi, ALONG.drone)], {
    audible,
    kind: 'merc',
    gain: DRONE_GAIN,
    vibrato: null,
  })

/** "Just listen today"'s voices: each note alone, then that note and the drone from one onset. */
export function listenLines(v: Voice, move: number): RunLine[] {
  const doMidi = doOf(v, move)
  return LISTEN_NOTES.flatMap((d, i) => {
    const t = i * (LISTEN.alone + LISTEN.held)
    const midi = noteOf(v, move, d)
    return [
      held(t, midi, LISTEN.alone),
      held(t + LISTEN.alone, midi, LISTEN.held),
      held(t + LISTEN.alone, doMidi, LISTEN.held),
    ]
  })
}

/** Starts "Just listen today"'s play, every voice at the note level. */
export const startListen = (v: Voice, move: number, audible: boolean): Run =>
  playLines(listenLines(v, move), {
    audible,
    kind: 'merc',
    gain: NOTE_GAIN,
    vibrato: null,
  })
