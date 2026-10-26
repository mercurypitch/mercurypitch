// ============================================================
// Studio source import — explicit selected history audio becomes a project asset
// ============================================================

import { importLimits } from '@/lib/studio/audio/import-limits'
import type { PrepareStudioAssetOptions, StudioAssetInfo, } from '@/lib/studio/audio/prepare-studio-asset'
import { prepareStudioAssetFrom } from '@/lib/studio/audio/prepare-studio-asset'
import type { StudioAssetData } from '@/lib/studio/model/types'
import type { StudioSourceEntry, StudioSourceReader } from './source-catalog'
import { readStudioSourceBlob } from './source-catalog'

export async function prepareStudioSource(
  source: StudioSourceEntry,
  info: Pick<StudioAssetInfo, 'id' | 'projectId'> & { importedAt: string },
  options: PrepareStudioAssetOptions & { reader?: StudioSourceReader } = {},
): Promise<StudioAssetData> {
  const limits = importLimits(options.limits)
  if (
    source.sizeBytes > limits.maxEncodedBytes ||
    source.durationMs * 48 > limits.maxFrames
  ) {
    throw new Error('This take is too large for Studio. Choose a shorter take.')
  }
  return prepareStudioAssetFrom(
    () => readStudioSourceBlob(source, options),
    {
      id: info.id,
      projectId: info.projectId,
      originalName: source.title,
      provenance: {
        kind: source.source,
        sourceId: source.id,
        importedAt: info.importedAt,
      },
    },
    options,
  )
}
