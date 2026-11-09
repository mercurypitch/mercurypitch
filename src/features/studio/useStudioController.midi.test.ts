// Studio controller MIDI takes — a take recorded on a MIDI lane comes into the song with its sequence, in the edit that adds its clip, its clip keyed by its notes and sound so nothing renders until an edit; one undo takes both away.
import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import type { StudioAssetInfo } from '@/lib/studio/audio/prepare-studio-asset'
import { studioMidiRenderKey } from '@/lib/studio/midi/render-key'
import type { StudioNote } from '@/lib/studio/model/types'
import { controllerServiceFixture, preparedFixture, } from './controller/controller.fixture'
import type { StudioController } from './useStudioController'
import { useStudioController } from './useStudioController'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

/** A recorded take of 4800 frames, a tenth of a second: 192 ticks at 120 bpm. */
const recordedFixture = async (_blob: Blob, info: StudioAssetInfo) => {
  const data = preparedFixture(info)
  return {
    ...data,
    asset: {
      ...data.asset,
      normalizedFrameCount: 4800,
      canonicalPcmByteLength: 32 + 4800 * 4,
    },
    canonicalPcm: new Blob([new Uint8Array(32 + 4800 * 4)]),
  }
}

function mount(): StudioController {
  let serial = 0
  let controller!: StudioController
  createRoot((dispose) => {
    cleanups.push(dispose)
    controller = useStudioController({
      service: controllerServiceFixture(),
      createId: () => `id-${++serial}`,
      prepareFile: recordedFixture,
    })
  })
  return controller
}

const NOTES: StudioNote[] = [
  { id: 1, pitch: 60, startTick: 48, lengthTicks: 96, velocity: 0.7874 },
]

describe('a MIDI take kept in the Studio', () => {
  it('comes into the song with its sequence in the edit that adds its clip, keyed by its notes and sound, and one undo takes both away', async () => {
    // Arrange
    const controller = mount()
    await controller.open('one')

    // Act
    const kept = await controller.addRecording({
      wav: new Blob(['take'], { type: 'audio/wav' }),
      title: 'Take 1',
      startFrame: 9600,
      sourceInFrame: 1000,
      trackId: null,
      midi: { notes: NOTES, tempoBpm: 120, sound: 'drums' },
    })
    const song = controller.project()!
    const clip = song.clips[0]
    const sequence = song.sequences?.[0]
    const label = controller.undoLabel()
    controller.undo()

    // Assert
    expect(kept).toBe(true)
    expect(sequence).toEqual({
      id: clip.midi?.sequenceId,
      ppq: 960,
      tempoBpm: 120,
      lengthTicks: 192,
      nextNoteId: 2,
      notes: NOTES,
    })
    expect(clip.midi?.renderKey).toBe(studioMidiRenderKey(sequence!, 'drums'))
    expect(label).toBe('Undo add take')
    expect(controller.project()?.clips).toEqual([])
    expect(controller.project()).not.toHaveProperty('sequences')
  })

  it("keeps a microphone's take as an audio clip, with no sequence", async () => {
    // Arrange
    const controller = mount()
    await controller.open('one')

    // Act
    await controller.addRecording({
      wav: new Blob(['take'], { type: 'audio/wav' }),
      title: 'Take 1',
      startFrame: 9600,
      sourceInFrame: 1000,
      trackId: null,
    })

    // Assert
    expect(controller.project()?.clips[0]).not.toHaveProperty('midi')
    expect(controller.project()).not.toHaveProperty('sequences')
  })
})
