// Studio controller MIDI takes — a take recorded on a MIDI lane comes into the song with its sequence, in the edit that adds its clip, its clip keyed by its notes and sound so nothing renders until an edit; one undo takes both away. A render of edited notes is kept as a take is, swapped in without an undo step, skipped when the notes changed meanwhile, and kept when shorter than its clip's window, which is silent past it; undo and redo bring the notes back with the audio that matched them. New MIDI clips come in one undo step, a new lane with them, all playing one quarter second of silence kept as a recording with no name, and a lane the song does not have is refused as an import is.
import { createEffect, createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioAssetInfo } from '@/lib/studio/audio/prepare-studio-asset'
import { studioMidiRenderKey } from '@/lib/studio/midi/render-key'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioNote } from '@/lib/studio/model/types'
import { controllerServiceFixture, preparedFixture, } from './controller/controller.fixture'
import type { StudioController } from './useStudioController'
import { useStudioController } from './useStudioController'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

/** A recorded take of 4800 frames, a tenth of a second: 192 ticks at 120 bpm. */
const recordedFixture = async (blob: Blob, info: StudioAssetInfo) => {
  const data = preparedFixture(info)
  // A render arrives as a 16-bit WAV, its frames after a 44-byte header.
  const frames = blob.size > 44 ? (blob.size - 44) / 2 : 4800
  // Audio of another length is other audio: its hashes differ.
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

function mount(service = controllerServiceFixture()): StudioController {
  let serial = 0
  let controller!: StudioController
  createRoot((dispose) => {
    cleanups.push(dispose)
    controller = useStudioController({
      service,
      createId: () => `id-${++serial}`,
      prepareFile: recordedFixture,
    })
  })
  return controller
}

/** A song holding one MIDI take on the piano, its note then moved a beat later. */
async function editedTake() {
  const controller = mount()
  await controller.open('one')
  await controller.addRecording({
    wav: new Blob(['take'], { type: 'audio/wav' }),
    title: 'Take 1',
    startFrame: 9600,
    sourceInFrame: 1000,
    trackId: null,
    midi: { notes: NOTES, tempoBpm: 120, sound: 'piano' },
  })
  const take = controller.project()!.clips[0]
  controller.dispatch({
    type: 'set-sequence-notes',
    clipId: take.id,
    notes: [{ ...NOTES[0], startTick: 96 }],
    nextNoteId: 2,
    forkSequenceId: 'fork-1',
  })
  const sequence = controller.project()!.sequences![0]
  return { controller, take, key: studioMidiRenderKey(sequence, 'piano') }
}

const clipOf = (controller: StudioController) => controller.project()!.clips[0]

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

describe('a MIDI render kept in the Studio', () => {
  it('is kept as a recorded take, plays in its clip without an undo step, and undo and redo bring back the notes with the audio that matched them', async () => {
    // Arrange
    const { controller, take, key } = await editedTake()
    const label = controller.undoLabel()

    // Act
    const kept = await controller.keepMidiRender({
      samples: new Float32Array(9600),
      renderKey: key,
      title: 'Take 1',
    })
    const render = clipOf(controller)
    controller.undo()
    const undone = clipOf(controller)
    const undoneNotes = controller.project()!.sequences![0].notes
    controller.redo()

    // Assert
    const asset = controller.assets().find((each) => each.id === render.assetId)
    expect(kept).toBe(true)
    expect(render.assetId).not.toBe(take.assetId)
    expect(render.midi?.renderKey).toBe(key)
    expect(asset?.provenance.kind).toBe('recording')
    expect(asset?.originalName).toBe('Take 1.wav')
    expect(asset?.normalizedFrameCount).toBe(9600)
    expect(label).toBe('Undo edit notes')
    expect(undone.assetId).toBe(take.assetId)
    expect(undone.midi?.renderKey).toBe(take.midi?.renderKey)
    expect(undoneNotes).toEqual(NOTES)
    expect(clipOf(controller).assetId).toBe(render.assetId)
    expect(controller.travels()).toBe(2)
  })

  it('is skipped when the notes changed while it was kept, and its audio is not added', async () => {
    // Arrange
    const { controller, take, key } = await editedTake()
    const assets = controller.assets().length

    // Act
    const keeping = controller.keepMidiRender({
      samples: new Float32Array(9600),
      renderKey: key,
      title: 'Take 1',
    })
    controller.undo()
    const kept = await keeping

    // Assert
    expect(kept).toBe(false)
    expect(clipOf(controller).assetId).toBe(take.assetId)
    expect(controller.assets()).toHaveLength(assets)
  })

  it('is kept with no name when given none, as a clip drawn from scratch asks, so the clip goes on showing its lane’s', async () => {
    // Arrange: a clip drawn from scratch, a note then drawn in it.
    const controller = mount()
    await controller.open('one')
    const [clipId] = (await controller.addMidiClips([
      { lane: { name: 'Piano', role: 'piano' }, startFrame: 0, frames: 96_000 },
    ]))!
    controller.dispatch({
      type: 'set-sequence-notes',
      clipId,
      notes: NOTES,
      nextNoteId: 2,
      forkSequenceId: 'fork-1',
    })
    const sequence = controller.project()!.sequences![0]

    // Act
    const kept = await controller.keepMidiRender({
      samples: new Float32Array(9600),
      renderKey: studioMidiRenderKey(sequence, 'piano'),
    })

    // Assert
    const clip = controller.project()!.clips.find((each) => each.id === clipId)
    const asset = controller.assets().find((each) => each.id === clip?.assetId)
    expect(kept).toBe(true)
    expect(asset?.normalizedFrameCount).toBe(9600)
    expect(asset).not.toHaveProperty('originalName')
  })

  it("is kept when shorter than its clip's window, which is silent past it", async () => {
    // Arrange
    const { controller, take, key } = await editedTake()

    // Act
    const kept = await controller.keepMidiRender({
      samples: new Float32Array(2400),
      renderKey: key,
      title: 'Take 1',
    })

    // Assert
    const clip = clipOf(controller)
    const asset = controller.assets().find((each) => each.id === clip.assetId)
    expect(kept).toBe(true)
    expect(clip.assetId).not.toBe(take.assetId)
    expect(asset?.normalizedFrameCount).toBe(2400)
    expect(clip.sourceOutFrame).toBe(take.sourceOutFrame)
  })
})

/**
 * The clips the song names audio for that the asset list read beside it
 * does not hold, gathered every time either changes: what the transport and
 * the lane freezer read together. Playing, the transport refuses such a
 * pair with "Owned source is missing" and stops.
 */
function tornReads(controller: StudioController): string[] {
  const torn: string[] = []
  createRoot((dispose) => {
    cleanups.push(dispose)
    createEffect(() => {
      const owned = new Set(controller.assets().map((asset) => asset.id))
      for (const clip of controller.project()?.clips ?? [])
        if (!owned.has(clip.assetId)) torn.push(clip.id)
    })
  })
  return torn
}

describe('the song and its audio, as the workspace reads them', () => {
  it('change together when a render is kept, so no reader sees the clip on audio the list does not hold yet', async () => {
    // Arrange
    const { controller, key } = await editedTake()
    const torn = tornReads(controller)

    // Act
    const kept = await controller.keepMidiRender({
      samples: new Float32Array(9600),
      renderKey: key,
      title: 'Take 1',
    })

    // Assert
    expect(kept).toBe(true)
    expect(torn).toEqual([])
  })

  it('change together when new MIDI clips bring their silence', async () => {
    // Arrange
    const controller = mount()
    await controller.open('one')
    const torn = tornReads(controller)

    // Act
    const made = await controller.addMidiClips([
      { lane: { name: 'Drums', role: 'drums' }, startFrame: 0, frames: 96_000 },
    ])

    // Assert
    expect(made).toHaveLength(1)
    expect(torn).toEqual([])
  })

  it('change together when a song opens, so no reader sees its clips before the audio they play', async () => {
    // Arrange: a saved song with one clip on its one take.
    const { project, asset } = studioFixture()
    const service = controllerServiceFixture()
    vi.mocked(service.loadProject).mockResolvedValue({ ...project, id: 'one' })
    vi.mocked(service.listAssets).mockResolvedValue([asset])
    const controller = mount(service)
    const torn = tornReads(controller)

    // Act
    await controller.open('one')

    // Assert
    expect(controller.project()?.clips).toHaveLength(1)
    expect(torn).toEqual([])
  })
})

describe('new MIDI clips in the Studio', () => {
  it('come in one undo step, a new lane with them, playing a quarter second of silence kept once as a recording with no name', async () => {
    // Arrange
    const controller = mount()
    await controller.open('one')

    // Act
    const made = await controller.addMidiClips([
      {
        lane: { name: 'Piano', role: 'piano' },
        startFrame: 0,
        frames: 384_000,
      },
    ])
    const lane = controller.project()!.tracks[0]
    const more = await controller.addMidiClips([
      { lane: { trackId: lane.id }, startFrame: 384_000, frames: 384_000 },
    ])
    const song = controller.project()!
    const labels = [controller.undoLabel()]
    controller.undo()
    labels.push(controller.undoLabel())
    controller.undo()

    // Assert
    const silences = new Set(song.clips.map((clip) => clip.assetId))
    const silence = controller.assets().find((asset) => silences.has(asset.id))
    expect(made).toEqual([song.clips[0].id])
    expect(more).toEqual([song.clips[1].id])
    expect(silences.size).toBe(1)
    expect(silence?.normalizedFrameCount).toBe(12_000)
    expect(silence?.provenance.kind).toBe('recording')
    expect(silence).not.toHaveProperty('originalName')
    expect(song.sequences).toHaveLength(2)
    expect(labels).toEqual(['Undo add clip', 'Undo add lane'])
    expect(controller.project()?.tracks).toEqual([])
    expect(controller.project()).not.toHaveProperty('sequences')
  })

  it('add nothing on a lane the song does not have, and say why as an import does', async () => {
    // Arrange
    const controller = mount()
    await controller.open('one')

    // Act
    const made = await controller.addMidiClips([
      { lane: { trackId: 'gone' }, startFrame: 0, frames: 384_000 },
    ])

    // Assert
    expect(made).toBeNull()
    expect(controller.project()?.clips).toEqual([])
    expect(controller.importRefusal()).toMatch(/Lane does not exist/)
  })
})
