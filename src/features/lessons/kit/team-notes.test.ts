// ============================================================
// Team notes tests — one signature per lesson, one note per variant
// ============================================================
//
// The notes are joined to the season by lesson number and variant id
// (admin/lessons/copy-choices.ts, admin/lessons/lesson-admin.ts), so nothing
// else notices a variant written without its note, a note left behind when
// its variant goes, or a note filed under the wrong kind. And the team's
// words stay off every lesson page: the build keeps the module off their
// first paint (scripts/assert-first-paint-budgets.mjs), and the pages'
// markup is read here.

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CuriosityCopy, HookVariant, TeaseVariant } from './lesson-copy'
import { LESSON_COPY } from './lesson-copy'
import { LESSONS } from './season'
import type { VariantNotes } from './team-notes'
import { HOOK_NOTES, SIGNATURES, TEASE_NOTES } from './team-notes'
import { TEAM_STRINGS } from './team-notes.test-fixtures'

type Notes = Readonly<Partial<Record<number, VariantNotes>>>

/** Every variant of one kind in the copy, as [lesson, id]. */
function variantsOf(
  pick: (copy: CuriosityCopy) => readonly (HookVariant | TeaseVariant)[],
): (readonly [n: number, id: string])[] {
  return Object.entries(LESSON_COPY).flatMap(([n, copy]) =>
    copy === undefined ? [] : pick(copy).map((v) => [Number(n), v.id] as const),
  )
}

/** Every note of one kind, as [lesson, id]. */
const notesOf = (notes: Notes): (readonly [n: number, id: string])[] =>
  Object.entries(notes).flatMap(([n, byId]) =>
    Object.keys(byId ?? {}).map((id) => [Number(n), id] as const),
  )

const key = ([n, id]: readonly [number, string]): string => `${n}:${id}`

describe.each([
  {
    kind: 'hook',
    variants: variantsOf((c) => c.hookAlts ?? []),
    notes: HOOK_NOTES,
  },
  {
    kind: 'tease',
    variants: variantsOf((c) => c.teaseAlts ?? []),
    notes: TEASE_NOTES,
  },
])('$kind notes', ({ variants, notes }) => {
  it('give every variant in the copy a note of its own', () => {
    // Assert: one id per variant, so no two variants share a note
    expect(variants.length).toBeGreaterThan(0)
    expect(new Set(variants.map(key)).size).toBe(variants.length)
    for (const [n, id] of variants)
      expect(notes[n]?.[id]?.trim() ?? '', `lesson ${n}, ${id}`).not.toBe('')
  })

  it('name only variants of their own kind that the copy holds', () => {
    // Act
    const held = new Set(variants.map(key))
    const orphans = notesOf(notes).filter((v) => !held.has(key(v)))

    // Assert
    expect(orphans).toEqual([])
  })
})

describe('SIGNATURES', () => {
  it('gives every season entry a signature, and no lesson the season lacks', () => {
    // Act
    const signed = Object.keys(SIGNATURES).map(Number)

    // Assert
    expect(signed).toEqual(LESSONS.map((L) => L.n))
    for (const L of LESSONS)
      expect(SIGNATURES[L.n]?.trim() ?? '', `lesson ${L.n}`).not.toBe('')
  })
})

describe('the lesson pages', () => {
  it("carry none of the team's words anywhere in their markup", () => {
    // Arrange: every lesson page in the repository
    const pages = readdirSync(resolve(process.cwd(), 'learn')).filter((name) =>
      /^\d{2}\.html$/.test(name),
    )
    expect(pages.length).toBeGreaterThan(0)
    expect(TEAM_STRINGS.length).toBeGreaterThan(0)

    for (const name of pages) {
      // Act
      const html = readFileSync(resolve(process.cwd(), 'learn', name), 'utf8')

      // Assert
      for (const [what, team] of TEAM_STRINGS)
        expect(html.includes(team), `${name}: ${what}`).toBe(false)
    }
  })
})

describe('the module', () => {
  it('imports nothing and reads neither import.meta nor the DOM', () => {
    // Arrange: its code, without the comments that say so
    const code = readFileSync(
      resolve(process.cwd(), 'src/features/lessons/kit/team-notes.ts'),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')

    // Assert
    expect(code).not.toMatch(/^\s*(?:import|export\s.*\sfrom)\s/m)
    expect(code).not.toMatch(/import\.meta|\bdocument\b|\bwindow\b/)
  })
})
