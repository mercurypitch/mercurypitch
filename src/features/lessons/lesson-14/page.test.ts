// ============================================================
// Lesson 14's page document — its names, its references, its order, its words
// ============================================================
//
// learn/14.html is hand-written markup, so some of its promises are held
// here: no accessible name, share card or live text carries a sign; every
// id a label or description points at exists, once; every button is a
// button, not a submit; there is no Watch section, because Lesson 14 has no
// film; the page opens on its cold open, the recall after it, shown to
// everyone, and before the four words; the hero has its seven chips, four
// lessons linked; Play take 1 plays freely, and take 2 waits for a choice;
// nothing before the reveal says what a swell does to the line; no two of
// the stage's controls share a name, and each phrase's names its words;
// the practice links carry the lesson, and the practice card has its rest
// version; the closing card's mark holds the still; the share card its
// head names is in public/, at its size; and every line of its copy says
// only what the claims check passes, and none scores or rates a take
// (WEB-SPEC, Tests).

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/14.html'), 'utf8')
const DIR = resolve(process.cwd(), 'src/features/lessons/lesson-14')

/** The share card's words. */
const SHARE_ALT =
  'The title card: Find Your Pitch, Lesson 14, Phrasing: sing a whole song, above the first line of “Twinkle, Twinkle, Little Star” as seven amber bands with its words, between Merc and Tavi.'

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

/** A control's accessible name: its label if it has one, else its words. */
const nameOf = (e: Element): string => e.getAttribute('aria-label') ?? words(e)

describe("Lesson 14's page", () => {
  it('puts no sign in an accessible name, a share card or a description: they are spoken', () => {
    // Arrange
    const named = [
      ...valuesOf('aria-label'),
      ...valuesOf('aria-valuetext'),
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

  it('carries no Watch section: Lesson 14 has no film', () => {
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
      'id="heroSong"',
      'id="heroPlay"',
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

  it("asks the recall of everyone, Lesson 5's two questions in a section of their own", () => {
    // Act
    const recall = doc().querySelector('#recall')

    // Assert
    expect(words(recall?.querySelector('h2'))).toBe('Recall from Lesson 5')
    expect(recall?.querySelector('#rc-qs')).not.toBeNull()
    expect(recall?.hasAttribute('hidden')).toBe(false)
  })

  it("names the lesson's seven chips: its minutes, four lessons linked, sound on and the microphone optional", () => {
    // Act
    const chips = Array.from(doc().querySelectorAll('.hero .meta > li'), (li) =>
      words(li),
    )
    const links = Array.from(
      doc().querySelectorAll<HTMLAnchorElement>('.hero a.chip-link'),
      (a) => a.getAttribute('href'),
    )

    // Assert
    expect(chips).toEqual([
      '18 minutes',
      'After Lesson 5: Steady note',
      'After Lesson 8: Beat and tempo',
      'After Lesson 9: Landing a leap',
      'After Lesson 12: Chords',
      'Sound on',
      'Microphone optional',
    ])
    expect(links).toEqual(['/learn/05', '/learn/08', '/learn/09', '/learn/12'])
  })

  it('plays take 1 freely and keeps take 2 locked until a choice', () => {
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
      ['take1', 'Play take 1', true, false],
      ['take2', 'Play take 2', false, true],
    ])
    expect(
      Array.from(doc().querySelectorAll('#predict .choice'), (b) => [
        (b as HTMLElement).dataset.choice,
        words(b),
      ]),
    ).toEqual([
      ['rises', 'It rises'],
      ['level', 'It stays level'],
    ])
  })

  it('says nothing before the reveal of what a swell does to the line: no level line, no steady pitch, no band it stays in', () => {
    // Arrange: the head and everything above the reveal, but the two choices themselves
    const before = PAGE.slice(0, PAGE.indexOf('class="reveal"'))
      .replace(/<div class="choices"[\s\S]*?<\/div>/, '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script[\s\S]*?<\/script>/g, (s) =>
        s.includes('ld+json') ? s : '',
      )
      .replace(/<[^>]+>/g, ' ')

    // Assert
    expect(before).not.toMatch(/\bstays? (level|in (its|the) band)\b/i)
    expect(before).not.toMatch(/\blevel line\b|\bsteady pitch\b|\bon pitch\b/i)
    expect(before).not.toMatch(/\bloud and high\b|\blouder without higher\b/i)
  })

  it("gives every control on the stage a name of its own, each phrase's with its words", () => {
    // Act
    const stage = doc().querySelector('#stepsStage')
    const names = Array.from(
      stage?.querySelectorAll('button, input') ?? [],
      nameOf,
    )
    const phrases = Array.from(
      stage?.querySelectorAll<HTMLButtonElement>('[data-phrase]') ?? [],
      (b) => [words(b), nameOf(b)],
    )

    // Assert
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([])
    expect(phrases).toEqual([
      ['Phrase 1', 'Play phrase 1: Twinkle, twinkle, little star'],
      ['Phrase 2', 'Play phrase 2: How I wonder what you are'],
      ['Phrase 3', 'Play phrase 3: Up above the world so high'],
      ['Phrase 4', 'Play phrase 4: Like a diamond in the sky'],
      ['Phrase 5', 'Play phrase 5: Twinkle, twinkle, little star'],
      ['Phrase 6', 'Play phrase 6: How I wonder what you are'],
    ])
    for (const [label, name] of phrases)
      expect(name.toLowerCase()).toContain(label.toLowerCase())
  })

  it('links every practice address with the lesson, each in a tab of its own', () => {
    // Act
    const links = Array.from(
      doc().querySelectorAll<HTMLAnchorElement>('a[href*="karaoke-night"]'),
      (a) => [a.getAttribute('href'), a.getAttribute('target')],
    )

    // Assert
    expect(links.length).toBe(2)
    for (const l of links)
      expect(l).toEqual(['/karaoke-night?lesson=14', '_blank'])
  })

  it('holds the practice card in both versions: the rest card with no "Ten minutes" line', () => {
    // Act
    const card = doc().querySelector('#practiseCard')
    const practise = card?.querySelector('[data-ending="practise"]')
    const rest = card?.querySelector('[data-ending="rest"]')

    // Assert
    expect(words(practise)).toContain(
      'Sing a whole song free: mercurypitch.com/karaoke-night',
    )
    expect(words(practise?.querySelector('.dose'))).toBe(
      'Ten minutes, gently, most days. Missed a day? Just come back.',
    )
    expect(words(rest)).toBe(
      'Rest today. Karaoke Night will be here when your voice feels comfortable: mercurypitch.com/karaoke-night',
    )
    expect(rest?.hasAttribute('hidden')).toBe(true)
  })

  it("keeps the song line's still in the closing card's mark, for the kit to keep after its words", () => {
    // Act
    const mark = doc().querySelector<HTMLElement>('#wrap [data-next-card]')

    // Assert
    expect(mark?.className).toBe('next-card card l14-next')
    expect(mark?.hidden).toBe(true)
    expect(Array.from(mark?.children ?? [], (k) => k.classList[0])).toEqual([
      'end-still',
    ])
    expect(mark?.querySelector('canvas')?.getAttribute('aria-label')).toBe(
      'The whole song as a line: six phrases, a breath mark after each of the first five, and the swell on each “star” drawn in light.',
    )
  })

  it('reads no draft switch: the page state decides (kit/drafts.ts)', () => {
    expect(modules.length).toBeGreaterThan(0)
    for (const m of modules)
      expect(m).not.toMatch(/DRAFT_LESSONS|DRAFTS_SHOWN|import\.meta\.env/)
  })

  it('makes no analyser, and loads the listener, the recorder and the take only from Sing it, after first paint', () => {
    // Arrange: the page's modules main.ts loads up front, by their static imports
    const source = (f: string): string =>
      readFileSync(resolve(DIR, `${f}.ts`), 'utf8')
    const upFront = new Set<string>()
    const visit = (f: string): void => {
      if (upFront.has(f)) return
      upFront.add(f)
      for (const [, local] of source(f).matchAll(
        /^import (?!type )[^\n]*? from '\.\/([\w-]+)'$/gm,
      ))
        visit(local)
    }
    visit('main')

    // Assert
    for (const m of modules)
      expect(m.replace(/^\s*\/\/.*$/gm, '')).not.toMatch(
        /createAnalyser|AnalyserNode/,
      )
    expect(upFront.has('sing')).toBe(true)
    expect(upFront.has('sing-take')).toBe(false)
    for (const f of upFront)
      expect(source(f), f).not.toMatch(
        /^import (?!type )[^\n]*? from '@\/features\/lessons\/kit\/(listen|record|take)'$/m,
      )
    expect(source('sing')).toMatch(/import\('\.\/sing-take'\)/)
    expect(source('sing')).toMatch(
      /import\('@\/features\/lessons\/kit\/record'\)/,
    )
  })

  it('names a share card that is in public/, at the size its head gives', () => {
    // Arrange
    const image = metaOf('og:image')?.replace('https://mercurypitch.com/', '')

    // Act
    const size = jpegSize(
      readFileSync(resolve(process.cwd(), 'public', image ?? '')),
    )

    // Assert
    expect(image).toBe('learn/lesson-14-og.jpg')
    expect([size.width, size.height].map(String)).toEqual([
      metaOf('og:image:width'),
      metaOf('og:image:height'),
    ])
    expect([size.width, size.height]).toEqual([1200, 630])
  })

  it('says only what the claims check passes, in every line of its copy, and never that it scores or rates a take', () => {
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
      // only the practice card names a score, Karaoke Night's own
      if (text.includes('Karaoke Night draws')) continue
      expect(text).not.toMatch(
        /\byour (score|grade|rating)\b|\b(well|nicely) (done|sung)\b|\bperfect take\b/i,
      )
    }
    // and Sing it invites no other try than its one Again
    const sing = Array.from(
      doc().querySelectorAll('#sing :is(p, li, button, summary)'),
      (e) => words(e),
    )
    expect(
      sing.filter((t) => /try again|another try|one more/i.test(t)),
    ).toEqual([])
  })
})
