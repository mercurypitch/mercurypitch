// Songbook delivery proof — every selectable take must be packaged, hash-verified and bounded.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MERC_SONGBOOK_ASSETS } from '../content/merc-songbook'
import { GLASS_GAME_ON_DEMAND_ASSET_IDS, GLASS_GAME_REQUIRED_FILES, glassGameAssetPath, } from './assets'

const root = fileURLToPath(
  new URL('../../../../apps/beside-cue/public/games/', import.meta.url),
)

describe('songbook delivered audio', () => {
  it('packages each selectable lazy take with exact bytes and no rejected speech candidates', () => {
    const manifest = JSON.parse(
      readFileSync(`${root}adventure-voice-v7/manifest.json`, 'utf8'),
    ) as {
      files: { path: string; bytes: number; sha256: string }[]
    }
    const declared = new Set(
      manifest.files.map((file) => `adventure-voice-v7/${file.path}`),
    )
    expect(manifest.files).toHaveLength(12)
    expect(new Set(MERC_SONGBOOK_ASSETS.map((asset) => asset.id)).size).toBe(12)
    expect(new Set(MERC_SONGBOOK_ASSETS.map((asset) => asset.path))).toEqual(
      declared,
    )
    expect(
      readdirSync(`${root}adventure-voice-v7`)
        .filter((name) => name.endsWith('.mp3'))
        .sort(),
    ).toEqual(manifest.files.map((file) => file.path).sort())
    for (const asset of MERC_SONGBOOK_ASSETS) {
      expect(glassGameAssetPath(asset.id)).toBe(asset.path)
      expect(GLASS_GAME_REQUIRED_FILES).toContain(asset.path)
      expect(GLASS_GAME_ON_DEMAND_ASSET_IDS).toContain(asset.id)
      const file = manifest.files.find(
        (file) => `adventure-voice-v7/${file.path}` === asset.path,
      )!
      const bytes = readFileSync(`${root}${asset.path}`)
      expect(bytes.byteLength).toBe(file.bytes)
      expect(bytes.byteLength).toBeGreaterThan(4000)
      expect(bytes.byteLength).toBeLessThan(1_000_000)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256)
      expect(file.path).not.toContain('-tts')
    }
  })
})
