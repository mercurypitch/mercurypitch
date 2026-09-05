// ============================================================
// Packaged Pull expansion — every registered beat and checked-in byte exists
// ============================================================
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUILT_IN_PULL_IDS } from '@/content/pulls'
import { V2_ONBOARDING_MEDIA_PACK } from './v2-onboarding-media-pack'

describe('packaged Pull expansion', () => {
  it('provides complete present/hold/recede/end files for every built-in', () => {
    for (const id of BUILT_IN_PULL_IDS) {
      const media = V2_ONBOARDING_MEDIA_PACK.pulls[id]
      expect(media, id).toBeDefined()
      for (const beat of ['present', 'hold', 'recede', 'end'] as const) {
        const resource = media?.[beat]
        expect(resource, `${id}:${beat}`).toBeDefined()
        if (!resource)
          throw new Error(`Expected a packaged file for ${id}:${beat}`)
        expect(
          existsSync(`${process.cwd()}/public${resource.src}`),
          resource.src,
        ).toBe(true)
      }
    }
  })

  it('matches all 44 generated files and keeps every MP4 faststart', () => {
    const root = `${process.cwd()}/public/onboarding/pull-expansion-v1`
    const entries = readFileSync(`${root}/SHA256SUMS`, 'utf8')
      .trim()
      .split('\n')
    expect(entries).toHaveLength(44)
    for (const entry of entries) {
      const [expected, name] = entry.split('  ')
      const bytes = readFileSync(`${root}/${name}`)
      expect(createHash('sha256').update(bytes).digest('hex'), name).toBe(
        expected,
      )
      if (name?.endsWith('.mp4')) {
        expect(bytes.indexOf('moov'), name).toBeGreaterThan(0)
        expect(bytes.indexOf('moov'), name).toBeLessThan(bytes.indexOf('mdat'))
      }
    }
  })
})
