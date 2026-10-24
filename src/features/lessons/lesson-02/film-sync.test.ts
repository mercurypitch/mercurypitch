// ============================================================
// Lesson 2's film files — the page bundles the lesson's own copies
// ============================================================
//
// The page plays the episode with the captions and chapters in assets/; the
// lesson's sources in docs/plans keep the same files, cut from the film. A
// re-cut that re-times the film changes both copies with the MP4s (film.ts),
// so the two may never drift apart.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ASSETS = resolve(process.cwd(), 'src/features/lessons/lesson-02/assets')
const SOURCES = resolve(
  process.cwd(),
  'docs/plans/find-your-pitch/lessons/02-twelve-notes/captions',
)

const read = (dir: string, name: string): string =>
  readFileSync(resolve(dir, name), 'utf8')

/** The chapters as LESSON.md and WEB-SPEC list them: eleven, 00:00 to 06:49. */
const CHAPTERS = [
  ['The missing five', 0],
  ['The very next note', 35.23],
  ['Twelve equal steps', 48.25],
  ['The keyboard', 95.17],
  ['B to C', 108.24],
  ['Where the five come from', 172.45],
  ['Sharps and flats', 199.59],
  ['Cents', 265.78],
  ['Sing a semitone', 306.2],
  ['Quick check', 357.63],
  ['Next time', 409.06],
]

describe("Lesson 2's film files", () => {
  it('bundles the captions the lesson sources hold, byte for byte', () => {
    expect(read(ASSETS, 'lesson-02.en.vtt')).toBe(
      read(SOURCES, 'lesson-02.en.vtt'),
    )
  })

  it('bundles the same chapters', () => {
    expect(JSON.parse(read(ASSETS, 'chapters.json'))).toEqual(
      JSON.parse(read(SOURCES, 'chapters.json')),
    )
  })

  it('holds the eleven chapters the spec lists, from "The missing five" to "Next time"', () => {
    const chapters = JSON.parse(read(ASSETS, 'chapters.json')) as {
      title: string
      start: number
    }[]
    expect(chapters.map((c) => [c.title, c.start])).toEqual(CHAPTERS)
  })

  it('labels each turn with the hosts’ names, as the transcript reads them', () => {
    const labels = read(ASSETS, 'lesson-02.en.vtt').match(/^[A-Z][A-Z ]*:/gm)
    expect(labels?.length ?? 0).toBeGreaterThan(0)
    expect(labels?.every((l) => l === 'MERC:' || l === 'TAVI:')).toBe(true)
  })

  it('names the hosts in its sounds too, never by colour', () => {
    const vtt = read(ASSETS, 'lesson-02.en.vtt')
    expect(vtt).toMatch(/^\[Merc /m)
    expect(vtt).toMatch(/^\[Tavi /m)
    expect(vtt).not.toMatch(/\b(?:blue|orange) Merc\b/i)
  })

  it('ends its last caption inside the 7:11 film', () => {
    const stamps = [
      ...read(ASSETS, 'lesson-02.en.vtt').matchAll(
        /--> (\d\d):(\d\d):(\d\d\.\d{3})/g,
      ),
    ].map((m) => Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]))
    const last = Math.max(...stamps)
    expect(last).toBeGreaterThan(400)
    expect(last).toBeLessThanOrEqual(431.08)
  })
})
