// ============================================================
// The way in to the exercises: its copy, as a tripwire
// ============================================================
//
// The row and the picker render their words in ExerciseRow.test.tsx and
// ExercisePicker.test.tsx. This file pins the decided sentences where they
// live and keeps out what the product voice rules out: em dashes, "upload"
// (device round 2, R6), the mood words, and the British spelling of
// practice. It reads every source in the folder, comments included, so a
// string cannot slip in through a file no render test opens.

import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEMO_COPY } from '@/features/long-note/demo/demo-cues'
import { catalogueEntry } from './catalogue'

/** Repo-relative: vitest runs from the workspace root in either project. */
const FOLDER = 'src/features/premium-exercises'

function sources(): Array<[string, string]> {
  return readdirSync(FOLDER)
    .filter((name) => /\.(ts|tsx|css)$/u.test(name))
    .filter((name) => !name.includes('.test.'))
    .map((name) => [name, readFileSync(`${FOLDER}/${name}`, 'utf8')])
}

/** One file's text on one line, so a sentence Prettier wrapped still matches. */
const flat = (name: string): string =>
  readFileSync(`${FOLDER}/${name}`, 'utf8').replace(/\s+/gu, ' ')

const offenders = (pattern: RegExp): string[] =>
  sources()
    .filter(([, text]) => pattern.test(text))
    .map(([name]) => name)

describe('the decided words', () => {
  it('names Long note and says what it is, on its card', () => {
    const longNote = catalogueEntry('long-note-lantern')

    expect([longNote?.name, longNote?.line]).toEqual([
      'Long note',
      'Hold one note and fill the lantern with light.',
    ])
  })

  it('names the pill, the door and the lone pill', () => {
    const row = flat('ExerciseRow.tsx')

    expect(row).toContain('Open your last exercise')
    expect(row).toContain('aria-label="All exercises"')
    expect(row).toContain('<ListRows /> Exercises </button>')
  })

  it('titles the sheet, labels its close, and prints the best with its note', () => {
    const picker = flat('ExercisePicker.tsx')

    expect(picker).toContain('ariaLabel="Exercises"')
    expect(picker).toContain('<h2 class={styles.sheetTitle}>Exercises</h2>')
    expect(picker).toContain('aria-label="Close"')
    expect(picker).toContain('`${best} on ${note}`')
  })

  it("tags a card with the demo's own first words", () => {
    expect(flat('ExercisePicker.tsx')).toContain('Merc sings it first')
    expect(DEMO_COPY.cardLine.startsWith('Merc sings it first')).toBe(true)
  })
})

describe('what the product voice keeps out', () => {
  it('has no em dash', () => {
    expect(offenders(/—/u)).toEqual([])
  })

  it('never says upload', () => {
    expect(offenders(/upload/iu)).toEqual([])
  })

  it('uses none of the mood words or the sales promises', () => {
    expect(
      offenders(
        /\b(calm\w*|seamless|effortless|intuitive|delightful|elevate|empower|unlock|journey|reimagine|curated)\b/iu,
      ),
    ).toEqual([])
  })

  it('spells it practice', () => {
    expect(offenders(/practis/iu)).toEqual([])
  })
})
