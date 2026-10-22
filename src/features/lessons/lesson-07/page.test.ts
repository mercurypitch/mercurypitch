// ============================================================
// Lesson 7's page document — its signs, its references, its cold open
// ============================================================
//
// learn/07.html is hand-written markup, so some of its promises are held
// here: every ♯ it prints is followed by its spoken name, the sign itself
// hidden from a screen reader, and no accessible name carries a sign; every
// id a label or description points at exists, once; there is no Watch
// section, because Lesson 7 has no film; the page opens on its cold open,
// the predict in the hero, with the recall in its own section after;
// nothing a learner meets before the reveal gives the predict's answer
// away; what answers Step 5's predict waits for its guess; and the share
// card its head names is in public/, at the size the head gives.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/07.html'), 'utf8')

/** A sign as the page writes it, however the formatter wraps it: hidden, then said. */
const SPOKEN_SIGN =
  /<span\s+aria-hidden="true"\s*>[♯♭]<\/span\s*>\s*<span\s+class="sr"\s*>\s(?:sharp|flat)<\/span\s*>/g

/** A meta tag's content, by name or property, however the formatter wraps the tag. */
const metaOf = (key: string): string | undefined =>
  new RegExp(`(?:property|name)="${key}"\\s+content="([^"]*)"`).exec(PAGE)?.[1]

/** A baseline or progressive JPEG's pixel size, from its frame header. */
function jpegSize(bytes: Buffer): { width: number; height: number } {
  let at = 2
  while (at + 8 < bytes.length) {
    const marker = bytes[at + 1]
    const sof =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
    if (sof)
      return {
        height: bytes.readUInt16BE(at + 5),
        width: bytes.readUInt16BE(at + 7),
      }
    at += 2 + bytes.readUInt16BE(at + 2)
  }
  throw new Error('no JPEG frame header')
}

/** Every value of one attribute, in page order. */
const valuesOf = (attr: string): string[] =>
  Array.from(
    PAGE.matchAll(new RegExp(`\\s${attr}="([^"]*)"`, 'g')),
    (m) => m[1],
  )

/** The page's text from its start to `marker`, tags, line breaks and the predict's own choices gone. */
const textBefore = (marker: string): string =>
  PAGE.slice(0, PAGE.indexOf(marker))
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<button\s+class="btn choice"[\s\S]*?<\/button>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')

/** Words that would answer "How much of it does Twinkle use?" before its reveal. */
const ANSWERS = [
  /slice/i,
  /less than half/i,
  /\b9 semitones\b/i,
  /\bnine semitones\b/i,
  /only (?:a|part)/i,
  /a (?:small|narrow) part/i,
]

describe("Lesson 7's page", () => {
  it('follows every ♯ and ♭ it prints with its spoken name', () => {
    // Act: the markup names its notes in words; the code writes the signs it draws
    const bare = PAGE.replace(SPOKEN_SIGN, '').match(/[♯♭]/g) ?? []

    // Assert
    expect(bare).toEqual([])
  })

  it('puts no sign in an accessible name or a share card: they are spoken', () => {
    const named = [
      ...valuesOf('aria-label'),
      ...valuesOf('aria-valuetext'),
      ...valuesOf('alt'),
      ...valuesOf('content'),
    ]
    expect(named.filter((v) => /[♯♭]/.test(v))).toEqual([])
  })

  it('points every label and description at an id that exists, once', () => {
    // Arrange
    const ids = valuesOf('id')
    const refs = [
      ...valuesOf('aria-labelledby'),
      ...valuesOf('aria-describedby'),
    ].flatMap((v) => v.split(/\s+/))

    // Act
    const missing = refs.filter((r) => !ids.includes(r))
    const twice = ids.filter((id, i) => ids.indexOf(id) !== i)

    // Assert
    expect(refs.length).toBeGreaterThan(0)
    expect(missing).toEqual([])
    expect(twice).toEqual([])
  })

  it('carries no Watch section: Lesson 7 has no film', () => {
    expect(PAGE).not.toMatch(/id="watch"/)
    expect(PAGE).not.toMatch(/<video/)
  })

  it('opens on the cold open, the recall after it and before the four words', () => {
    // Act: each part's place in the document
    const at = [
      'id="hook"',
      'id="heroStage"',
      'id="predict"',
      'id="recall"',
      'id="words"',
    ].map((id) => PAGE.indexOf(id))

    // Assert: CURIOSITY-MOMENTS § 3.1, as Lessons 2, 4, 5 and 6 run
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('asks the recall in a section of its own, outside the hero', () => {
    // Act
    const hero = /<section class="hero[^"]*"[\s\S]*?<\/section>\s*<!--/.exec(
      PAGE,
    )?.[0]

    // Assert
    expect(hero).toBeDefined()
    expect(hero).toContain('id="predict"')
    expect(hero).not.toContain('id="recall"')
  })

  it("keeps the cold open's answer out of everything a learner meets before its reveal", () => {
    // Arrange: the head, the hook, the chips, the promise, the gate, the
    // stage and the predict's question: the page up to its reveal
    const before = textBefore('<div class="reveal" hidden')
    const head = [
      metaOf('description'),
      metaOf('og:description'),
      metaOf('twitter:description'),
      metaOf('og:image:alt'),
      metaOf('twitter:image:alt'),
      /<title>([^<]*)<\/title>/.exec(PAGE)?.[1],
    ].join(' ')

    // Act
    const said = ANSWERS.filter((a) => a.test(before) || a.test(head))

    // Assert
    expect(said).toEqual([])
  })

  it("keeps the cold open's column play locked until a guess", () => {
    expect(PAGE).toMatch(/data-play="column"[\s\S]{0,120}disabled/)
    expect(PAGE).toMatch(/id="heroPlay"[\s\S]{0,80}data-free/)
  })

  it("holds back what answers Step 5's predict until its guess", () => {
    // Arrange
    const step5 = PAGE.slice(
      PAGE.indexOf('id="step-5"'),
      PAGE.indexOf('id="deckNav"'),
    )
    const after = step5.slice(
      step5.indexOf('<!-- the rest of the step answers'),
    )

    // Act: the paragraphs after the predict card, and the singers' buttons
    const shown = Array.from(
      after.matchAll(/<(p|details)\b([^>]*)>/g),
      (m) => m[2],
    ).filter((attrs) => !/\shidden\b/.test(attrs))
    const singers = Array.from(
      PAGE.matchAll(/data-(?:singer="[ab]"|show-types)[^>]*>/g),
      (m) => m[0],
    )

    // Assert
    expect(shown).toEqual([])
    expect(singers.length).toBe(6)
    expect(singers.filter((s) => !s.includes('disabled'))).toHaveLength(3)
  })

  it('names a share card that is in public/, at the size its head gives', () => {
    // Arrange
    const image = metaOf('og:image')?.replace('https://mercurypitch.com/', '')

    // Act
    const size = jpegSize(
      readFileSync(resolve(process.cwd(), 'public', image ?? '')),
    )

    // Assert
    expect(image).toBe('learn/lesson-07-og.jpg')
    expect([size.width, size.height].map(String)).toEqual([
      metaOf('og:image:width'),
      metaOf('og:image:height'),
    ])
  })

  it('links practice to the Vocal Range Test alone, carrying ?lesson=07', () => {
    // Act: every link into the app's tools
    const tools = valuesOf('href').filter((h) =>
      /^\/(?:vocal-range-test|mirror|ear-lab|ascent|pitch-training)/.test(h),
    )

    // Assert
    expect(tools.length).toBeGreaterThan(0)
    expect(tools.every((h) => h === '/vocal-range-test?lesson=07')).toBe(true)
  })
})
