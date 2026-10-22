// ============================================================
// Lesson 8's page document — its references, its order, its promises
// ============================================================
//
// learn/08.html is hand-written markup, so some of its promises are held
// here: no sharp or flat sign anywhere, so none in an accessible name or a
// live line; every id a label or description points at exists, once;
// every button is a button, not a submit; there is no Watch section,
// because Lesson 8 has no film; the page opens on its cold open, the
// recall after it in Lesson 6's live wrapper and before the four words;
// the checkpoint takes taps and says it cannot hear claps, and no module
// opens the microphone; the practice links carry the lesson; "time
// signature" stays lower case; the next card's figure is a drawing with no
// button; the share card its head names is in public/, at its size; and
// every line of its copy, the predicts' lines with it, says only what the
// claims check passes (WEB-SPEC, Tests 10).

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { GUESS, HINTS, VERSION_SAID } from './cold-open'
import { PATTERN_GUESS, PATTERN_HINTS } from './steps'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/08.html'), 'utf8')
const DIR = resolve(process.cwd(), 'src/features/lessons/lesson-08')

/** A meta tag's content, however the formatter wraps the tag. */
const metaOf = (property: string): string | undefined =>
  new RegExp(`property="${property}"\\s+content="([^"]*)"`).exec(PAGE)?.[1]

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

/** The page's own modules, tests aside. */
const modules = readdirSync(DIR)
  .filter((f) => f.endsWith('.ts') && !f.includes('.test'))
  .map((f) => readFileSync(resolve(DIR, f), 'utf8'))

describe("Lesson 8's page", () => {
  it('prints no sharp or flat sign: the lesson needs none, so no name or live line can carry one', () => {
    // Assert
    expect(PAGE.match(/[♯♭]/gu)).toBeNull()
    for (const m of modules) expect(m.match(/[♯♭]/gu)).toBeNull()
  })

  it('points every label and description at an id that exists, once', () => {
    // Arrange
    const ids = valuesOf('id')
    const refs = [
      ...valuesOf('aria-labelledby'),
      ...valuesOf('aria-describedby'),
      ...valuesOf('for'),
    ].flatMap((v) => v.split(/\s+/))

    // Assert
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
    for (const ref of refs) expect(ids, ref).toContain(ref)
  })

  it('makes every button a plain button', () => {
    // Act
    const buttons = Array.from(PAGE.matchAll(/<button\b[^>]*>/g), (m) => m[0])

    // Assert
    expect(buttons.length).toBeGreaterThan(20)
    for (const b of buttons) expect(b, b).toMatch(/type="button"/)
  })

  it('carries no Watch section: Lesson 8 has no film', () => {
    expect(PAGE).not.toMatch(/id="watch"/)
    expect(PAGE).not.toMatch(/<video/)
  })

  it('opens on the hook and the cold open, the recall after it and before the four words', () => {
    // Act: each part's place in the document
    const at = [
      'id="hook"',
      'id="heroStage"',
      'id="predict"',
      'data-if-live="6"',
      'id="recall"',
      'id="words"',
    ].map((s) => PAGE.indexOf(s))

    // Assert: CURIOSITY-MOMENTS § 3.1, as Lessons 2, 4, 5 and 6 run
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it("asks the recall in Lesson 6's live wrapper, a section of its own outside the hero", () => {
    // Act
    const hero = /<section class="hero[^"]*"[\s\S]*?<\/section>/.exec(PAGE)?.[0]
    const wrapper =
      /<div data-if-live="6">\s*<section class="mv" id="recall"[\s\S]*?<\/section>\s*<\/div>/.exec(
        PAGE,
      )

    // Assert
    expect(hero).toContain('id="predict"')
    expect(hero).not.toContain('id="recall"')
    expect(wrapper).not.toBeNull()
  })

  it('takes taps at the checkpoint and says it cannot hear claps; nothing opens the microphone', () => {
    // Assert
    expect(PAGE.replace(/\s+/g, ' ')).toContain(
      "The page can't hear claps, only taps.",
    )
    for (const m of modules) {
      expect(m).not.toMatch(/getUserMedia|mediaDevices/)
      // and no draft switch is read here: the page state decides (kit/drafts.ts)
      expect(m).not.toMatch(/DRAFT_LESSONS|DRAFTS_SHOWN|import\.meta\.env/)
    }
  })

  it('links every practice drill with the lesson before any hash', () => {
    // Act
    const links = valuesOf('href')
      .filter((h) => /^\/(drum-night|ear-lab)/.test(h))
      .map((h) => h.replace(/&amp;/g, '&'))

    // Assert
    expect(links.length).toBeGreaterThanOrEqual(2)
    for (const h of links) expect(h, h).toMatch(/[?&]lesson=08(?:#|$)/)
    expect(links).toContain('/drum-night?drawer=learn&lesson=08')
    expect(links).toContain('/ear-lab?lesson=08')
  })

  it('writes "time signature" in lower case, never the team word "Signature"', () => {
    expect(PAGE).toMatch(/time signature/)
    expect(PAGE).not.toMatch(/Signature/)
  })

  it("keeps the next card's words to the kit, and its figure a drawing with no button", () => {
    // Act
    const card =
      /<div class="next-card[^"]*" data-next-card hidden>([\s\S]*?)<\/div>/.exec(
        PAGE,
      )?.[1] ?? ''

    // Assert
    expect(card).toMatch(/<svg\s+class="l08-tease"/)
    expect(card).toMatch(/aria-hidden="true"/)
    expect(card).not.toMatch(/<button|<a\b|<p\b/)
  })

  it('names a share card that is in public/, at the size its head gives', () => {
    // Arrange
    const image = metaOf('og:image')?.replace('https://mercurypitch.com/', '')

    // Act
    const size = jpegSize(
      readFileSync(resolve(process.cwd(), 'public', image ?? '')),
    )

    // Assert
    expect(image).toBe('learn/lesson-08-og.jpg')
    expect([size.width, size.height].map(String)).toEqual([
      metaOf('og:image:width'),
      metaOf('og:image:height'),
    ])
    expect([size.width, size.height]).toEqual([1200, 630])
  })

  it("says only what the claims check passes, in every line of its copy and the predicts' lines", () => {
    // Arrange: the page's text as a reader meets it, block by block
    const doc = new DOMParser().parseFromString(PAGE, 'text/html')
    const blocks = Array.from(
      doc.querySelectorAll(
        'main :is(p, li, h1, h2, h3, button, blockquote, summary, figcaption)',
      ),
      (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim(),
    ).filter((t) => t !== '')
    const predicts = [
      GUESS,
      HINTS,
      VERSION_SAID,
      PATTERN_GUESS,
      PATTERN_HINTS,
    ].flatMap((lines) => Object.values(lines))

    // Assert
    expect(blocks.length).toBeGreaterThan(150)
    for (const text of [...blocks, ...predicts]) {
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text }).violations,
        text,
      ).toEqual([])
      expect(text).not.toMatch(/[♯♭]/u)
    }
  })
})
