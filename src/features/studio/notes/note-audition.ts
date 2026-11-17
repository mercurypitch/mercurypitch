// ============================================================
// Studio note audition — a note the editor touches sounds through its lane's own instrument, the one the lane's MIDI arm plays, on the Studio's clock
// ============================================================
//
// The piano or the drum kit of record/midi/studio-midi-sounds.ts, loaded
// when the editor opens and never before. The clock is the Studio's own,
// the transport's: a press makes or resumes it inside the gesture (prime),
// so a note sounds before the song was ever played. A note sounds short and
// at once, and the one before it stops as it starts, so a drag across rows
// plays a line rather than a pile. The instruments shape their own attack
// and release, so nothing clicks; the drum kit's hits end on their own.
// The roll's keys sound through it too (note-roll-keys.ts), which learn
// when a key's sound starts, to light the key, and stop it when a finger
// on a key pans instead.
import type { StudioMidiSound } from '../record/midi/studio-midi-sound'
import type { StudioMidiAttached, StudioMidiSounds, } from '../record/midi/studio-midi-sounds'
import { createStudioMidiSounds, loadStudioMidiModules, } from '../record/midi/studio-midi-sounds'

/** How long an auditioned note holds, in seconds. */
export const NOTE_AUDITION_SECONDS = 0.28
/** Its level into the speakers: a preview, under the song's own. */
const LEVEL = 0.8

/** The Studio's clock, as the transport lends it. */
export interface StudioNoteAuditionClock {
  clock(): AudioContext | null
  /** Make or resume the clock: inside a press, where a browser lets audio start. */
  unlock(): Promise<boolean>
}

interface Attached {
  readonly context: AudioContext
  readonly kind: StudioMidiSound
  readonly sound: StudioMidiAttached
  readonly output: GainNode
}

export function createStudioNoteAudition(options: {
  readonly clock: StudioNoteAuditionClock
  sound(): StudioMidiSound
  /** The sound modules, the Studio's own unless a test hands others. */
  load?(): Promise<StudioMidiSounds>
}) {
  let library: Promise<StudioMidiSounds> | null = null
  let attached: Attached | null = null
  let last: string | null = null
  let count = 0
  let disposed = false
  // A stop's count: a note asked for before the latest stop never starts.
  let stops = 0

  function load(): Promise<StudioMidiSounds> {
    const next = (library ??=
      options.load?.() ?? loadStudioMidiModules().then(createStudioMidiSounds))
    next.catch(() => {
      if (library === next) library = null
    })
    return next
  }

  function release(): void {
    attached?.sound.detach()
    attached?.output.disconnect()
    attached = null
    last = null
  }

  /** The lane's sound on the clock, attached once and again when the clock or the sound changes. */
  function voice(sounds: StudioMidiSounds): Attached | null {
    const context = options.clock.clock()
    if (context === null) return null
    const kind = options.sound()
    if (attached?.context === context && attached.kind === kind) return attached
    release()
    const sound = sounds.attach(kind, context)
    const output = context.createGain()
    output.gain.value = LEVEL
    sound.node.connect(output)
    output.connect(context.destination)
    attached = { context, kind, sound, output }
    return attached
  }

  return {
    /** Start loading the instruments, without a sound: when the editor opens. */
    warm(): void {
      void load().catch(() => undefined)
    },
    /** Inside a press: make or resume the clock, so the press's note can sound. */
    prime(): void {
      void options.clock.unlock().catch(() => false)
      void load().catch(() => undefined)
    },
    /**
     * Sound `pitch` at `velocity`, 0 to 1, for a moment; the note before it
     * stops. Resolves true once it sounds on the clock, and false when it
     * cannot: no clock, the editor gone, the sound not loaded, or a stop
     * asked for since.
     */
    play(pitch: number, velocity: number): Promise<boolean> {
      const asked = stops
      return load()
        .then((sounds) => {
          if (disposed || asked !== stops) return false
          const playing = voice(sounds)
          if (playing === null) return false
          const now = playing.context.currentTime
          if (last !== null) playing.sound.voice.stop(last, now, 0.5)
          count += 1
          last = `audition-${count}`
          playing.sound.voice.start(last, pitch, velocity, now, 0)
          playing.sound.voice.stop(last, now + NOTE_AUDITION_SECONDS, 0.5)
          return true
        })
        .catch(() => false)
    },
    /** The note sounding stops now, and a note still loading never starts: a finger's press on a key that turned into a pan. */
    stop(): void {
      stops += 1
      if (attached !== null && last !== null)
        attached.sound.voice.stop(last, attached.context.currentTime, 0.5)
      last = null
    },
    dispose(): void {
      disposed = true
      release()
    },
  }
}

export type StudioNoteAudition = ReturnType<typeof createStudioNoteAudition>
