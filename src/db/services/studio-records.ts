// ============================================================
// Studio records — metadata stays separate from immutable owned audio bytes.
// ============================================================

import type { DbEntity } from '@/db/types'
import type { StudioAsset } from '@/lib/studio/model/types'

export interface StudioAssetRecord extends DbEntity {
  projectId: string
  sha256: string
  asset: StudioAsset
}

export interface StudioBlobRecord extends DbEntity {
  projectId: string
  /**
   * The take's id for its audio. A take's waveform peaks use their own row id
   * here instead, so a reader that lists a take's rows by its id (this and
   * every earlier version) still finds exactly its two files.
   */
  assetId: string
  kind: 'original' | 'canonical' | 'peaks'
  data: ArrayBuffer
}

/** The row that keeps a take's waveform peaks in its song: one per song and canonical PCM hash. */
export function studioPeaksRowId(
  projectId: string,
  canonicalPcmSha256: string,
): string {
  return `peaks-v1:${projectId}:${canonicalPcmSha256}`
}

export interface PreparedStudioRecords {
  metadata: StudioAssetRecord
  original: StudioBlobRecord
  canonical: StudioBlobRecord
}
