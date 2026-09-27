// ============================================================
// The hosted zen stage on its side (decision D3 A)
// ============================================================
//
// jsdom has no layout, so what is checked here is the stylesheet's contract;
// the native probe measures the result in a real browser at 852 x 393 (two
// columns, nothing wider than the screen). Zen had no orientation rule at
// all: a phone on its side got the portrait column, with lyrics padded by
// 24vh and 32vh, which at 393 px tall leaves almost nothing to read.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  resolve(process.cwd(), 'src/components/KaraokeMobileStage.module.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '')

/** The body of the first `@media` block whose query matches `query`. */
function mediaBlock(query: RegExp): string {
  const start = css.search(query)
  if (start < 0) throw new Error(`no @media block for ${String(query)}`)
  const open = css.indexOf('{', start)
  let depth = 0
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    if (css[i] === '}') {
      depth -= 1
      if (depth === 0) return css.slice(open + 1, i)
    }
  }
  throw new Error('unbalanced @media block')
}

/** The declarations of `selector` inside `block`. */
function rule(block: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const found = new RegExp(`(?:^|[\\s}])${escaped}\\s*\\{([^}]*)\\}`, 'u').exec(
    block,
  )
  if (found === null) throw new Error(`no ${selector} rule`)
  return found[1]
}

const LANDSCAPE =
  /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*500px\)/u

describe('the hosted stage on its side', () => {
  const block = mediaBlock(LANDSCAPE)

  it('is two columns: the song and the transport left, the lyrics right', () => {
    const hosted = rule(block, '.hosted')
    expect(hosted).toMatch(/display:\s*grid/u)
    const areas = /grid-template-areas:\s*([^;]+);/u.exec(hosted)?.[1] ?? ''
    const rows = [...areas.matchAll(/'([^']+)'/gu)].map((m) =>
      m[1].trim().split(/\s+/u),
    )
    expect(rows.length).toBeGreaterThanOrEqual(2)
    for (const row of rows) expect(row).toHaveLength(2)
    expect(rows.map((row) => row[1])).toEqual(rows.map(() => 'lyrics'))
    expect(rows[0][0]).toBe('song')
    expect(rows.at(-1)?.[0]).toBe('bar')
  })

  it('puts each part in its area', () => {
    expect(rule(block, '.hosted .songLine')).toMatch(/grid-area:\s*song/u)
    expect(rule(block, '.hosted .lyrics')).toMatch(/grid-area:\s*lyrics/u)
    expect(rule(block, '.hosted .bottomBar')).toMatch(/grid-area:\s*bar/u)
  })

  it('pads the lyrics for a short screen, not with the portrait 24vh and 32vh', () => {
    const lyrics = rule(block, '.hosted .lyrics')
    const padding = /padding:\s*([^;]+);/u.exec(lyrics)?.[1] ?? ''
    expect(padding).not.toBe('')
    expect(padding).not.toMatch(/24vh|32vh/u)
  })

  it('undoes the wide-screen centring a landscape phone would inherit', () => {
    // 852 px is past the desktop-zen breakpoint (769 px), whose 760 px
    // reading column would otherwise squeeze the lyrics into the middle.
    const lyrics = rule(block, '.hosted .lyrics')
    expect(lyrics).toMatch(/width:\s*auto/u)
    expect(lyrics).toMatch(/margin:\s*0/u)
  })
})
