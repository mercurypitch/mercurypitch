// ============================================================
// Lesson 12's page document — its spoken signs and numerals, its references, its order
// ============================================================
//
// learn/12.html is hand-written markup, so some of its promises are held
// here: every ♯ and ♭ its text prints is followed by its spoken name, the
// sign itself hidden from a screen reader; every Roman numeral its copy
// prints is hidden the same way, with its spoken form after it ("vi" is
// read "six minor", numerals.ts), and no numeral is ever read bare; no
// accessible name or share card carries a sign, and none a numeral; every
// id a label or description points at exists, once; every button is a
// button, not a submit; there is no Watch section, because Lesson 12 has no
// film; the page opens on its cold open, the recall after it, shown to
// everyone, and before the four words; the hero has its three chips; Play
// the four chords plays freely under the stage, and the two tunes wait for
// a choice; the practice links carry the lesson, and the practice card has
// its rest version, which sends no one to sing; the share card its head
// names is in public/, at its size; and every line of its copy says only
// what the claims check passes (WEB-SPEC, Tests 10). The stage's names,
// step by step, are steps.test.ts's.

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { spokenNumeral } from './numerals'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/12.html'), 'utf8')
const DIR = resolve(process.cwd(), 'src/features/lessons/lesson-12')

/** A sign as the page writes it, however the formatter wraps it: hidden, then said. */
const SPOKEN_SIGN =
  /<span\s+aria-hidden="true"\s*>[♯♭]<\/span\s*>\s*<span\s+class="sr"\s*>\s(?:sharp|flat)<\/span\s*>/g

/** A Roman numeral, or a progression of them joined by en dashes, as the page prints it. */
const NUMERAL = /^(?:[IV]+|[iv]+)[°+]?(?:–(?:[IV]+|[iv]+)[°+]?)*$/

/** A numeral standing alone in running text: not part of a word, nor the "I" of "I'm". */
const BARE_NUMERAL = /(?<![\p{L}\p{N}'’])(?:[IV]+|[iv]+)°?(?![\p{L}\p{N}'’])/u

/** The share card's words. */
const SHARE_ALT =
  'The title card: Find Your Pitch, Lesson 12, Chords and the four-chord song, above four chord shapes on a ring of twelve notes, between Merc and Tavi.'

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

/** Every text a screen reader reads in `root`: scripts, styles and hidden parts left out. */
function readerTexts(root: Element): string[] {
  const texts: string[] = []
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      texts.push(node.textContent ?? '')
      return
    }
    if (!(node instanceof Element)) return
    if (node.matches('script, style, svg, [aria-hidden="true"]')) return
    node.childNodes.forEach(walk)
  }
  walk(root)
  return texts
}

describe("Lesson 12's page", () => {
  it('follows every ♯ and ♭ it prints with its spoken name', () => {
    // Arrange
    const signs = PAGE.match(/[♯♭]/g) ?? []

    // Act
    const bare = PAGE.replace(SPOKEN_SIGN, '').match(/[♯♭]/g) ?? []

    // Assert
    expect(signs.length).toBeGreaterThan(0)
    expect(bare).toEqual([])
  })

  it('hides every Roman numeral its copy prints, with its spoken form after it, and reads none bare', () => {
    // Arrange
    const page = doc()
    const shown = Array.from(
      page.querySelectorAll('main [aria-hidden="true"]'),
    ).filter((e) => NUMERAL.test(words(e)))

    // Act: what follows each, and any numeral a reader would meet as it is
    const unspoken = shown.flatMap((e) => {
      const said = e.nextElementSibling
      const want = spokenNumeral(words(e))
      const heard = said?.matches('.sr') === true ? words(said) : ''
      return heard === want || heard === `chord ${want}`
        ? []
        : [`${words(e)} → "${heard}"`]
    })
    const bare = readerTexts(page.body).filter((t) => BARE_NUMERAL.test(t))

    // Assert: WEB-SPEC, Toys 8, Spoken numerals
    expect(shown.length).toBeGreaterThan(30)
    expect(unspoken).toEqual([])
    expect(bare).toEqual([])
  })

  it('puts no sign in an accessible name or a share card, and no numeral in a name or the card: they are spoken', () => {
    // Arrange
    const named = [
      ...valuesOf('aria-label'),
      ...valuesOf('aria-valuetext'),
      ...valuesOf('alt'),
    ]
    const card = [metaOf('og:image:alt'), metaOf('twitter:image:alt')]

    // Assert
    expect(named.length).toBeGreaterThan(0)
    expect(card).toEqual([SHARE_ALT, SHARE_ALT])
    expect(
      [...named, ...valuesOf('content')].filter((v) => /[♯♭]/.test(v)),
    ).toEqual([])
    expect(
      [...named, ...card].filter((v) => BARE_NUMERAL.test(v ?? '')),
    ).toEqual([])
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
    expect(buttons.length).toBeGreaterThan(20)
    for (const b of buttons) expect(b, b).toMatch(/type="button"/)
  })

  it('carries no Watch section: Lesson 12 has no film', () => {
    expect(PAGE).not.toMatch(/id="watch"/)
    expect(PAGE).not.toMatch(/<video/)
  })

  it('opens on the hook and the cold open, the recall after it and before the four words', () => {
    // Act: each part's place in the document
    const at = [
      'id="hook"',
      'id="heroStage"',
      'id="predict"',
      'id="recall"',
      'id="words"',
    ].map((s) => PAGE.indexOf(s))

    // Assert: CURIOSITY-MOMENTS § 3.1, as Lessons 2 and 4 to 10 run
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('asks the recall of everyone, in a section of its own: Lesson 10 comes first, so it needs no live wrapper', () => {
    // Act
    const hero = /<section class="hero[^"]*"[\s\S]*?<\/section>/.exec(PAGE)?.[0]

    // Assert
    expect(hero).toContain('id="predict"')
    expect(hero).not.toContain('id="recall"')
    expect(PAGE).not.toMatch(/data-if-live/)
    expect(PAGE).toMatch(/<section class="mv" id="recall"/)
  })

  it("names the lesson's three chips: its minutes, Lesson 10 linked, and sound on", () => {
    // Act
    const chips = Array.from(
      doc().querySelectorAll('.hero ul.meta .chip'),
      (c) => [words(c), c.getAttribute('href')].join(' → '),
    )

    // Assert: WEB-SPEC, Sections, item 2
    expect(chips).toEqual([
      '15 minutes → ',
      'After Lesson 10: Major and minor → /learn/10',
      'Sound on → ',
    ])
  })

  it('plays the four chords freely under the stage, outside the predict, and keeps the two tunes locked until a choice', () => {
    // Arrange
    const page = doc()
    const predict = page.querySelector('#predict')

    // Act
    const plays = Array.from(
      page.querySelectorAll<HTMLButtonElement>('.hero-plays [data-play]'),
      (b) => [
        b.dataset.play,
        words(b),
        b.dataset.free !== undefined,
        b.disabled,
      ],
    )

    // Assert: WEB-SPEC, Toys 3, Cold open
    expect(plays).toEqual([
      ['loop-c', 'Play the four chords', true, false],
      ['tune-1', 'Play tune 1', false, true],
      ['tune-2', 'Play tune 2', false, true],
    ])
    expect(predict?.querySelectorAll('[data-play]')).toHaveLength(0)
    expect(
      Array.from(predict?.querySelectorAll('.choice') ?? [], (c) => words(c)),
    ).toEqual(['Most of them', 'Hardly any'])
    expect(words(predict?.querySelector('.lock-hint'))).toBe(
      'Choose an answer to unlock the two tunes.',
    )
  })

  it('links every practice drill with the lesson, before any hash, each in a tab of its own', () => {
    // Act
    const page = doc()
    const links = Array.from(
      page.querySelectorAll<HTMLAnchorElement>('a[href]'),
    ).filter((a) =>
      /^\/(pitch-training|ear-lab|exercises)/.test(
        a.getAttribute('href') ?? '',
      ),
    )
    const hrefs = links.map((a) => a.getAttribute('href') ?? '')

    // Assert: Arpeggio Jumper and Ear Lab's Cadence, on the card and in the footer
    expect(new Set(hrefs)).toEqual(
      new Set(['/pitch-training?lesson=12', '/ear-lab?lesson=12']),
    )
    for (const h of hrefs) expect(h, h).toMatch(/[?&]lesson=12(?:#|$)/)
    for (const a of links)
      expect([a.target, a.rel], a.getAttribute('href') ?? '').toEqual([
        '_blank',
        'noopener',
      ])
  })

  it('holds the practice card in both versions: the rest card names Arpeggio Jumper in words only, and Cadence stays linked under either', () => {
    // Arrange
    const card = doc().querySelector('#practiseCard')
    const version = (ending: string): Element | null | undefined =>
      card?.querySelector(`[data-ending="${ending}"]`)
    const linksIn = (e: Element | null | undefined): string[] =>
      Array.from(
        e?.querySelectorAll('a') ?? [],
        (a) => a.getAttribute('href') ?? '',
      )

    // Act
    const practise = version('practise')
    const rest = version('rest')
    const second = card?.querySelector('.second-drill')

    // Assert: WEB-SPEC, Sections, item 8, and Practice links; REQ-GVC-055
    expect(words(card?.querySelector('h3'))).toBe('Arpeggio Jumper')
    expect(linksIn(practise)).toEqual(['/pitch-training?lesson=12'])
    expect(practise?.hasAttribute('hidden')).toBe(false)
    expect(rest?.hasAttribute('hidden')).toBe(true)
    expect(linksIn(rest)).toEqual([])
    expect(words(rest)).toBe(
      'Rest today. Arpeggio Jumper will be here when your voice feels comfortable: mercurypitch.com/pitch-training, then tap Arpeggio Jumper.',
    )
    expect(second?.closest('[data-ending]')).toBeNull()
    expect(linksIn(second)).toEqual(['/ear-lab?lesson=12'])
    expect(words(second)).toMatch(/then tap Cadence\.$/)
  })

  it('reads no draft switch: the page state decides (kit/drafts.ts)', () => {
    expect(modules.length).toBeGreaterThan(0)
    for (const m of modules)
      expect(m).not.toMatch(/DRAFT_LESSONS|DRAFTS_SHOWN|import\.meta\.env/)
  })

  it('names a share card that is in public/, at the size its head gives', () => {
    // Arrange
    const image = metaOf('og:image')?.replace('https://mercurypitch.com/', '')

    // Act
    const size = jpegSize(
      readFileSync(resolve(process.cwd(), 'public', image ?? '')),
    )

    // Assert
    expect(image).toBe('learn/lesson-12-og.jpg')
    expect([size.width, size.height].map(String)).toEqual([
      metaOf('og:image:width'),
      metaOf('og:image:height'),
    ])
    expect([size.width, size.height]).toEqual([1200, 630])
  })

  it('says only what the claims check passes, in every line of its copy', () => {
    // Arrange: the page's text as a reader meets it, block by block
    const blocks = Array.from(
      doc().querySelectorAll(
        'main :is(p, li, h1, h2, h3, h4, button, blockquote, summary, figcaption)',
      ),
      (e) => words(e),
    ).filter((t) => t !== '')

    // Assert
    expect(blocks.length).toBeGreaterThan(120)
    for (const text of blocks)
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text }).violations,
        text,
      ).toEqual([])
  })
})
