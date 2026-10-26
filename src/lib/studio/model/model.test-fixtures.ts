// Studio model fixtures — small owned sources and deterministic project revisions for pure tests.
import { createStudioProject, createStudioTrack } from './defaults'
import type { StudioAsset, StudioClip, StudioProject } from './types'

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
