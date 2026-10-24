// ============================================================
// Lesson 1's film files — the page bundles the lesson's own copies
// ============================================================
//
// The page plays the episode with the captions and chapters in assets/; the
// lesson's sources in docs/plans keep the same files, cut from the film. A
// re-cut that re-times the film changes both copies with the MP4s (film.ts),
// so the two may never drift apart.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ASSETS = resolve(process.cwd(), 'src/features/lessons/lesson-01/assets')
const SOURCES = resolve(
  process.cwd(),
  'docs/plans/find-your-pitch/lessons/01-what-is-a-note/captions',
)

const read = (dir: string, name: string): string =>
  readFileSync(resolve(dir, name), 'utf8')

describe("Lesson 1's film files", () => {
  it('bundles the captions the lesson sources hold, byte for byte', () => {
    expect(read(ASSETS, 'lesson-01.en.vtt')).toBe(
      read(SOURCES, 'lesson-01.en.vtt'),
    )
  })

  it('bundles the same chapters', () => {
    expect(JSON.parse(read(ASSETS, 'chapters.json'))).toEqual(
      JSON.parse(read(SOURCES, 'chapters.json')),
    )
  })

  it('labels each turn with the hosts’ names, as the transcript reads them', () => {
    const labels = read(ASSETS, 'lesson-01.en.vtt').match(/^[A-Z][A-Z ]*:/gm)
    expect(labels?.length ?? 0).toBeGreaterThan(0)
    expect(labels?.every((l) => l === 'MERC:' || l === 'TAVI:')).toBe(true)
  })

  it('names the hosts in its sounds too, never by colour', () => {
    const vtt = read(ASSETS, 'lesson-01.en.vtt')
    expect(vtt).toMatch(/^\[Merc /m)
    expect(vtt).toMatch(/^\[Tavi /m)
    expect(vtt).not.toMatch(/\b(?:blue|orange) Merc\b/i)
  })
})
