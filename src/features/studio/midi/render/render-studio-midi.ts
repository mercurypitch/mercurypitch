// ============================================================
// Studio MIDI render — a sequence's notes rendered offline through its lane's own sound, as the 48 kHz mono audio its clip plays
// ============================================================
//
// A MIDI clip plays audio rendered from its notes: the notes are the
// source, and the audio is a cache of them. The render builds the lane's
// sound with the functions a live arm builds it with (studio-midi-sounds.ts),
// on an OfflineAudioContext, and plays the notes through it.
//
//   LEVEL — a take records the sound's own node at unity, folded to one
//   channel by the capture's settings (capture-input.ts). The render folds
//   that node the same way, so a rendered clip is as loud as a take of the
//   same notes. Every gain between the instruments and that node is the
//   instruments' own.
//
//   TIME — frame 0 is tick 0, ticks are the song's (STUDIO_PPQ, through
//   midi/time.ts, which holds every tick and frame conversion), and each
//   note starts on its nearest whole frame (whole-frame.ts). Its sound
//   begins its instrument's own delay after that, as it does in a take (the
//   piano's limiter looks 6 ms ahead), so a render lines up where the take
//   it replaces did.
//
//   PRE-ROLL — a new DynamicsCompressorNode starts about 17 dB down and
//   needs about 300 ms to settle (studio-fx/render.ts), and the grand's tone
//   and room glide to their settings as it is built. The render runs half a
//   second of silence first and cuts it, so the first note sounds as a live
//   arm's settled sound plays it: without it, a synth note at tick 0 peaked
//   2.1 dB lower in its first 100 ms (Chrome 153).
//
//   SCHEDULING — the notes are scheduled as the render reaches them, four
//   seconds ahead (scheduled-render.ts): scheduled whole, a long take
//   renders dozens of times slower. The instruments are built `offline`,
//   without the voice caps that would steal notes scheduled ahead.
//
//   ENGINE — the kit plays a drum lane: Mercury Synth, which downloads
//   nothing. A piano lane plays the sampled grand when its samples for
//   every note load within a timeout (8 s by default; the browser's cache
//   serves them again), and the synth otherwise, and the render says which.
//   A note beyond the grand's 88 keys plays on the synth, as it does live;
//   a take whose samples overflow the grand's decoded budget plays the synth.
//
//   WINDOW — a note starting at or after `lengthTicks` is not heard, and one
//   still held there is released there; the tail lets it ring out.
//
// An abort stops the scheduling and silences what was scheduled. The render
// settles before the abort is reported, and holds its memory until then.
import type { StudioMidiModules, StudioMidiVoice, } from '@/features/studio/record/midi/studio-midi-sounds'
import { buildStudioDrumSound, buildStudioPianoSound, loadStudioMidiModules, } from '@/features/studio/record/midi/studio-midi-sounds'
import { reserveStudioMemory } from '@/lib/studio/memory-budget'
import type { StudioMidiSoundKind } from '@/lib/studio/midi/render-key'
import { studioTicksToFrames } from '@/lib/studio/midi/time'
import type { StudioNote } from '@/lib/studio/model/types'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import type { StudioRenderSchedule } from '@/lib/studio/playback/scheduled-render'
import { renderAsScheduled } from '@/lib/studio/playback/scheduled-render'
import { frameTime } from '@/lib/studio/playback/whole-frame'
import { STUDIO_CAPTURE_INPUT } from '@/lib/studio/record/capture-input'

/** One note of a sequence, as the song keeps it: a sequence's notes pass as they are. */
export type StudioMidiRenderNote = Pick<
  StudioNote,
  'pitch' | 'startTick' | 'lengthTicks' | 'velocity' | 'releaseVelocity'
>

/** What played a render's notes: the sampled grand, the piano's synth, or the drum kit. */
export type StudioMidiRenderEngine = 'grand' | 'synth' | 'kit'

export interface StudioMidiRenderDeps {
  /** The sound modules, loaded with import(); `loadStudioMidiModules` by default. */
  readonly loadModules?: () => Promise<StudioMidiModules>
  /** A fresh offline clock; `new OfflineAudioContext` by default. */
  readonly createContext?: (
    options: OfflineAudioContextOptions,
  ) => OfflineAudioContext
  /** How long the grand's samples may take to load before the synth plays instead, in ms; 8000 by default. */
  readonly grandTimeoutMs?: number
}

/** A sequence's notes and time, in the song's ticks (STUDIO_PPQ), and the sound its lane plays. */
export interface StudioMidiRenderInput {
  readonly notes: readonly StudioMidiRenderNote[]
  /** The tempo the sequence's ticks were laid on. */
  readonly tempoBpm: number
  /** The sequence's length: no note starting from here on is heard. */
  readonly lengthTicks: number
  readonly sound: StudioMidiSoundKind
  /** How long the render runs past `lengthTicks` for releases to ring: 1.5 s for the piano and 0.8 s for the drums by default. */
  readonly tailSeconds?: number
  readonly signal?: AbortSignal
  readonly deps?: StudioMidiRenderDeps
}

export interface StudioMidiRender {
  /** Mono, 48 kHz: frame 0 is tick 0. */
  readonly samples: Float32Array
  readonly frames: number
  readonly engine: StudioMidiRenderEngine
}

/** The silence a render runs first and cuts, for its limiters to settle. */
const PRE_ROLL_FRAMES = STUDIO_SAMPLE_RATE / 2
const TAIL_SECONDS: Readonly<Record<StudioMidiSoundKind, number>> = {
  piano: 1.5,
  drums: 0.8,
}
const GRAND_TIMEOUT_MS = 8000
/** How a note that keeps no release velocity is released: the song model's reading of its absence. */
const RELEASE_VELOCITY = 0.5
const KIT_FAILED = "Studio couldn't start the drum kit for this render."

/** A note on the render's clock, in seconds. */
interface ClockNote {
  readonly id: string
  readonly pitch: number
  readonly velocity: number
  readonly releaseVelocity: number
  readonly start: number
  readonly end: number
}

/** The lane's sound, ready on the render's clock: its node, its notes, what plays them, and how it goes. */
interface ReadySound {
  readonly bus: GainNode
  readonly voice: StudioMidiVoice
  readonly engine: StudioMidiRenderEngine
  dispose(): void
}

type StudioPianoSound = ReturnType<typeof buildStudioPianoSound>

const positive = (value: number) => Number.isFinite(value) && value > 0
const nonNegative = (value: number) => Number.isFinite(value) && value >= 0

/** The tail a render runs past its sequence; a timing it cannot place is refused. */
function renderTail(input: StudioMidiRenderInput): number {
  if (!positive(input.tempoBpm))
    throw new RangeError('A MIDI render needs a positive tempo.')
  if (!nonNegative(input.lengthTicks))
    throw new RangeError("A MIDI render's length can't be negative.")
  const tail = input.tailSeconds ?? TAIL_SECONDS[input.sound]
  if (!nonNegative(tail))
    throw new RangeError("A MIDI render's tail can't be negative.")
  return tail
}

/** The nearest whole frame of the render to tick `ticks`. */
function frameOf(input: StudioMidiRenderInput, ticks: number): number {
  return Math.round(studioTicksToFrames(ticks, input.tempoBpm))
}

/** When frame `frame` of the render plays on its clock, after the pre-roll. */
function clockTime(frame: number): number {
  return frameTime(PRE_ROLL_FRAMES + frame, STUDIO_SAMPLE_RATE)
}

/** A note the render plays: it starts inside the sequence, and it has a length and a velocity. */
function heard(note: StudioMidiRenderNote, lengthTicks: number): boolean {
  return (
    Number.isFinite(note.pitch) &&
    note.startTick >= 0 &&
    note.startTick < lengthTicks &&
    note.lengthTicks > 0 &&
    note.velocity > 0
  )
}

/** The notes the render plays, in the order they start, on its clock; one held past the sequence's end is released there. */
function clockNotes(input: StudioMidiRenderInput): ClockNote[] {
  return input.notes
    .filter((note) => heard(note, input.lengthTicks))
    .map((note) => {
      const start = frameOf(input, note.startTick)
      const until = Math.min(
        note.startTick + note.lengthTicks,
        input.lengthTicks,
      )
      return { note, start, end: Math.max(frameOf(input, until), start + 1) }
    })
    .sort((a, b) => a.start - b.start)
    .map(({ note, start, end }, index) => ({
      id: `n${index}`,
      pitch: note.pitch,
      velocity: note.velocity,
      releaseVelocity: note.releaseVelocity ?? RELEASE_VELOCITY,
      start: clockTime(start),
      end: clockTime(end),
    }))
}

/** Each note started and stopped through `voice` as the render nears it. */
function noteSchedule(
  voice: StudioMidiVoice,
  notes: readonly ClockNote[],
): StudioRenderSchedule {
  let next = 0
  return {
    scheduleUntil(time) {
      for (; next < notes.length && notes[next].start < time; next += 1) {
        const note = notes[next]
        voice.start(note.id, note.pitch, note.velocity, note.start, 0)
        voice.stop(note.id, note.end, note.releaseVelocity)
      }
    },
  }
}

async function readyDrums(
  modules: StudioMidiModules,
  context: OfflineAudioContext,
): Promise<ReadySound> {
  const sound = buildStudioDrumSound(modules, context, { offline: true })
  if (await sound.kit.activate()) return { ...sound, engine: 'kit' }
  sound.dispose()
  throw new Error(KIT_FAILED)
}

/** Whether the grand holds its samples for `pitches` within `timeoutMs`: not when time runs out, a sample fails, or no pitch is one of its keys. */
async function grandLoads(
  grand: StudioPianoSound['grand'],
  pitches: readonly number[],
  timeoutMs: number,
  signal: AbortSignal,
): Promise<boolean> {
  const loads = new AbortController()
  const stop = () => loads.abort()
  signal.addEventListener('abort', stop, { once: true })
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<false>((resolve) => {
    timer = setTimeout(() => {
      stop()
      resolve(false)
    }, timeoutMs)
  })
  const loaded = grand.prewarm(pitches, loads.signal).then(
    () => grand.getLoadSnapshot().playable,
    () => false,
  )
  try {
    return await Promise.race([loaded, late])
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', stop)
  }
}

async function readyPiano(
  modules: StudioMidiModules,
  context: OfflineAudioContext,
  notes: readonly ClockNote[],
  timeoutMs: number,
  signal: AbortSignal,
): Promise<ReadySound> {
  const sound = buildStudioPianoSound(modules, context, { offline: true })
  try {
    const pitches = notes.map((note) => note.pitch)
    const grand = await grandLoads(sound.grand, pitches, timeoutMs, signal)
    // Every note the grand has a key for plays on it; the router keeps the rest on the synth.
    if (grand) sound.router.setPreference('auto')
    return { ...sound, engine: grand ? 'grand' : 'synth' }
  } catch (error) {
    sound.dispose()
    throw error
  }
}

/** Play `notes` through `sound` as a take's capture hears it, and keep the `frames` after the pre-roll. */
async function playThrough(
  context: OfflineAudioContext,
  sound: ReadySound,
  notes: readonly ClockNote[],
  frames: number,
  signal: AbortSignal,
): Promise<StudioMidiRender> {
  // An abort while the sound got ready is an abort, not a reason to play the synth.
  signal.throwIfAborted()
  const fold = context.createGain()
  Object.assign(fold, STUDIO_CAPTURE_INPUT)
  sound.bus.connect(fold)
  fold.connect(context.destination)
  // An abort leaves the rest of the render nothing to pull.
  const silence = () => sound.bus.disconnect()
  signal.addEventListener('abort', silence, { once: true })
  try {
    const rendered = await renderAsScheduled(
      context,
      noteSchedule(sound.voice, notes),
      context.length / STUDIO_SAMPLE_RATE,
      signal,
    )
    signal.throwIfAborted()
    const samples = rendered
      .getChannelData(0)
      .slice(PRE_ROLL_FRAMES, PRE_ROLL_FRAMES + frames)
    return { samples, frames: samples.length, engine: sound.engine }
  } finally {
    signal.removeEventListener('abort', silence)
  }
}

function offlineContext(
  options: OfflineAudioContextOptions,
): OfflineAudioContext {
  return new OfflineAudioContext(options)
}

/**
 * Render `notes` through the lane's sound: 48 kHz mono, `lengthTicks` and a
 * tail long, frame 0 on tick 0. Refuses a timing it cannot place, and a
 * render too big for the Studio's memory.
 */
export async function renderStudioMidi(
  input: StudioMidiRenderInput,
): Promise<StudioMidiRender> {
  const tail = renderTail(input)
  const signal = input.signal ?? new AbortController().signal
  signal.throwIfAborted()
  const deps = input.deps ?? {}
  const frames =
    frameOf(input, input.lengthTicks) + Math.round(tail * STUDIO_SAMPLE_RATE)
  const length = PRE_ROLL_FRAMES + frames
  if (!Number.isSafeInteger(length))
    throw new RangeError('This MIDI clip is too long to render.')
  const modules = await (deps.loadModules ?? loadStudioMidiModules)()
  signal.throwIfAborted()
  // The render's buffer, and the samples kept from it.
  const release = reserveStudioMemory((length + frames) * 4)
  try {
    const context = (deps.createContext ?? offlineContext)({
      numberOfChannels: 1,
      length,
      sampleRate: STUDIO_SAMPLE_RATE,
    })
    const notes = clockNotes(input)
    const sound =
      input.sound === 'drums'
        ? await readyDrums(modules, context)
        : await readyPiano(
            modules,
            context,
            notes,
            deps.grandTimeoutMs ?? GRAND_TIMEOUT_MS,
            signal,
          )
    try {
      return await playThrough(context, sound, notes, frames, signal)
    } finally {
      sound.dispose()
    }
  } finally {
    release()
  }
}
