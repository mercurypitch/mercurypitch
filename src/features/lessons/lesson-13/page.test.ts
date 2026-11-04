// ============================================================
// Lesson 13's page document — its names, its references, its order, its words
// ============================================================
//
// learn/13.html is hand-written markup, so some of its promises are held
// here: no accessible name, share card or live text carries a sign; every
// id a label or description points at exists, once; every button is a
// button, not a submit; there is no Watch section, because Lesson 13 has no
// film; the page opens on its cold open, the recall after it, shown to
// everyone, and before the four words; the hero has its four chips, Lesson
// 11 linked; Play Merc's ‘ee’ plays freely, and ‘ee’, then ‘ah’ waits for a
// choice; nothing before the reveal says what the bars do; every vowel
// button's name begins with its label; the practice links carry the lesson,
// and the practice card has its rest version; the share card its head
// names is in public/, at its size; and every line of its copy says only
// what the claims check passes, and none claims to hear or check a vowel
// (WEB-SPEC, Tests 8 and 9).

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/13.html'), 'utf8')
const DIR = resolve(process.cwd(), 'src/features/lessons/lesson-13')

/** The share card's words. */
const SHARE_ALT =
  'The title card: Find Your Pitch, Lesson 13, Resonance and vowels, above an amber pitch line held level over a strip of bars, two of them marked, between Merc and Tavi.'

/** A meta tag's content, however the formatter wraps the tag. */
const metaOf = (property: string): string | undefined =>
  new RegExp(`(?:property|name)="${property}"\\s+content="([^"]*)"`).exec(
    PAGE,
  )?.[1]

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

const doc = (): Document => new DOMParser().parseFromString(PAGE, 'text/html')

/** An element's words, as a reader meets them. */
const words = (e: Element | null | undefined): string =>
  (e?.textContent ?? '').replace(/\s+/g, ' ').trim()

describe("Lesson 13's page", () => {
  it('puts no sign in an accessible name, a share card or a description: they are spoken', () => {
    // Arrange
    const named = [
      ...valuesOf('aria-label'),
      ...valuesOf('alt'),
      ...valuesOf('content'),
    ]

    // Assert
    expect(named.length).toBeGreaterThan(0)
    expect([metaOf('og:image:alt'), metaOf('twitter:image:alt')]).toEqual([
      SHARE_ALT,
      SHARE_ALT,
    ])
    expect(named.filter((v) => /[♯♭]/.test(v))).toEqual([])
  })

  it('points every label and description at an id that exists, once', () => {
    // Arrange
    const ids = valuesOf('id')
    const refs = [
      ...valuesOf('aria-labelledby'),
      ...valuesOf('aria-describedby'),
      ...valuesOf('for'),
    ].flatMap((v) => v.split(/\s+/))

    // Act
    const missing = refs.filter((r) => !ids.includes(r))
    const twice = ids.filter((id, i) => ids.indexOf(id) !== i)

    // Assert
    expect(refs.length).toBeGreaterThan(0)
    expect(missing).toEqual([])
    expect(twice).toEqual([])
  })

  it('makes every button a plain button', () => {
    // Act
    const buttons = Array.from(PAGE.matchAll(/<button\b[^>]*>/g), (m) => m[0])

    // Assert
    expect(buttons.length).toBeGreaterThan(30)
    for (const b of buttons) expect(b, b).toMatch(/type="button"/)
  })

  it('carries no Watch section: Lesson 13 has no film', () => {
    expect(PAGE).not.toMatch(/id="watch"/)
    expect(PAGE).not.toMatch(/<video/)
    expect(words(doc().querySelector('#mastNav'))).toBe(
      'ILesson IISing IIIExplorer',
    )
  })

  it('opens on the hook and the cold open, the recall after it and before the four words', () => {
    // Act: each part's place in the document
    const at = [
      'id="hook"',
      'id="heroStage"',
      'id="stripGloss"',
      'id="predict"',
      'id="recall"',
      'id="words"',
      'id="lesson"',
      'id="sing"',
      'id="check"',
      'id="wrap"',
      'id="explorer"',
    ].map((mark) => PAGE.indexOf(mark))

    // Assert
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it("asks the recall of everyone, Lesson 11's two questions in a section of their own", () => {
    // Act
    const recall = doc().querySelector('#recall')

    // Assert
    expect(words(recall?.querySelector('h2'))).toBe('Recall from Lesson 11')
    expect(recall?.querySelector('#recall-qs')).not.toBeNull()
    expect(recall?.hasAttribute('hidden')).toBe(false)
  })

  it("names the lesson's four chips: its minutes, Lesson 11 linked, sound on and the microphone optional", () => {
    // Act
    const chips = Array.from(doc().querySelectorAll('.hero .meta > li'), (li) =>
      words(li),
    )
    const link = doc().querySelector<HTMLAnchorElement>('.hero a.chip-link')

    // Assert
    expect(chips).toEqual([
      '16 minutes',
      'After Lesson 11: Registers and the break',
      'Sound on',
      'Microphone optional',
    ])
    expect(link?.getAttribute('href')).toBe('/learn/11')
  })

  it("plays Merc's ‘ee’ freely and keeps ‘ee’, then ‘ah’ locked until a choice", () => {
    // Act
    const plays = Array.from(
      doc().querySelectorAll<HTMLButtonElement>('.hero [data-play]'),
      (b) => [
        b.dataset.play,
        words(b),
        b.hasAttribute('data-free'),
        b.disabled,
      ],
    )

    // Assert
    expect(plays).toEqual([
      ['ee', "Play Merc's ‘ee’", true, false],
      ['ee-ah', 'Play ‘ee’, then ‘ah’', false, true],
    ])
    expect(
      Array.from(doc().querySelectorAll('#predict .choice'), (b) => words(b)),
    ).toEqual(['Their heights', 'Their places'])
  })

  it('says nothing before the reveal of what the bars do: no heights, no louder, no softer, no bar of ‘ah’', () => {
    // Arrange: the head and everything above the reveal, but the two choices themselves
    const before = PAGE.slice(0, PAGE.indexOf('class="reveal"'))
      .replace(/<div class="choices"[\s\S]*?<\/div>/, '')
      .replace(/<script[\s\S]*?<\/script>/g, (s) =>
        s.includes('ld+json') ? s : '',
      )
      .replace(/<[^>]+>/g, ' ')

    // Assert
    expect(before).not.toMatch(/\bheights?\b(?! is how loud)/i)
    expect(before).not.toMatch(/\blouder\b|\bsofter\b/i)
    expect(before).not.toMatch(/3rd|5th/)
  })

  it("begins every vowel button's name with its label, then its British word", () => {
    // Act
    const vowels = Array.from(
      doc().querySelectorAll<HTMLButtonElement>('button[data-vowel]'),
      (b) => [words(b), b.getAttribute('aria-label') ?? ''],
    )

    // Assert
    expect(vowels.length).toBe(15)
    for (const [label, name] of vowels) {
      expect(name.startsWith(label), name).toBe(true)
      expect(name).toMatch(/, as in (key|pet|half|paw|coo)$/)
    }
  })

  it('links every practice address with the lesson, each in a tab of its own', () => {
    // Act
    const links = Array.from(
      doc().querySelectorAll<HTMLAnchorElement>('a[href*="mirror"]'),
      (a) => [a.getAttribute('href'), a.getAttribute('target')],
    )

    // Assert
    expect(links.length).toBe(2)
    for (const l of links) expect(l).toEqual(['/mirror?lesson=13', '_blank'])
  })

  it('holds the practice card in both versions: the rest card with no "Ten minutes" line', () => {
    // Act
    const card = doc().querySelector('#practiseCard')
    const practise = card?.querySelector('[data-ending="practise"]')
    const rest = card?.querySelector('[data-ending="rest"]')

    // Assert
    expect(words(practise)).toContain(
      'reads your pitch, never your vowel. Keep the glides comfortable.',
    )
    expect(words(practise?.querySelector('.dose'))).toBe(
      'Ten minutes, gently, most days. Missed a day? Just come back.',
    )
    expect(words(rest)).toBe(
      'Voice Mirror will be here when your voice feels comfortable: mercurypitch.com/mirror',
    )
    expect(rest?.hasAttribute('hidden')).toBe(true)
  })

  it('reads no draft switch: the page state decides (kit/drafts.ts)', () => {
    expect(modules.length).toBeGreaterThan(0)
    for (const m of modules)
      expect(m).not.toMatch(/DRAFT_LESSONS|DRAFTS_SHOWN|import\.meta\.env/)
  })

  it('makes no analyser and loads no listener in any of its modules up front (WEB-SPEC, Tests 8)', () => {
    for (const m of modules) {
      const code = m.replace(/^\s*\/\/.*$/gm, '')
      expect(code).not.toMatch(/createAnalyser|AnalyserNode/)
      expect(m).not.toMatch(/^import .*kit\/listen'/m)
    }
  })

  it('names a share card that is in public/, at the size its head gives', () => {
    // Arrange
    const image = metaOf('og:image')?.replace('https://mercurypitch.com/', '')

    // Act
    const size = jpegSize(
      readFileSync(resolve(process.cwd(), 'public', image ?? '')),
    )

    // Assert
    expect(image).toBe('learn/lesson-13-og.jpg')
    expect([size.width, size.height].map(String)).toEqual([
      metaOf('og:image:width'),
      metaOf('og:image:height'),
    ])
    expect([size.width, size.height]).toEqual([1200, 630])
  })

  it('says only what the claims check passes, in every line of its copy, and never that it hears or checks a vowel', () => {
    // Arrange: the page's text as a reader meets it, block by block
    const blocks = Array.from(
      doc().querySelectorAll(
        'main :is(p, li, h1, h2, h3, h4, button, blockquote, summary, figcaption)',
      ),
      (e) => words(e),
    ).filter((t) => t !== '')

    // Assert
    expect(blocks.length).toBeGreaterThan(120)
    for (const text of blocks) {
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text }).violations,
        text,
      ).toEqual([])
      expect(text).not.toMatch(
        /heard your|your vowel (is|was)|pronunciation|correct vowel|match(es|ed)? (the|your) vowel/i,
      )
    }
  })
})
