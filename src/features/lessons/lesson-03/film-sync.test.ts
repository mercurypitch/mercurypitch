// ============================================================
// Lesson 3's film files — the page bundles the lesson's own copies
// ============================================================
//
// The page plays the episode with the captions and chapters in assets/; the
// lesson's sources in docs/plans keep the same files, cut from the film. A
// re-cut that re-times the film changes both copies with the MP4s (film.ts),
// so the two may never drift apart.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ASSETS = resolve(process.cwd(), 'src/features/lessons/lesson-03/assets')
const SOURCES = resolve(
  process.cwd(),
  'docs/plans/find-your-pitch/lessons/03-match-a-note/captions',
)

const read = (dir: string, name: string): string =>
  readFileSync(resolve(dir, name), 'utf8')

/** The film's chapters: twelve, 00:00 to 09:00, from the film's own timing. */
const CHAPTERS = [
  ["I can't sing", 0],
  ['A semitone off', 32.93],
  ['The test', 74.21],
  ['Your vocal folds', 137.47],
  ['Loud or high', 210.49],
  ['Look after your voice', 228.27],
  ['Hear, try, compare, adjust', 249.12],
  ['Does an octave count?', 304.96],
  ['How close is close enough?', 354.3],
  ['Sing three notes', 392.31],
  ['Quick check', 483.32],
  ['Next time', 540.27],
]

/** Every caption's start and end, in seconds. */
function cueTimes(vtt: string): [number, number][] {
  const s = (h: string, m: string, x: string): number =>
    Number(h) * 3600 + Number(m) * 60 + Number(x)
  return [
    ...vtt.matchAll(
      /^(\d\d):(\d\d):(\d\d\.\d{3}) --> (\d\d):(\d\d):(\d\d\.\d{3})$/gm,
    ),
  ].map((m) => [s(m[1], m[2], m[3]), s(m[4], m[5], m[6])])
}

describe("Lesson 3's film files", () => {
  it('bundles the captions the lesson sources hold, byte for byte', () => {
    expect(read(ASSETS, 'lesson-03.en.vtt')).toBe(
      read(SOURCES, 'lesson-03.en.vtt'),
    )
  })

  it('bundles the same chapters', () => {
    expect(JSON.parse(read(ASSETS, 'chapters.json'))).toEqual(
      JSON.parse(read(SOURCES, 'chapters.json')),
    )
  })

  it('holds the twelve chapters, from "I can\'t sing" to "Next time"', () => {
    const chapters = JSON.parse(read(ASSETS, 'chapters.json')) as {
      title: string
      start: number
    }[]
    expect(chapters.map((c) => [c.title, c.start])).toEqual(CHAPTERS)
  })

  it('holds the film’s 151 captions', () => {
    expect(cueTimes(read(ASSETS, 'lesson-03.en.vtt'))).toHaveLength(151)
  })

  it('labels each turn with the hosts’ names, as the transcript reads them', () => {
    const labels = read(ASSETS, 'lesson-03.en.vtt').match(/^[A-Z][A-Z ]*:/gm)
    expect(labels?.length ?? 0).toBeGreaterThan(0)
    expect(labels?.every((l) => l === 'MERC:' || l === 'TAVI:')).toBe(true)
  })

  it('names the hosts in its sounds too, never by colour', () => {
    const vtt = read(ASSETS, 'lesson-03.en.vtt')
    expect(vtt).toMatch(/^\[Merc /m)
    expect(vtt).toMatch(/^\[Tavi /m)
    expect(vtt).not.toMatch(/\b(?:blue|orange) Merc\b/i)
  })

  it('keeps every caption within two lines of 42 characters, on screen for at least 5/6 s, in order', () => {
    const vtt = read(ASSETS, 'lesson-03.en.vtt')
    const blocks = vtt.trim().split('\n\n').slice(1)
    for (const block of blocks) {
      const lines = block.split('\n').slice(1)
      expect(lines.length, block).toBeGreaterThan(0)
      expect(lines.length, block).toBeLessThanOrEqual(2)
      for (const line of lines)
        expect(line.length, line).toBeLessThanOrEqual(42)
    }
    const times = cueTimes(vtt)
    expect(times).toHaveLength(blocks.length)
    times.forEach(([a, b], i) => {
      expect(b - a, `cue at ${a}`).toBeGreaterThanOrEqual(5 / 6 - 0.001)
      if (i > 0) expect(a, `cue at ${a}`).toBeGreaterThan(times[i - 1][1])
    })
  })

  it('ends its last caption inside the 9:32 film', () => {
    const last = Math.max(
      ...cueTimes(read(ASSETS, 'lesson-03.en.vtt')).map(([, b]) => b),
    )
    expect(last).toBeGreaterThan(560)
    expect(last).toBeLessThanOrEqual(572.1)
  })
})
