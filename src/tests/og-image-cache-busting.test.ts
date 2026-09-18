// ============================================================
// A regenerated card is a new link
// ============================================================
//
// Social platforms cache an Open Graph image against its URL — Discord for
// days, sometimes weeks — and no purge of ours reaches them. The 2026-09-10
// refresh regenerated all eleven cards in place, so every link shared before
// it kept showing the old art: Guitar Night had gained Free play and the card
// in Discord still offered "I know my way around".
//
// Every card URL therefore carries eight hex characters of the file's own
// SHA-256. These tests are what make that true: the stamp has to match the
// bytes on disk, so regenerating a card without running
// `pnpm run og:versions` fails here rather than in somebody's chat.

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ENTRY_PAGES, OG_IMAGE, ogImage } from '@/seo/entry-pages'
import { OG_IMAGE_VERSIONS } from '@/seo/og-image-versions'

const repo = resolve(import.meta.dirname, '../..')
const publicDir = resolve(repo, 'public')

/** The same stamp `scripts/gen-og-versions.mjs` writes, read from the bytes. */
function stampOf(file: string): string {
  return createHash('sha256')
    .update(readFileSync(resolve(publicDir, file)))
    .digest('hex')
    .slice(0, 8)
}

/** Every card the site can serve: the shared one, the rooms', Glass's. */
function cardFiles(): string[] {
  const root = readdirSync(publicDir).filter(
    (name) => name === 'og-image.png' || name.endsWith('-og.png'),
  )
  const glass = readdirSync(resolve(publicDir, 'glass'))
    .filter((name) => /^og\.(png|jpe?g)$/.test(name))
    .map((name) => `glass/${name}`)
  return [...root, ...glass].sort()
}

describe('the social cards', () => {
  it('stamps every card with the hash of the file on disk', () => {
    for (const file of cardFiles()) {
      expect(
        OG_IMAGE_VERSIONS[file],
        `${file} changed — run pnpm run og:versions`,
      ).toBe(stampOf(file))
    }
  })

  it('leaves no card unstamped', () => {
    expect(Object.keys(OG_IMAGE_VERSIONS).sort()).toEqual(cardFiles())
  })

  it('gives every entry page a versioned card', () => {
    for (const page of ENTRY_PAGES) {
      const image = page.og.image ?? OG_IMAGE
      const [url, query] = image.split('?')
      const file = (url ?? '').replace('https://mercurypitch.com/', '')
      expect(
        OG_IMAGE_VERSIONS[file],
        `${page.slug} points at ${file}, which has no stamp`,
      ).toBeDefined()
      expect(query, `${page.slug}'s card is unversioned`).toBe(
        `v=${OG_IMAGE_VERSIONS[file]}`,
      )
    }
  })

  it('versions the shared card in the app shell too', () => {
    const html = readFileSync(resolve(repo, 'index.html'), 'utf8')
    const stamp = OG_IMAGE_VERSIONS['og-image.png']
    // og:image and twitter:image, both stamped, neither bare.
    expect(html.match(/og-image\.png(\?v=[0-9a-f]{8})?/g)).toEqual([
      `og-image.png?v=${stamp}`,
      `og-image.png?v=${stamp}`,
    ])
    expect(html).toContain(ogImage('og-image.png'))
  })

  it('leaves an unknown file unstamped rather than guessing', () => {
    expect(ogImage('not-a-card.png')).toBe(
      'https://mercurypitch.com/not-a-card.png',
    )
  })
})
