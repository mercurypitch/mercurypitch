// Studio MIDI render fixtures — a song with a MIDI clip, a renderer that finishes when the test says, and the render service on them, with its own key cache and failure count.
import { createRoot, createSignal } from 'solid-js'
import { vi } from 'vitest'
import { createStudioMidiKeys } from '@/lib/studio/midi/clip-keys'
import { applyStudioCommand } from '@/lib/studio/model/commands'
import { studioMidiFixture, TEST_NOW, } from '@/lib/studio/model/model.test-fixtures'
import type { StudioAsset, StudioNote, StudioProject, } from '@/lib/studio/model/types'
import type { StudioRenderImport } from '../controller/imports'
import type { StudioMidiRenderService, StudioMidiRenderServiceOptions, } from './midi-render-service'
import { createStudioMidiRenderFailures, createStudioMidiRenderService, } from './midi-render-service'
import type { StudioMidiRender, StudioMidiRenderInput, } from './render/render-studio-midi'

/** Frames of every fake render: 2.5 s, past the fixture clip's two-second take. */
export const RENDER_FRAMES = 120_000

export interface FakeRenderCall {
  readonly input: StudioMidiRenderInput
  /** Finish with every sample at `level`. */
  resolve(level?: number): void
  reject(error: unknown): void
}

/** A renderer whose renders finish when the test says; an abort rejects one at once. */
export function fakeRenderer() {
  const calls: FakeRenderCall[] = []
  const render = vi.fn(
    (input: StudioMidiRenderInput) =>
      new Promise<StudioMidiRender>((resolve, reject) => {
        input.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Render aborted', 'AbortError')),
          { once: true },
        )
        calls.push({
          input,
          resolve: (level = 0.25) =>
            resolve({
              samples: new Float32Array(RENDER_FRAMES).fill(level),
              frames: RENDER_FRAMES,
              engine: 'synth',
            }),
          reject,
        })
      }),
  )
  return { render, calls }
}

/** The fixture's assets, for commands on its song. */
export const MIDI_OPTIONS = {
  assets: studioMidiFixture().assets,
  now: TEST_NOW,
}

/** `project` with its MIDI clip's notes changed by `change`: an edit the editor commits. */
export function editNotes(
  project: StudioProject,
  change: (note: StudioNote) => StudioNote,
  clipId = 'clip-midi',
): StudioProject {
  const clip = project.clips.find((each) => each.id === clipId)!
  const sequence = project.sequences!.find(
    (each) => each.id === clip.midi!.sequenceId,
  )!
  return applyStudioCommand(
    project,
    {
      type: 'set-sequence-notes',
      clipId,
      notes: sequence.notes.map(change),
      nextNoteId: sequence.nextNoteId,
      forkSequenceId: `fork-${clipId}`,
    },
    MIDI_OPTIONS,
  )
}

/** A note a semitone higher. */
export const up = (note: StudioNote): StudioNote => ({
  ...note,
  pitch: note.pitch + 1,
})

/** The render service on the fixture's song, or on `start`. */
export function renderServiceFixture(
  start?: StudioProject,
  over: Partial<StudioMidiRenderServiceOptions> = {},
) {
  const fixture = studioMidiFixture()
  const [project, setProject] = createSignal<StudioProject | null>(
    start ?? fixture.project,
  )
  const [assets, setAssets] = createSignal<readonly StudioAsset[]>(
    fixture.assets,
  )
  const [travels, setTravels] = createSignal(0)
  const renderer = fakeRenderer()
  const kept: StudioRenderImport[] = []
  const keep = vi.fn(async (render: StudioRenderImport) => {
    kept.push(render)
    return true
  })
  const failures = createStudioMidiRenderFailures()
  let service!: StudioMidiRenderService
  const dispose = createRoot((dispose) => {
    service = createStudioMidiRenderService({
      project,
      assets,
      keep,
      travels,
      render: renderer.render,
      keys: createStudioMidiKeys(),
      failures,
      now: () => new Date(TEST_NOW),
      ...over,
    })
    return dispose
  })
  return {
    service,
    fixture,
    project,
    setProject,
    setAssets,
    setTravels,
    renderer,
    keep,
    kept,
    failures,
    dispose,
  }
}

/** The asset the transport plays for clip `clipId`. */
export function playedAsset(
  service: StudioMidiRenderService,
  clipId = 'clip-midi',
): string | undefined {
  return service.snapshot()?.project.clips.find((clip) => clip.id === clipId)
    ?.assetId
}
