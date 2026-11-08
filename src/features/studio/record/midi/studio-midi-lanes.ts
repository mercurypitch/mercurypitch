// ============================================================
// Studio MIDI lanes — the recorder hook's MIDI side: the Studio's one MIDI access, each MIDI lane's arm with a sound and a note log of its own, and its takes' notes kept beside their audio
// ============================================================
//
// useStudioRecorder hands the recorder an instrument for a MIDI lane
// (acquire, its acquireInstrument) and a microphone for any other lane. The
// lane's sound follows its instrument (studio-midi-sound.ts): the drum kit
// for drums and percussion, the piano for the rest. A MIDI lane needs no
// capture of the browser's, so any number of them can be armed beside the
// audio lanes, in any browser. Each plays a sound of its own, so its take
// holds only its own notes, and logs what it plays in a log of its own
// (take-notes.ts); a take that is kept keeps the notes played into it, on
// this device by the take's id. A port plays one lane at a time: a second
// lane armed on it is refused, in words that name the lane on it.
import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import { createStudioTakeNotesStore } from '@/db/services/studio-take-notes'
import { studioLaneInstrument } from '@/lib/studio/instruments/resolve'
import type { StudioProject } from '@/lib/studio/model/types'
import type { StudioLaneInput, StudioLaneMidiInput, } from '@/lib/studio/record/lane-inputs'
import { isMidiLaneInput } from '@/lib/studio/record/lane-inputs'
import type { StudioCapturedTake, StudioInputLostWords, StudioInstrumentHold, } from '@/lib/studio/record/recorder-types'
import type { StudioNoteLog } from '@/lib/studio/record/take-notes'
import { createStudioNoteLog, studioTakeNotes, } from '@/lib/studio/record/take-notes'
import { createStudioMidiAccess } from './studio-midi-access'
import { openStudioMidiArm, StudioMidiArmRefusal, studioMidiLostWords, } from './studio-midi-arm'
import type { StudioMidiSound } from './studio-midi-sound'
import { studioMidiSound, studioMidiSoundWords } from './studio-midi-sound'
import type { StudioMidiSounds } from './studio-midi-sounds'
import { createStudioMidiSounds, loadStudioMidiModules, } from './studio-midi-sounds'

/** A MIDI lane's arm: its port by name, the sound it plays, and the words that say so. */
export interface StudioMidiArmed {
  readonly port: string
  readonly sound: StudioMidiSound
  readonly words: string
}

interface LaneArm extends StudioMidiArmed {
  readonly input: StudioLaneMidiInput
}

export interface StudioMidiLanesOptions {
  readonly project: Accessor<StudioProject | null>
  /** A lane's own input, MIDI or audio. */
  laneInput(trackId: string): StudioLaneInput
  /** A lane's name, for the words. */
  laneName(trackId: string): string
  /** Lane `trackId`'s port went: the recorder ends that lane's arm or take in these words. */
  onLost(words: StudioInputLostWords, trackId: string): void
}

/** Whether two lanes' inputs are the one port: by its id, or by its name where the browser gave it a new id. */
function samePort(a: StudioLaneMidiInput, b: StudioLaneMidiInput): boolean {
  return a.portId === b.portId || (a.label !== null && a.label === b.label)
}

/** The words for a lane refused because another plays its port. */
export function studioPortTakenWords(
  port: string,
  playing: string,
  lane: string,
): string {
  return `${port} plays ${playing} already. A MIDI keyboard or pad plays one lane at a time: disarm ${playing}, or choose another input for ${lane}.`
}

export function createStudioMidiLanes(options: StudioMidiLanesOptions) {
  const access = createStudioMidiAccess()
  const notes = createStudioTakeNotesStore()
  // Each lane's log, kept past its arm until a take of it is kept.
  const logs = new Map<string, StudioNoteLog>()
  // The lanes armed now, or opening, by lane; the signal shows them.
  const arming = new Map<string, LaneArm>()
  const [arms, setArms] = createSignal<ReadonlyMap<string, LaneArm>>(new Map())
  let sounds: Promise<StudioMidiSounds> | null = null

  function loadSounds(): Promise<StudioMidiSounds> {
    const next = (sounds ??= loadStudioMidiModules().then(
      createStudioMidiSounds,
    ))
    next.catch(() => {
      if (sounds === next) sounds = null
    })
    return next
  }

  function forget(trackId: string, arm: LaneArm): void {
    if (arming.get(trackId) !== arm) return
    arming.delete(trackId)
    setArms(new Map(arming))
  }

  /** The recorder's acquireInstrument: a MIDI lane's arm, inside the press; null for a lane that records a microphone. */
  function acquire(
    trackId: string | null,
  ): Promise<StudioInstrumentHold> | null {
    const input = trackId === null ? null : options.laneInput(trackId)
    if (trackId === null || input === null || !isMidiLaneInput(input))
      return null
    const port = input.label ?? 'The MIDI input'
    for (const [other, arm] of arming)
      if (other !== trackId && samePort(arm.input, input))
        return Promise.reject(
          new StudioMidiArmRefusal(
            studioPortTakenWords(
              port,
              options.laneName(other),
              options.laneName(trackId),
            ),
          ),
        )
    const track = options.project()?.tracks.find((each) => each.id === trackId)
    const instrument = studioLaneInstrument(
      track ?? { name: '', role: 'other' },
    )
    const sound = studioMidiSound(instrument)
    const arm: LaneArm = {
      port,
      sound,
      words: studioMidiSoundWords(instrument),
      input,
    }
    arming.set(trackId, arm)
    setArms(new Map(arming))
    const log = createStudioNoteLog()
    logs.set(trackId, log)
    return openStudioMidiArm({
      input,
      sound,
      access,
      sounds: loadSounds,
      log,
      onLost: () => options.onLost(studioMidiLostWords(port), trackId),
    }).then(
      (hold) => ({
        ...hold,
        release: () => {
          hold.release()
          forget(trackId, arm)
        },
      }),
      (error: unknown) => {
        forget(trackId, arm)
        throw error
      },
    )
  }

  /** Keep the notes played into `take` beside its stored audio, from its own lane's log; a take with none keeps nothing. */
  async function keepNotes(take: StudioCapturedTake): Promise<void> {
    const song = options.project()
    const log = take.trackId === null ? undefined : logs.get(take.trackId)
    if (take.capturedFrom === undefined || song === null || log === undefined)
      return
    const played = studioTakeNotes(log.notes(), {
      heardFirst: take.heardFirst,
      capturedFrom: take.capturedFrom,
      seconds: take.samples.length / take.sampleRate,
    })
    if (played.length === 0) return
    // The audio is kept whatever happens to its notes.
    await notes.keep(song.id, take.id, played).catch(() => undefined)
  }

  /** Lane `trackId`'s MIDI arm, armed or opening; null for a lane that holds none. */
  function armed(trackId: string | null): StudioMidiArmed | null {
    if (trackId === null) return null
    return arms().get(trackId) ?? null
  }

  return {
    /** The Studio's MIDI access: its state and ports, and the ask from a press. */
    access,
    acquire,
    armed,
    keepNotes,
    dispose(): void {
      access.dispose()
      void sounds?.then((made) => made.dispose()).catch(() => undefined)
    },
  }
}

export type StudioMidiLanes = ReturnType<typeof createStudioMidiLanes>
