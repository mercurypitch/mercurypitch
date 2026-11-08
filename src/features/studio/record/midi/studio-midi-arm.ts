// ============================================================
// Studio MIDI arm — a MIDI lane's arm: its port opened from the press, its lane's sound on the clock, and every note logged for the take
// ============================================================
//
// What a MIDI lane's arm opens in place of a microphone (the recorder asks
// for it first, StudioInstrumentHold), and never a microphone instead: a
// port that is gone refuses the arm in its own name, since recording the
// room in place of the keyboard is worse than not recording. MIDI is asked
// for inside the press, and the sound and the Piano room's port code load
// alongside it (studio-midi-sounds.ts), never with the page.
//
// The port is the Piano room's (web-midi-input-port.ts), one selected input
// at a time, and the notes' lifetimes, sustain pedal included, are its
// input state's (piano-input-state.ts). A note sounds at the clock time its
// message arrived, mapped from the event's timestamp onto the Studio's clock
// (performance-clock.ts); one already past sounds at once. The note is
// logged at the time its sound started and stopped, the same clock the take
// records on, so the notes and the audio line up. The player hears the
// sound through the lane's monitor whatever the monitoring switch says: a
// MIDI lane has no microphone to feed back.
import type { StudioLaneMidiInput } from '@/lib/studio/record/lane-inputs'
import type { StudioInputLostWords, StudioInstrumentHold, } from '@/lib/studio/record/recorder-types'
import type { StudioNoteLog } from '@/lib/studio/record/take-notes'
import { performanceToAudioSeconds } from '@/lib/timing/performance-clock'
import type { StudioMidiAccess, StudioMidiState } from './studio-midi-access'
import type { StudioMidiSound } from './studio-midi-sound'
import type { StudioMidiAttached, StudioMidiSounds } from './studio-midi-sounds'

/** The Piano room's port and input state, loaded with import(), never with the page. */
function importPortCode() {
  return Promise.all([
    import('@/features/piano/input/web-midi-input-port'),
    import('@/features/piano/input/piano-input-state'),
  ])
}

type PortCode = Awaited<ReturnType<typeof importPortCode>>
type PortOptions = Parameters<PortCode[0]['createWebMidiInputPort']>[0]
/** What the port hands on: a note, a pedal, a reset, or its goodbye. */
type PortEvent = Parameters<PortOptions['onInput']>[0]

/** Why a MIDI lane's arm was refused, in words for the armed lane's card. */
export class StudioMidiArmRefusal extends Error {
  constructor(readonly words: string) {
    super(words)
    this.name = 'StudioMidiArmRefusal'
  }
}

const ACCESS_WORDS: Partial<Record<StudioMidiState, string>> = {
  unsupported:
    "This browser can't use MIDI keyboards or pads, so it can't play a MIDI lane.",
  denied:
    "Studio may not use MIDI. Allow it in the browser's site settings, then arm the lane again.",
}
const ACCESS_FAILED = "Studio couldn't open MIDI. Arm the lane again."
const SOUND_FAILED =
  "Studio couldn't load the lane's sound. Check the connection, then arm the lane again."

/** What a MIDI lane says when its port goes: armed, mid-take, and before the take began. */
export function studioMidiLostWords(name: string): StudioInputLostWords {
  return {
    armed: `${name} was disconnected. Connect it, then arm again.`,
    midTake: `${name} was disconnected mid-take. Studio kept what was played up to then.`,
    beforeTake: `${name} was disconnected before the take began, so nothing was recorded. Connect it, then press Record again.`,
  }
}

export interface StudioMidiArmOptions {
  readonly input: StudioLaneMidiInput
  readonly sound: StudioMidiSound
  readonly access: StudioMidiAccess
  /** The Studio's sounds, loaded at the first MIDI arm. */
  sounds(): Promise<StudioMidiSounds>
  readonly log: StudioNoteLog
  /** The port went while the lane held it. */
  onLost(): void
  /** The performance clock, in ms; performance.now by default. */
  now?(): number
}

let portCode: Promise<PortCode> | null = null

function loadPortCode(): Promise<PortCode> {
  portCode ??= importPortCode()
  portCode.catch(() => {
    portCode = null
  })
  return portCode
}

/** The lane's port as the browser lists it now: by its id, else its name. */
function findPort(
  access: MIDIAccess,
  wanted: StudioLaneMidiInput,
): MIDIInput | null {
  const inputs = [...access.inputs.values()].filter(
    (input) => input.state !== 'disconnected',
  )
  return (
    inputs.find((input) => input.id === wanted.portId) ??
    inputs.find(
      (input) => wanted.label !== null && input.name === wanted.label,
    ) ??
    null
  )
}

/** Open a MIDI lane's port and sound for an arm; refused, in words, when MIDI or the port is not there. */
export async function openStudioMidiArm(
  options: StudioMidiArmOptions,
): Promise<StudioInstrumentHold> {
  const name = options.input.label ?? 'The MIDI input'
  const now = options.now ?? (() => performance.now())
  // Asked for inside the press; the sound and the port code load meanwhile.
  const asked = options.access.request()
  const loading = Promise.all([options.sounds(), loadPortCode()])
  loading.catch(() => undefined)
  const access = await asked
  if (access === null)
    throw new StudioMidiArmRefusal(
      ACCESS_WORDS[options.access.state()] ?? ACCESS_FAILED,
    )
  const port = findPort(access, options.input)
  if (port === null)
    throw new StudioMidiArmRefusal(`Connect ${name}, then arm again.`)
  let sounds: StudioMidiSounds
  let code: PortCode
  try {
    ;[sounds, code] = await loading
  } catch {
    throw new StudioMidiArmRefusal(SOUND_FAILED)
  }
  const [portModule, stateModule] = code

  const notes = stateModule.createPianoInputState()
  let playing: { context: AudioContext; sound: StudioMidiAttached } | null =
    null
  let released = false

  function play(event: PortEvent): void {
    if (event.type === 'source-disconnected' && !released) options.onLost()
    const update = notes.apply(event)
    if (playing === null) return
    const { context, sound } = playing
    // When its message arrived, on the Studio's clock; one past sounds now.
    const at = Math.max(
      context.currentTime,
      performanceToAudioSeconds(event.timestampMs, now(), context.currentTime),
    )
    for (const voice of update.soundingStarted) {
      sound.voice.start(
        voice.id,
        voice.midi,
        voice.velocity,
        at,
        voice.softPedalValue,
      )
      options.log.started(voice.id, voice.midi, voice.velocity, at)
    }
    for (const voice of update.soundingStopped) {
      sound.voice.stop(voice.id, at, voice.releaseVelocity)
      options.log.stopped(voice.id, at)
    }
  }

  const midi = portModule.createWebMidiInputPort({
    onInput: play,
    requestMIDIAccess: () => Promise.resolve(access),
    autoSelectFirst: false,
    now,
  })
  await midi.connect()
  if (!midi.selectInput(port.id)) {
    midi.dispose()
    throw new StudioMidiArmRefusal(`Connect ${name}, then arm again.`)
  }
  return {
    kind: 'instrument',
    play(context) {
      const sound = sounds.attach(options.sound, context)
      playing = { context, sound }
      return sound.node
    },
    connected: () => !released && midi.snapshot().connected,
    release() {
      if (released) return
      released = true
      // The port's own goodbye stops every note at the release.
      midi.dispose()
      playing?.sound.detach()
      playing = null
    },
  }
}
