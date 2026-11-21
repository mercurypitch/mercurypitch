// Studio MIDI renders in the workspace — with the real controller: edit, keep, undo, redo, and at each step the transport's song plays audio made from the notes the song holds, and every audio it names reads; the lane's notice is the latest said.
import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioAssetInfo } from '@/lib/studio/audio/prepare-studio-asset'
import { StudioRefusal } from '@/lib/studio/failure-copy'
import { studioMidiRenderKey } from '@/lib/studio/midi/render-key'
import type { StudioNote } from '@/lib/studio/model/types'
import { controllerServiceFixture, preparedFixture, } from '../controller/controller.fixture'
import type { StudioController } from '../useStudioController'
import { useStudioController } from '../useStudioController'
import { studioMidiPreviewId } from './midi-preview-audio'
import { fakeRenderer } from './midi-render.fixture'
import { useStudioMidiRenders } from './useStudioMidiRenders'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

const NOTES: StudioNote[] = [
  { id: 1, pitch: 60, startTick: 48, lengthTicks: 96, velocity: 0.7874 },
]

/** Prepared audio as long as its WAV, each length its own audio. */
async function prepared(blob: Blob, info: StudioAssetInfo) {
  const data = preparedFixture(info)
  const frames = blob.size > 44 ? (blob.size - 44) / 2 : 4800
  const hash = frames.toString(16).padStart(64, '0')
  return {
    ...data,
    asset: {
      ...data.asset,
      sha256: hash,
      canonicalPcmSha256: hash,
      normalizedFrameCount: frames,
      canonicalPcmByteLength: 32 + frames * 4,
    },
    canonicalPcm: new Blob([new Uint8Array(32 + frames * 4)]),
  }
}

/** The fixture's storage, keeping each saved take's audio to read back. */
function storage() {
  const service = controllerServiceFixture()
  const saved = new Map<string, Blob>()
  const save = service.saveProject
  service.saveProject = vi.fn(async (project, token, prepared) => {
    for (const data of prepared) saved.set(data.asset.id, data.canonicalPcm)
    return save(project, token, prepared)
  })
  service.readCanonicalAsset = vi.fn(async (_projectId, assetId) => {
    const blob = saved.get(assetId)
    if (blob === undefined) throw new Error('No saved audio')
    return blob
  })
  return service
}

async function mount() {
  let serial = 0
  let controller!: StudioController
  let midi!: ReturnType<typeof useStudioMidiRenders>
  const renderer = fakeRenderer()
  createRoot((dispose) => {
    cleanups.push(dispose)
    controller = useStudioController({
      service: storage(),
      createId: () => `id-${++serial}`,
      prepareFile: prepared,
    })
    midi = useStudioMidiRenders(
      () => controller,
      () => controller.writable(),
      {
        render: renderer.render,
        previewDelayMs: 0,
        travelDelayMs: 0,
      },
    )
  })
  await controller.open('one')
  await controller.addRecording({
    wav: new Blob(['take'], { type: 'audio/wav' }),
    title: 'Take 1',
    startFrame: 9600,
    sourceInFrame: 1000,
    trackId: null,
    midi: { notes: NOTES, tempoBpm: 120, sound: 'piano' },
  })
  // Renders finish at once, a quarter of full scale, 9600 frames long.
  renderer.render.mockImplementation(async () => ({
    samples: new Float32Array(9600).fill(0.25),
    frames: 9600,
    engine: 'synth',
  }))
  return { controller, midi, renderer }
}

describe('MIDI renders on the open song', () => {
  it('plays audio made from the notes the song holds after an edit, a keep, an undo and a redo, and reads each', async () => {
    // Arrange
    const { controller, midi } = await mount()
    const take = controller.project()!.clips[0]
    // What each audio was made from: the take from its notes, a preview
    // from its id's key, a kept render from the key it was kept under.
    const madeFrom = new Map([[take.assetId, take.midi!.renderKey]])
    const heard = () => {
      const clip = midi.project()!.clips[0]
      return clip.assetId.startsWith('midi-render-')
        ? clip.assetId.slice('midi-render-'.length)
        : madeFrom.get(clip.assetId)
    }
    const notes = () =>
      studioMidiRenderKey(controller.project()!.sequences![0], 'piano')
    const reads = async () =>
      (await midi.readCanonicalAsset(midi.project()!.clips[0].assetId)).size
    const steps: Record<string, { heard?: string; notes: string }> = {}

    // Act
    steps.recorded = { heard: heard(), notes: notes() }
    controller.dispatch({
      type: 'set-sequence-notes',
      clipId: take.id,
      notes: [{ ...NOTES[0], pitch: 64 }],
      nextNoteId: 2,
      forkSequenceId: 'fork-1',
    })
    await vi.waitFor(() =>
      expect(midi.project()!.clips[0].assetId).toBe(
        studioMidiPreviewId(notes()),
      ),
    )
    steps.edited = { heard: heard(), notes: notes() }
    const previewBytes = await reads()
    await midi.editor.editorClosed()
    const kept = controller.project()!.clips[0]
    madeFrom.set(kept.assetId, kept.midi!.renderKey)
    steps.kept = { heard: heard(), notes: notes() }
    const keptBytes = await reads()
    controller.undo()
    steps.undone = { heard: heard(), notes: notes() }
    controller.redo()
    steps.redone = { heard: heard(), notes: notes() }

    // Assert
    for (const step of Object.values(steps)) expect(step.heard).toBe(step.notes)
    expect(steps.undone.notes).toBe(steps.recorded.notes)
    expect(steps.redone.notes).toBe(steps.edited.notes)
    expect(kept.assetId).not.toBe(take.assetId)
    expect(controller.undoLabel()).toBe('Undo edit notes')
    expect(previewBytes).toBe(32 + 9600 * 4)
    expect(keptBytes).toBe(32 + 9600 * 4)
  })

  it('says on the timeline the latest notice: a failed render after a take that missed its lane', async () => {
    // Arrange
    const { controller, midi, renderer } = await mount()
    renderer.render.mockImplementation(async () => {
      throw new StudioRefusal(
        "Studio couldn't start the drum kit for this render.",
      )
    })
    const take = controller.project()!.clips[0]

    // Act
    controller.dispatch({
      type: 'set-sequence-notes',
      clipId: take.id,
      notes: [{ ...NOTES[0], pitch: 64 }],
      nextNoteId: 2,
      forkSequenceId: 'fork-1',
    })

    // Assert
    await vi.waitFor(() =>
      expect(midi.notice()?.text).toContain(
        "Studio couldn't start the drum kit for this render.",
      ),
    )
    expect(midi.project()!.clips[0].assetId).toBe(take.assetId)
  })
})
