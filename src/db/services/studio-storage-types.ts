// ============================================================
// Studio storage types — local write failures and editor ownership tokens.
// ============================================================

import { isQuotaError } from '@/db/durable-write'

export const STUDIO_STORES = {
  projects: 'studioProjects',
  summaries: 'studioProjectSummaries',
  assets: 'studioAssets',
  blobs: 'studioAssetBlobs',
  leases: 'studioEditorLeases',
} as const

export type StudioStorageErrorCode =
  | 'not-found'
  | 'conflict'
  | 'locked'
  | 'lease-lost'
  | 'invalid-project'
  | 'invalid-asset'
  | 'project-limit'
  | 'memory-limit'
  | 'quota-exceeded'
  | 'storage-unavailable'

export class StudioStorageError extends Error {
  constructor(
    readonly code: StudioStorageErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause })
    this.name = 'StudioStorageError'
  }
}

export interface StudioEditorToken {
  ownerId: string
  epoch: number
}

export interface StudioWriteToken extends StudioEditorToken {
  expectedRevision: number
}

export interface StudioEditorLease extends StudioEditorToken {
  projectId: string
  expiresAt: number
}

export async function studioStorageOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof StudioStorageError) throw error
    throw new StudioStorageError(
      isQuotaError(error) ? 'quota-exceeded' : 'storage-unavailable',
      isQuotaError(error)
        ? 'This browser has no room to save the project.'
        : 'The local project store could not complete this operation.',
      error,
    )
  }
}
