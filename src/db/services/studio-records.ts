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
  assetId: string
  kind: 'original' | 'canonical'
  data: ArrayBuffer
}

export interface PreparedStudioRecords {
  metadata: StudioAssetRecord
  original: StudioBlobRecord
  canonical: StudioBlobRecord
}
