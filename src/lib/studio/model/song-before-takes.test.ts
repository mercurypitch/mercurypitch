// A song saved before takes opens as it was saved, every clip a clip of one take, plays as it played, and saves and opens again unchanged through this build's storage. The fixture holds such a song (an audio clip with fades, a MIDI clip, a comped loop take and a picked file) and the plan Studio compiled from it, both written by the build before takes, 0.9.31.
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { createStudioService } from '@/db/services/studio-service'
import { encodeCanonicalPcm, sha256Bytes } from '../audio/canonical-pcm'
import { compileStudioArrangement } from './arrangement-plan'
import { studioClipTakeList, studioSongAssetIds } from './clip-takes'
import { applyStudioCommand } from './commands'
import fixture from './fixtures/song-before-takes.compatibility.json'
import { TEST_NOW } from './model.test-fixtures'
import type { StudioAsset, StudioAssetData, StudioProject } from './types'
import { validateStudioProject } from './validation'

const assets = fixture.assets as StudioAsset[]
const open = () => validateStudioProject(fixture.project, assets)

/** Audio the storage takes as `asset`'s own: silence as long as it, hashed. */
async function savedAudio(asset: StudioAsset): Promise<StudioAssetData> {
  const samples = new Float32Array(asset.normalizedFrameCount)
  const original = new Blob([`audio of ${asset.id}`], { type: asset.mimeType })
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
      ...asset,
      sha256: await sha256Bytes(await original.arrayBuffer()),
      byteLength: original.size,
      canonicalPcmSha256: await sha256Bytes(await canonicalPcm.arrayBuffer()),
      canonicalPcmByteLength: canonicalPcm.size,
    },
  }
}

describe('a song saved before takes', () => {
  it('opens as it was saved, each clip a clip of one take and nothing added', () => {
    const opened = open()
    expect(opened).toEqual(fixture.project)
    for (const clip of opened.clips) {
      expect(clip).not.toHaveProperty('takes')
      expect(clip).not.toHaveProperty('activeTake')
      expect(studioClipTakeList(clip)).toEqual([clip])
    }
    expect(studioSongAssetIds(opened)).toEqual(
      new Set(assets.map((asset) => asset.id)),
    )
  })

  it('plays as it played', () => {
    const plan = compileStudioArrangement(open(), assets)
    expect(JSON.parse(JSON.stringify(plan))).toEqual(fixture.plan)
  })

  it('keeps every other clip as it was through an edit of one', () => {
    const edited = applyStudioCommand(
      open(),
      { type: 'set-clip-gain', clipId: 'clip-file', gainDb: -3 },
      { assets, now: TEST_NOW },
    )
    expect(edited.clips.filter((clip) => clip.id !== 'clip-file')).toEqual(
      fixture.project.clips.filter((clip) => clip.id !== 'clip-file'),
    )
  })

  describe('in this build’s storage', () => {
    let db: DexieAdapter
    beforeEach(() => {
      vi.stubGlobal('Blob', NodeBlob)
      vi.stubGlobal('crypto', webcrypto)
      db = new DexieAdapter()
    })
    afterEach(async () => {
      await db.destroy()
      vi.unstubAllGlobals()
    })

    it('saves and opens again unchanged, with all its audio, and plays as it played', async () => {
      // Arrange: the song's own id and creation time, as 0.9.31 made it.
      const song: StudioProject = { ...open(), revision: 1 }
      let ids = 0
      const service = createStudioService({
        database: () => db,
        now: () => new Date(song.createdAt),
        createId: () => (ids++ === 0 ? song.id : `id-${ids}`),
      })
      await service.createProject(song.title)
      const lease = await service.acquireLease(song.id, 'tab-one')
      const audio = await Promise.all(assets.map(savedAudio))

      // Act
      await service.saveProject(song, { ...lease, expectedRevision: 0 }, audio)
      const reopened = await service.loadProject(song.id)

      // Assert
      expect(reopened).toStrictEqual(song)
      const kept = await service.listAssets(song.id)
      expect(kept.map((asset) => asset.id).sort()).toEqual(
        assets.map((asset) => asset.id).sort(),
      )
      const plan = compileStudioArrangement(reopened, kept)
      expect(JSON.parse(JSON.stringify(plan))).toEqual({
        ...fixture.plan,
        revision: 1,
      })
    })
  })
})
