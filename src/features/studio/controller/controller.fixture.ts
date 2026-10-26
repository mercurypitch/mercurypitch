// Studio controller fixtures — a stateful storage edge and deterministic prepared audio.
import { vi } from 'vitest'
import type { StudioService } from '@/db/services/studio-service'
import type { StudioAssetInfo } from '@/lib/studio/audio/prepare-studio-asset'
import { createStudioProject, summarizeStudioProject, } from '@/lib/studio/model/defaults'
import type { StudioAssetData, StudioProject } from '@/lib/studio/model/types'

export function controllerServiceFixture(): StudioService {
  const stored = new Map<string, StudioProject>(
    ['one', 'two'].map((id) => [
      id,
      createStudioProject({ id, now: '2026-10-26T10:00:00.000Z' }),
    ]),
  )
  return {
    listProjects: vi.fn(async () =>
      [...stored.values()].map(summarizeStudioProject),
    ),
    createProject: vi.fn(async (title) => {
      const project = createStudioProject({ id: 'new', title })
      stored.set(project.id, project)
      return project
    }),
    loadProject: vi.fn(async (id) => structuredClone(stored.get(id)!)),
    listAssets: vi.fn(async () => []),
    readAssetBytes: vi.fn(async () => {
      throw new Error('No saved audio')
    }),
    readCanonicalAsset: vi.fn(async () => {
      throw new Error('No saved audio')
    }),
    acquireLease: vi.fn(async (projectId, ownerId) => ({
      projectId,
      ownerId,
      epoch: 1,
      expiresAt: Date.now() + 30000,
    })),
    renewLease: vi.fn(async (projectId, token) => ({
      projectId,
      ...token,
      expiresAt: Date.now() + 30000,
    })),
    releaseLease: vi.fn(async () => undefined),
    saveProject: vi.fn(async (project) => {
      stored.set(project.id, structuredClone(project))
      return project
    }),
    forkProject: vi.fn(async (project) => {
      const copy = { ...project, id: 'copy', revision: 0 }
      stored.set(copy.id, copy)
      return copy
    }),
    restoreProject: vi.fn(async (project) => {
      const copy = { ...project, id: 'restored', revision: 0 }
      stored.set(copy.id, copy)
      return copy
    }),
    deleteProject: vi.fn(async (id) => {
      stored.delete(id)
    }),
  }
}

export function preparedFixture(info: StudioAssetInfo): StudioAssetData {
  return {
    asset: {
      id: info.id,
      projectId: info.projectId,
      ...(info.originalName === undefined
        ? {}
        : { originalName: info.originalName }),
      sha256: 'a'.repeat(64),
      mimeType: 'audio/wav',
      byteLength: 3,
      channels: 1,
      normalizedSampleRate: 48000,
      normalizedFrameCount: 2,
      importVersion: 1,
      canonicalPcmId: `${info.id}-pcm`,
      canonicalPcmSha256: 'b'.repeat(64),
      canonicalPcmByteLength: 40,
      preparation: { algorithmVersion: 'bs1770-48k-v1', gainDb: 0 },
      provenance: info.provenance,
    },
    original: new Blob(['abc'], { type: 'audio/wav' }),
    canonicalPcm: new Blob([new Uint8Array(40)]),
  }
}
