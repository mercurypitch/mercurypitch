// Studio persistence fixtures — small real canonical audio for transaction and backup tests.
import { encodeCanonicalPcm, sha256Bytes, } from '@/lib/studio/audio/canonical-pcm'
import { createStudioTrack } from '@/lib/studio/model/defaults'
import type { StudioAssetData, StudioProject } from '@/lib/studio/model/types'

export async function studioAssetFixture(
  projectId: string,
  id = 'asset-one',
  /** A different level makes different audio, with its own canonical hash. */
  level = 0.2,
): Promise<StudioAssetData> {
  const samples = Float32Array.from(
    { length: 64 },
    (_, frame) => Math.sin(frame * 0.1) * level,
  )
  const original = new Blob(['fixture original audio'], { type: 'audio/wav' })
  const canonicalPcm = await encodeCanonicalPcm({
    sampleRate: 48000,
    numberOfChannels: 1,
    length: samples.length,
    getChannelData: () => samples,
  })
  return {
    original,
    canonicalPcm,
    asset: {
      id,
      projectId,
      sha256: await sha256Bytes(await original.arrayBuffer()),
      mimeType: original.type,
      byteLength: original.size,
      channels: 1,
      normalizedSampleRate: 48000,
      normalizedFrameCount: samples.length,
      importVersion: 1,
      canonicalPcmId: `${id}-pcm-v1`,
      canonicalPcmSha256: await sha256Bytes(await canonicalPcm.arrayBuffer()),
      canonicalPcmByteLength: canonicalPcm.size,
      preparation: { algorithmVersion: 'bs1770-48k-v1', gainDb: 3 },
      provenance: {
        kind: 'karaoke',
        sourceId: 'kept-one',
        importedAt: '2026-10-26T12:00:00.000Z',
      },
    },
  }
}

export function studioArrangementFixture(
  project: StudioProject,
  assetId = 'asset-one',
): StudioProject {
  return {
    ...project,
    revision: project.revision + 1,
    tracks: [
      createStudioTrack({
        id: 'lane-one',
        name: 'Voice',
        order: 0,
        role: 'voice',
      }),
    ],
    clips: [
      {
        id: 'clip-one',
        trackId: 'lane-one',
        assetId,
        startFrame: 96000,
        sourceInFrame: 4,
        sourceOutFrame: 60,
        gainDb: -2,
        fades: {
          curve: 'linear-amplitude',
          in: { fromSourceFrame: 0, toSourceFrame: 12 },
          out: { fromSourceFrame: 48, toSourceFrame: 64 },
        },
      },
    ],
  }
}
