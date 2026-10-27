// ============================================================
// startSingDemo — Merc sings through the Sing tab, for one tour stop
// ============================================================
//
// A stop of Merc's "Show me more" tour (sing-more-tour.ts) runs one of these
// while it shows (coach-types.ts, CoachStepRun). It plays the Sing tab as the
// singer would, through the host App lends (sing-demo-host.ts), and while it
// runs the tab draws Merc's line where it draws the mic's:
//
// - What he sings. The singer's own melody, when a stop of it lasts 8 to 20
//   seconds; else a short one of the app's, do to sol in the singer's key at
//   their octave, a second a note at their tempo (whole beats). Nothing is
//   written to the library: the transport plays it from `singDemo().melody`.
// - The stops. 'repeat' plays it twice round in Repeat, one note a little
//   flat the first time and on it the second. 'rests' plays it once with a
//   half rest after each note (Spaced rest), and the rests are silent.
// - His line and his voice are one contour (contourCents): a small scoop
//   into each note and a vibrato that grows in, on the note the transport
//   plays. The frame loop draws it at the transport's beat; the voice
//   (lib/demo-audio.ts, playVoiceContour) starts with each of the
//   transport's notes, on the app's audio context, so what is heard is what
//   is drawn. The tab's guide note plays under him as it does for a singer.
// - Nothing is kept. While it runs the tab scores nothing and records
//   nothing (App reads `singDemo()`); the mic is never asked for, and a mic
//   already on stays on, its line paused.
// - Put back. Stopping (the stop going, however it goes, the page hidden)
//   silences him with the voice's release, resets the transport as a tab
//   change does (Merc's line goes with it), and puts back the play mode,
//   repeat cycles and round, Spaced rest and the A-B loop.
//
// The lines are drafts for the copy pass.

import { createSignal } from 'solid-js'
import type { CoachStepRun } from '@/lib/coach-types'
import type { DemoSound, VoicePoint } from '@/lib/demo-audio'
import { playVoiceContour } from '@/lib/demo-audio'
import { midiToFreq, midiToNote } from '@/lib/scale-data'
import type { MelodyItem, PitchResult } from '@/types'
import type { SingDemoHost } from './sing-demo-host'
import { setSingDemo, singDemoHost } from './sing-demo-host'

export type SingDemoKind = 'repeat' | 'rests'

/** How far the first round's one wrong note sits under its bar, in cents. */
export const FLAT_CENTS = -60
/** The scoop into each note: from this many cents under, over SCOOP_SEC. */
const SCOOP_CENTS = -35
const SCOOP_SEC = 0.12
/** His vibrato, grown in over each note's first rampSec. */
export const DEMO_VIBRATO = { hz: 5.2, cents: 14, rampSec: 0.35 }
/** The voice's points, this far apart, in seconds. */
const VOICE_STEP = 0.025
/** His voice's level against the app's own volume. */
const VOICE_LEVEL = 0.9
/** Do re mi fa sol, in semitones from the tonic. */
const SHORT_SCALE = [0, 2, 4, 5, 7] as const
/** A stop of the singer's own melody must last this long, in seconds. */
const OWN_MIN_SEC = 8
const OWN_MAX_SEC = 20
/** Beats of rest a half Spaced rest adds after each note but the last (App). */
const HALF_REST_BEATS = 2

/** What Merc says while he sings. Drafts. */
export const DEMO_LINES = {
  repeatFirst: 'Round 1 of 2: Merc sings one note flat, under its bar.',
  repeatSecond: 'Round 2 of 2: every note sits on its bar.',
  rests: 'Merc sings each note, then rests. The rests stay silent.',
  again: 'Press Play to hear Merc again.',
} as const

/**
 * The cents of his line `t` seconds into a note, from the note itself:
 * `offset` (a flat note's), the scoop in, and the vibrato. The voice plays
 * the offset and the scoop as its points and the vibrato as its own sine,
 * which starts at the same phase, so the two agree.
 */
export function contourCents(t: number, offset: number): number {
  const into = Math.max(0, t)
  const scoop = into < SCOOP_SEC ? SCOOP_CENTS * (1 - into / SCOOP_SEC) ** 2 : 0
  const depth = DEMO_VIBRATO.cents * Math.min(1, into / DEMO_VIBRATO.rampSec)
  return offset + scoop + depth * Math.sin(2 * Math.PI * DEMO_VIBRATO.hz * into)
}

/** The voice's points for a note `sec` long: the scoop, held, and let go. */
export function voicePoints(sec: number, offset: number): VoicePoint[] {
  const points: VoicePoint[] = []
  const steps = Math.max(2, Math.round(sec / VOICE_STEP))
  for (let i = 0; i <= steps; i++) {
    const t = (sec * i) / steps
    const scoop = t < SCOOP_SEC ? SCOOP_CENTS * (1 - t / SCOOP_SEC) ** 2 : 0
    const level = Math.min(1, t / 0.05, (sec - t) / 0.08)
    points.push({ t, cents: offset + scoop, level: Math.max(0, level) })
  }
  return points
}

const sung = (items: readonly MelodyItem[]): MelodyItem[] =>
  items.filter((item) => item.isRest !== true)

const beatsOf = (items: readonly MelodyItem[]): number =>
  items.reduce((end, item) => Math.max(end, item.startBeat + item.duration), 0)

/** How long the stop `kind` would take over `items` at `bpm`, in seconds. */
export function stopSeconds(
  kind: SingDemoKind,
  items: readonly MelodyItem[],
  bpm: number,
): number {
  const beats =
    kind === 'repeat'
      ? beatsOf(items) * 2
      : beatsOf(items) + Math.max(0, items.length - 1) * HALF_REST_BEATS
  return (beats * 60) / bpm
}

/** Do to sol from `tonicMidi`, each note a whole number of beats near a second. */
export function shortScale(tonicMidi: number, bpm: number): MelodyItem[] {
  const beats = Math.max(1, Math.round(bpm / 60))
  return SHORT_SCALE.map((step, i) => {
    const midi = tonicMidi + step
    const { name, octave } = midiToNote(midi)
    return {
      id: -300000 - i,
      note: { midi, name, octave, freq: midiToFreq(midi) },
      startBeat: i * beats,
      duration: beats,
    }
  })
}

/** What Merc sings for `kind`: the singer's melody if a stop of it fits, else the short scale. */
export function demoMelody(
  kind: SingDemoKind,
  host: Pick<SingDemoHost, 'melody' | 'melodyKind' | 'tonicMidi' | 'bpm'>,
): MelodyItem[] {
  const own = host.melody()
  const plain = sung(own)
  const seconds = stopSeconds(kind, own, host.bpm())
  const fits =
    host.melodyKind() === 'melody' &&
    plain.length >= 3 &&
    plain.length === own.length &&
    seconds >= OWN_MIN_SEC &&
    seconds <= OWN_MAX_SEC
  return fits
    ? own.map((item) => ({ ...item }))
    : shortScale(host.tonicMidi(), host.bpm())
}

/** A pitch as the detector would report it, for the canvas and its marker. */
function pitchResult(
  freq: number,
  cents: number,
  target: MelodyItem,
): PitchResult {
  const midi = 69 + 12 * Math.log2(freq / 440)
  const { name, octave } = midiToNote(midi)
  const targetName = `${target.note.name}${target.note.octave}`
  return {
    freq,
    frequency: freq,
    midi,
    note: `${name}${octave}`,
    noteName: name,
    targetMidi: target.note.midi,
    targetNote: targetName,
    cents,
    clarity: 1,
    octave,
  }
}

const IDLE: CoachStepRun = {
  pose: () => null,
  said: () => '',
  stop: () => undefined,
}

/**
 * Starts Merc singing the stop `kind` through the Sing tab, and returns the
 * run its tour step holds. With no Sing tab to lend (another tab, or a build
 * without one), nothing starts.
 */
export function startSingDemo(
  kind: SingDemoKind,
  host: SingDemoHost | null = singDemoHost(),
): CoachStepRun {
  if (host === null || !host.onSingTab()) return IDLE
  const runtime = host.playbackRuntime
  const before = {
    mode: host.playMode(),
    cycles: host.repeatCycles(),
    round: host.currentRepeat(),
    rest: host.spacedRestMode(),
    loop: host.loop(),
  }
  const [stopped, setStopped] = createSignal(false)
  let voice: DemoSound | null = null
  let out: GainNode | null = null

  host.reset()
  const melody = demoMelody(kind, host)
  const notes = sung(melody)
  const flatId =
    kind === 'repeat' ? notes[Math.floor(notes.length / 2)]?.id : undefined
  // The first round's one flat note; every other note, and the second round, on it.
  const offsetOf = (item: MelodyItem): number =>
    item.id === flatId && host.currentRepeat() === 1 ? FLAT_CENTS : 0

  const pitchAt = (beat: number): PitchResult | null => {
    if (beat < 0) return null
    const item = runtime
      .getMelody()
      .find(
        (each) =>
          each.isRest !== true &&
          beat >= each.startBeat &&
          beat < each.startBeat + each.duration,
      )
    if (item === undefined) return null
    const t = ((beat - item.startBeat) * 60) / runtime.getBPM()
    const cents = contourCents(t, offsetOf(item))
    return pitchResult(item.note.freq * 2 ** (cents / 1200), cents, item)
  }

  const outTo = (ctx: AudioContext): GainNode => {
    if (out === null || out.context !== ctx) {
      out = ctx.createGain()
      out.connect(ctx.destination)
    }
    out.gain.value = VOICE_LEVEL * host.audioEngine.getVolume()
    return out
  }

  const onNoteStart = (e: { note: MelodyItem }): void => {
    if (e.note.isRest === true) return
    const ctx = host.audioEngine.getAudioContext()
    if (ctx === null || ctx.state === 'closed') return
    voice?.stop()
    const sec = (e.note.duration * 60) / runtime.getBPM()
    voice = playVoiceContour(ctx, voicePoints(sec, offsetOf(e.note)), {
      hz: e.note.note.freq,
      destination: outTo(ctx),
      vibrato: DEMO_VIBRATO,
    })
  }
  // Paused or stopped by the singer: his voice goes with the guide note.
  const onState = (state: { state?: string } | string): void => {
    const now = typeof state === 'string' ? state : state.state
    if (now === 'playing') return
    voice?.stop()
    voice = null
  }

  const stop = (): void => {
    if (stopped()) return
    setStopped(true)
    runtime.off('noteStart', onNoteStart)
    runtime.off('state', onState)
    document.removeEventListener('visibilitychange', onHidden)
    voice?.stop()
    voice = null
    // While the demo is still on, so the reset scores and keeps nothing.
    host.reset()
    setSingDemo(null)
    host.setPlayMode(before.mode)
    host.setRepeatCycles(before.cycles)
    host.setCurrentRepeat(before.round)
    host.setSpacedRestMode(before.rest)
    host.setLoop(before.loop)
    const last = out
    out = null
    // after the voice's release, which still runs through it
    if (last !== null) setTimeout(() => last.disconnect(), 600)
  }

  function onHidden(): void {
    if (document.visibilityState === 'hidden') stop()
  }

  setSingDemo({ melody, pitchAt })
  host.setLoop({ ...before.loop, enabled: false })
  if (kind === 'repeat') {
    // the tab's PLAYBACK_MODE_REPEAT and _ONCE, by their values (PlaybackMode)
    host.setPlayMode('repeat')
    host.setRepeatCycles(2)
    host.setCurrentRepeat(1)
  } else {
    host.setPlayMode('once')
    host.setSpacedRestMode('half')
  }
  runtime.on('noteStart', onNoteStart)
  runtime.on('state', onState)
  document.addEventListener('visibilitychange', onHidden)
  host.play()

  const singing = (): boolean => !stopped() && host.isPlaying()
  return {
    pose: () => (singing() ? 'sing' : null),
    said: () => {
      if (stopped()) return ''
      if (!host.isPlaying()) return DEMO_LINES.again
      if (kind === 'rests') return DEMO_LINES.rests
      return host.currentRepeat() === 1
        ? DEMO_LINES.repeatFirst
        : DEMO_LINES.repeatSecond
    },
    stop,
  }
}
