// ============================================================
// Lesson copy tests — picking a hook or tease, and the season's own copy
// ============================================================

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseLessonPatch, VARIANT_ID } from '@/lib/lesson-state'
import type { LessonCopy } from './lesson-copy'
import { DEFAULT_ID, hookChoices, hookFor, hookMarkup, isHookMarkup, LESSON_COPY, SEASON_END, TEASE_MAX, teaseChoices, teaseFor, } from './lesson-copy'
import { LESSONS } from './season'

/** A lesson's copy for a resolver test: a default hook, one alternative with markup and one without, a tease with one alternative. */
const copy: LessonCopy = {
  hook: 'Why the default?',
  hookAlts: [
    {
      id: 'plain',
      text: 'Is 3 < 4 & so on?',
      note: 'An alternative with no markup.',
    },
    {
      id: 'styled',
      text: 'Why 440 Hz?',
      html: 'Why <span class="hz o">440&#8239;Hz</span>?',
      note: 'An alternative with markup of its own.',
    },
  ],
  tease: 'The default tease.',
  teaseAlts: [{ id: 'short', text: 'A shorter tease.', note: 'Shorter.' }],
}

/** The team's words, which no hook or tease a page could draw may carry (learn-no-planning-text.spec.ts). */
const PLANNING =
  /Signature|deep link|\bslug\b|in production|\bplanned\b|durationSec|launch field|placeholder|proof episode|still rendering|for the team|\bblueprint\b|\b[TS]\d\d\b/i

/** Every hook a page could draw: each lesson's default and its alternatives. */
const HOOKS = LESSONS.flatMap((L) => [
  [L.n, L.hook] as const,
  ...(L.hookAlts ?? []).map((v) => [L.n, v.text] as const),
])

/** Every tease a card could draw. */
const TEASES = LESSONS.flatMap((L) => [
  ...(L.tease === undefined ? [] : [[L.n, L.tease] as const]),
  ...(L.teaseAlts ?? []).map((v) => [L.n, v.text] as const),
])

/** Every variant's team note. */
const NOTES = Object.values(LESSON_COPY).flatMap((c) =>
  [...(c?.hookAlts ?? []), ...(c?.teaseAlts ?? [])].map((v) => v.note),
)

/** Text as a reader meets it: entities read, runs of space (U+202F among them) one space. */
const flat = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** Markup's text, as a browser reads it. */
function markupText(html: string): string {
  const box = document.createElement('div')
  box.innerHTML = html
  return flat(box.textContent ?? '')
}

describe('hookFor', () => {
  it("gives the lesson's default hook for no id, an unknown id or 'default'", () => {
    // Act
    const picked = [undefined, null, 'gone', DEFAULT_ID].map((id) =>
      hookFor(copy, id),
    )

    // Assert: the default's markup is the page's own, so none is given
    for (const hook of picked)
      expect(hook).toEqual({
        id: 'default',
        text: 'Why the default?',
        html: null,
      })
  })

  it('gives an alternative by its id, its text escaped as markup when it has none', () => {
    // Act
    const hook = hookFor(copy, 'plain')

    // Assert
    expect(hook).toEqual({
      id: 'plain',
      text: 'Is 3 < 4 & so on?',
      html: 'Is 3 &lt; 4 &amp; so on?',
    })
  })

  it('gives an alternative its own markup', () => {
    // Act
    const hook = hookFor(copy, 'styled')

    // Assert
    expect(hook.html).toBe('Why <span class="hz o">440&#8239;Hz</span>?')
  })
})

describe('hookMarkup', () => {
  it("writes an alternative's markup for the page's title, and nothing where the page's own title stands", () => {
    // Arrange
    const season = { 7: copy }

    // Act
    const styled = hookMarkup(7, 'styled', season)
    const plain = hookMarkup(7, 'plain', season)
    const none = [null, DEFAULT_ID, 'gone'].map((id) =>
      hookMarkup(7, id, season),
    )
    const otherLesson = hookMarkup(8, 'styled', season)

    // Assert
    expect(styled).toBe('Why <span class="hz o">440&#8239;Hz</span>?')
    expect(plain).toBe('Is 3 &lt; 4 &amp; so on?')
    expect(none).toEqual([null, null, null])
    expect(otherLesson).toBeNull()
  })
})

describe('teaseFor', () => {
  it('gives the default tease for no id or an unknown one, and an alternative by its id', () => {
    // Act
    const fallback = [null, 'gone', DEFAULT_ID].map((id) => teaseFor(copy, id))
    const alt = teaseFor(copy, 'short')

    // Assert
    expect(fallback).toEqual(
      Array(3).fill({ id: 'default', text: 'The default tease.' }),
    )
    expect(alt).toEqual({ id: 'short', text: 'A shorter tease.' })
  })

  it('gives none for a lesson with no tease', () => {
    // Act
    const tease = teaseFor({ hook: 'Why?' }, 'short')

    // Assert
    expect(tease).toBeNull()
  })
})

describe('hookChoices and teaseChoices', () => {
  it('list the default first, then every alternative with its note', () => {
    // Act
    const hooks = hookChoices(copy)
    const teases = teaseChoices(copy)

    // Assert
    expect(hooks).toEqual([
      { id: 'default', text: 'Why the default?', note: '', isDefault: true },
      {
        id: 'plain',
        text: 'Is 3 < 4 & so on?',
        note: 'An alternative with no markup.',
        isDefault: false,
      },
      {
        id: 'styled',
        text: 'Why 440 Hz?',
        note: 'An alternative with markup of its own.',
        isDefault: false,
      },
    ])
    expect(teases.map((c) => [c.id, c.isDefault])).toEqual([
      ['default', true],
      ['short', false],
    ])
  })

  it('offer a lesson with no alternatives its default hook alone, and no tease at all', () => {
    // Act
    const hooks = hookChoices({ hook: 'Why?' })
    const teases = teaseChoices({ hook: 'Why?' })

    // Assert
    expect(hooks).toEqual([
      { id: 'default', text: 'Why?', note: '', isDefault: true },
    ])
    expect(teases).toEqual([])
  })
})

describe('isHookMarkup', () => {
  it('takes text, entities and spans named by a class', () => {
    // Act
    const ok = [
      'Plain text?',
      'If <span class="hz o">440&#8239;Hz</span> shakes the air?',
      'Told to &#8220;support&#8221; it?',
      'Why <span class="nw">do-re-mi</span> &amp; <span class="a b">ti</span>?',
    ].map(isHookMarkup)

    // Assert
    expect(ok).toEqual([true, true, true, true])
  })

  it('refuses any other tag or attribute, a stray bracket and a span left open or closed twice', () => {
    // Act
    const refused = [
      'Why <b>this</b>?',
      'Why <span style="color:red">this</span>?',
      'Why <span class="a" onclick="x()">this</span>?',
      'Is 3 < 4?',
      'Why <span class="a">this?',
      'Why this</span>?',
      'Why <img src=x onerror=alert(1)>?',
      'A bare & ampersand?',
    ].map(isHookMarkup)

    // Assert
    expect(refused).toEqual(Array(8).fill(false))
  })
})

describe("the season's copy", () => {
  it("gives every variant an id the console can store, unique within its lesson and never 'default'", () => {
    for (const L of LESSONS) {
      // Act
      const ids = [...(L.hookAlts ?? []), ...(L.teaseAlts ?? [])].map(
        (v) => v.id,
      )

      // Assert
      for (const id of ids) {
        expect(id, `lesson ${L.n}`).toMatch(VARIANT_ID)
        expect(id, `lesson ${L.n}`).not.toBe(DEFAULT_ID)
      }
      expect(new Set(ids).size, `lesson ${L.n}`).toBe(ids.length)
    }
  })

  it("has the lesson state's admin write take every variant's id for its own field", () => {
    for (const L of LESSONS) {
      // Act: the body PUT /api/admin/lessons/:n is sent for each choice
      const saves = [
        ...(L.hookAlts ?? []).map((v) => parseLessonPatch({ hook: v.id })),
        ...(L.teaseAlts ?? []).map((v) => parseLessonPatch({ tease: v.id })),
      ]

      // Assert
      for (const save of saves) expect(save.ok, `lesson ${L.n}`).toBe(true)
    }
  })

  it('ends every hook in a question mark, default or alternative', () => {
    // Assert
    expect(HOOKS.length).toBeGreaterThan(LESSONS.length)
    for (const [n, hook] of HOOKS) expect(hook, `lesson ${n}`).toMatch(/\?$/)
  })

  it(`keeps every tease to one line of at most ${TEASE_MAX} characters`, () => {
    // Assert
    expect(TEASES.length).toBeGreaterThan(0)
    for (const [n, tease] of TEASES) {
      expect(tease.length, `lesson ${n}: ${tease}`).toBeLessThanOrEqual(
        TEASE_MAX,
      )
      expect(tease, `lesson ${n}`).not.toMatch(/\n/)
    }
  })

  it('teases Lessons 2 and 4 to 14 in the plan’s lines, and leaves Lesson 3 to the figures on Lesson 2’s card', () => {
    // Act
    const teased = LESSONS.filter((L) => L.tease !== undefined).map((L) => L.n)

    // Assert
    expect(teased).toEqual([2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(LESSONS[9].tease).toBe(
      'One note, two ways up: step by step, or one leap.',
    )
    expect(LESSONS[10].tease).toBe(
      'Three notes, one chord. Move one by a semitone.',
    )
    expect(LESSONS[11].tease).toBe('Slide up slowly, and your voice may flip.')
  })

  it("sets a tease's alternatives only beside a tease, and a note on every variant", () => {
    for (const L of LESSONS) {
      // Assert
      if (L.teaseAlts !== undefined)
        expect(L.tease, `lesson ${L.n}`).toBeDefined()
      for (const v of [...(L.hookAlts ?? []), ...(L.teaseAlts ?? [])])
        expect(v.note.trim(), `lesson ${L.n}, ${v.id}`).not.toBe('')
    }
  })

  it("writes every variant's markup as hook markup that reads as its text", () => {
    for (const L of LESSONS)
      for (const v of L.hookAlts ?? []) {
        if (v.html === undefined) continue

        // Assert
        expect(isHookMarkup(v.html), `lesson ${L.n}, ${v.id}`).toBe(true)
        expect(markupText(v.html), `lesson ${L.n}, ${v.id}`).toBe(flat(v.text))
      }
  })

  it("keeps the team's words out of every hook and tease a page could draw", () => {
    // Assert
    for (const [n, text] of [
      ...HOOKS,
      ...TEASES,
      [14, SEASON_END.line] as const,
    ])
      expect(text, `lesson ${n}`).not.toMatch(PLANNING)
  })

  it('keeps "hundreds" and mood labels out of every default hook and tease', () => {
    // Arrange: an alternative may keep the old wording, its note saying why
    const drawn = LESSONS.flatMap((L) => [L.hook, L.tease ?? ''])

    // Assert
    for (const text of drawn)
      expect(text).not.toMatch(/\bhundreds\b|\b(?:bright|dark|sad|happy)\b/i)
  })

  it('keeps the current wording of every changed hook as an alternative', () => {
    // Act
    const kept = LESSONS.flatMap((L) =>
      (L.hookAlts ?? []).map((v) => [L.n, v.id] as const),
    )

    // Assert: the owner's answer to the plan's § 5 item 2
    expect(kept).toEqual([
      [3, 'figures'],
      [7, 'two-questions'],
      [9, 'harder'],
      [10, 'bright-dark'],
      [11, 'same-note'],
      [12, 'hundreds'],
      [14, 'compelling'],
    ])
  })
})

describe('the module', () => {
  it('imports nothing and reads neither import.meta nor the DOM, so the site worker can load it', () => {
    // Arrange: its code, without the comments that say so
    const code = readFileSync(
      resolve(process.cwd(), 'src/features/lessons/kit/lesson-copy.ts'),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')

    // Assert
    expect(code).not.toMatch(/^\s*(?:import|export\s.*\sfrom)\s/m)
    expect(code).not.toMatch(/import\.meta|\bdocument\b|\bwindow\b/)
  })
})

describe('the lesson pages', () => {
  /** Every lesson page in the repository, as its number and its parsed document. */
  const PAGES = readdirSync(resolve(process.cwd(), 'learn'))
    .map((name) => /^(\d{2})\.html$/.exec(name)?.[1])
    .filter((nn): nn is string => nn !== undefined)
    .map((nn) => {
      const html = readFileSync(
        resolve(process.cwd(), `learn/${nn}.html`),
        'utf8',
      )
      return {
        n: Number(nn),
        html,
        doc: new DOMParser().parseFromString(html, 'text/html'),
      }
    })

  const meta = (doc: Document, sel: string): string =>
    flat(doc.querySelector(sel)?.getAttribute('content') ?? '')

  it("titles every page with its lesson's default hook", () => {
    // Assert
    expect(PAGES.length).toBeGreaterThan(0)
    for (const { n, doc } of PAGES) {
      const h1 = doc.querySelector('h1.hook#hook')
      expect(flat(h1?.textContent ?? ''), `lesson ${n}`).toBe(
        flat(LESSONS[n].hook),
      )
    }
  })

  it('opens every page’s shared descriptions on that hook, and names it as the headline’s alternative', () => {
    for (const { n, doc } of PAGES) {
      // Arrange
      const hook = flat(LESSONS[n].hook)
      const ld = doc.querySelector('script[type="application/ld+json"]')
      const headline: unknown =
        ld === null
          ? undefined
          : (
              JSON.parse(ld.textContent ?? '{}') as {
                alternativeHeadline?: unknown
              }
            ).alternativeHeadline

      // Assert
      expect(
        meta(doc, 'meta[property="og:description"]').startsWith(hook),
        `lesson ${n}: og:description`,
      ).toBe(true)
      expect(meta(doc, 'meta[name="twitter:description"]'), `lesson ${n}`).toBe(
        hook,
      )
      if (headline !== undefined) expect(headline, `lesson ${n}`).toBe(hook)
    }
  })

  it("carries no variant's team note anywhere in its markup", () => {
    // Assert
    expect(NOTES.length).toBeGreaterThan(0)
    for (const { n, html } of PAGES)
      for (const note of NOTES)
        expect(html.includes(note), `lesson ${n}: ${note}`).toBe(false)
  })
})
