// ============================================================
// Studio MIDI lanes — the recorder hook's MIDI side: the Studio's one MIDI access, a MIDI lane's arm, and its takes' notes kept beside their audio
// ============================================================
//
// useStudioRecorder hands the recorder an instrument for a MIDI lane
// (acquire, its acquireInstrument) and a microphone for any other lane. The
// lane's sound follows its instrument (studio-midi-sound.ts): the drum kit
// for drums and percussion, the piano for the rest. Every note the armed
// lane plays is logged (take-notes.ts), and a take that is kept keeps the
// ones played into it, on this device by the take's id. Which MIDI lane is
// armed, if one is, says that no microphone is held: the mic icon stays
// off, and the shared microphone's comings and goings are not its own.
import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import { createStudioTakeNotesStore } from '@/db/services/studio-take-notes'
import { studioLaneInstrument } from '@/lib/studio/instruments/resolve'
import type { StudioProject } from '@/lib/studio/model/types'
import type { StudioLaneInput } from '@/lib/studio/record/lane-inputs'
import { isMidiLaneInput } from '@/lib/studio/record/lane-inputs'
import type { StudioCapturedTake, StudioInputLostWords, StudioInstrumentHold, } from '@/lib/studio/record/recorder-types'
import { createStudioNoteLog, studioTakeNotes, } from '@/lib/studio/record/take-notes'
import { createStudioMidiAccess } from './studio-midi-access'
import { openStudioMidiArm, studioMidiLostWords } from './studio-midi-arm'
import type { StudioMidiSound } from './studio-midi-sound'
import { studioMidiSound, studioMidiSoundWords } from './studio-midi-sound'
import type { StudioMidiSounds } from './studio-midi-sounds'
import { createStudioMidiSounds, loadStudioMidiModules, } from './studio-midi-sounds'

/** The MIDI lane an arm opened: its port by name, the sound it plays, and the words that say so. */
export interface StudioMidiArmed {
  readonly port: string
  readonly sound: StudioMidiSound
  readonly words: string
}

export interface StudioMidiLanesOptions {
  readonly project: Accessor<StudioProject | null>
  /** A lane's own input, MIDI or audio. */
  laneInput(trackId: string): StudioLaneInput
  /** The armed lane's port went: the recorder ends the arm or the take in these words. */
  onLost(words: StudioInputLostWords): void
}

export function createStudioMidiLanes(options: StudioMidiLanesOptions) {
  const access = createStudioMidiAccess()
  const log = createStudioNoteLog()
  const notes = createStudioTakeNotesStore()
  const [armed, setArmed] = createSignal<StudioMidiArmed | null>(null)
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

  /** The recorder's acquireInstrument: a MIDI lane's arm, inside the press; null for a lane that records a microphone. */
  function acquire(
    trackId: string | null,
  ): Promise<StudioInstrumentHold> | null {
    const input = trackId === null ? null : options.laneInput(trackId)
    if (input === null || !isMidiLaneInput(input)) {
      setArmed(null)
      return null
    }
    const track = options.project()?.tracks.find((each) => each.id === trackId)
    const instrument = studioLaneInstrument(
      track ?? { name: '', role: 'other' },
    )
    const sound = studioMidiSound(instrument)
    const port = input.label ?? 'The MIDI input'
    setArmed({ port, sound, words: studioMidiSoundWords(instrument) })
    return openStudioMidiArm({
      input,
      sound,
      access,
      sounds: loadSounds,
      log,
      onLost: () => options.onLost(studioMidiLostWords(port)),
    })
  }

  /** Keep the notes played into `take` beside its stored audio; a take with none keeps nothing. */
  async function keepNotes(take: StudioCapturedTake): Promise<void> {
    const song = options.project()
    if (take.capturedFrom === undefined || song === null) return
    const played = studioTakeNotes(log.notes(), {
      heardFirst: take.heardFirst,
      capturedFrom: take.capturedFrom,
      seconds: take.samples.length / take.sampleRate,
    })
    if (played.length === 0) return
    // The audio is kept whatever happens to its notes.
    await notes.keep(song.id, take.id, played).catch(() => undefined)
  }

  return {
    /** The Studio's MIDI access: its state and ports, and the ask from a press. */
    access,
    acquire,
    /** The MIDI lane the last arm opened; null when it opened a microphone. */
    armed,
    keepNotes,
    dispose(): void {
      access.dispose()
      void sounds?.then((made) => made.dispose()).catch(() => undefined)
    },
  }
}

export type StudioMidiLanes = ReturnType<typeof createStudioMidiLanes>
