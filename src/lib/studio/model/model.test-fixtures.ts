// Studio model fixtures — small owned sources and deterministic project revisions for pure tests, with and without a MIDI clip.
import { studioMidiRenderKey } from '../midi/render-key'
import { createStudioProject, createStudioTrack } from './defaults'
import type { StudioAsset, StudioClip, StudioProject, StudioSequence, } from './types'

export const TEST_NOW = '2026-10-26T12:00:00.000Z'

export function studioFixture(): {
  project: StudioProject
  asset: StudioAsset
  clip: StudioClip
} {
  const asset: StudioAsset = {
    id: 'asset-1',
    projectId: 'project-1',
    sha256: 'a'.repeat(64),
    mimeType: 'audio/wav',
    byteLength: 2044,
    channels: 1,
    normalizedSampleRate: 48000,
    normalizedFrameCount: 1000,
    importVersion: 1,
    canonicalPcmId: 'pcm-1',
    canonicalPcmSha256: 'b'.repeat(64),
    canonicalPcmByteLength: 4032,
    preparation: { algorithmVersion: 'bs1770-48k-v1', gainDb: 3 },
    provenance: {
      kind: 'guitar-night',
      sourceId: 'guitar-take:kept-1',
      importedAt: TEST_NOW,
    },
  }
  const clip: StudioClip = {
    id: 'clip-1',
    trackId: 'track-1',
    assetId: asset.id,
    startFrame: 100,
    sourceInFrame: 0,
    sourceOutFrame: 1000,
    gainDb: -6,
    fades: {
      curve: 'linear-amplitude',
      in: { fromSourceFrame: 0, toSourceFrame: 200 },
      out: { fromSourceFrame: 800, toSourceFrame: 1000 },
    },
  }
  const project = {
    ...createStudioProject({
      id: 'project-1',
      title: 'First song',
      now: TEST_NOW,
    }),
    tracks: [
      createStudioTrack({
        id: 'track-1',
        name: 'Guitar',
        order: 0,
        role: 'acoustic-guitar',
      }),
    ],
    clips: [clip],
  }
  return { project, asset, clip }
}

/**
 * studioFixture's song with a MIDI clip beside its audio one: a Keys lane
 * playing a recorded take two seconds long from half a second in, its
 * sequence two notes at 120 bpm, 1920 ticks a second.
 */
export function studioMidiFixture(): {
  project: StudioProject
  assets: StudioAsset[]
  clip: StudioClip
  sequence: StudioSequence
} {
  const base = studioFixture()
  const asset: StudioAsset = {
    ...base.asset,
    id: 'asset-midi',
    normalizedFrameCount: 96_000,
    canonicalPcmId: 'pcm-midi',
    canonicalPcmByteLength: 384_032,
    provenance: { kind: 'recording', importedAt: TEST_NOW },
  }
  const sequence: StudioSequence = {
    id: 'sequence-1',
    ppq: 960,
    tempoBpm: 120,
    lengthTicks: 3840,
    nextNoteId: 3,
    notes: [
      { id: 1, pitch: 60, startTick: 960, lengthTicks: 480, velocity: 0.8 },
      { id: 2, pitch: 64, startTick: 1920, lengthTicks: 960, velocity: 0.5 },
    ],
  }
  const clip: StudioClip = {
    id: 'clip-midi',
    trackId: 'track-keys',
    assetId: asset.id,
    startFrame: 48_000,
    sourceInFrame: 24_000,
    sourceOutFrame: 96_000,
    gainDb: 0,
    fades: { curve: 'linear-amplitude' },
    midi: {
      sequenceId: sequence.id,
      renderKey: studioMidiRenderKey(sequence, 'piano'),
    },
  }
  const project: StudioProject = {
    ...base.project,
    tracks: [
      ...base.project.tracks,
      createStudioTrack({
        id: 'track-keys',
        name: 'Keys',
        order: 1,
        role: 'keys',
      }),
    ],
    clips: [...base.project.clips, clip],
    sequences: [sequence],
  }
  return { project, assets: [base.asset, asset], clip, sequence }
}
