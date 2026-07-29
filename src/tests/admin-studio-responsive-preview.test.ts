// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * JSDOM does not calculate CSS-module layout or run Cloudflare builds. These
 * source-contract checks protect the two boundaries that caused the
 * regression: nested editor widths and Wrangler's second preview build.
 */

const EXERCISES_PAGE_CSS = readFileSync(
  resolve(__dirname, '../features/admin/AdminExercisesPage.module.css'),
  'utf-8',
)
const EXERCISE_EDITOR_CSS = readFileSync(
  resolve(__dirname, '../features/admin/exercises/ExerciseEditor.module.css'),
  'utf-8',
)
const TIMELINE_EDITOR_CSS = readFileSync(
  resolve(
    __dirname,
    '../features/admin/exercises/ExerciseTimelineEditor.module.css',
  ),
  'utf-8',
)
const WRANGLER_CONFIG = readFileSync(
  resolve(__dirname, '../../wrangler.jsonc'),
  'utf-8',
)
const BUILD_WORKFLOW = readFileSync(
  resolve(__dirname, '../../.github/workflows/build.yml'),
  'utf-8',
)

function extractRuleBlock(css: string, rule: RegExp): string {
  const match = rule.exec(css)
  if (match === null) return ''

  let depth = 1
  let index = match.index + match[0].length
  const start = index
  while (index < css.length && depth > 0) {
    if (css[index] === '{') depth += 1
    else if (css[index] === '}') depth -= 1
    index += 1
  }
  return css.slice(start, index - 1)
}

describe('Content Studio constrained-width layout', () => {
  it('stacks the exercise catalogue before nested rails crush the editor', () => {
    const block = extractRuleBlock(
      EXERCISES_PAGE_CSS,
      /@media\s*\(max-width:\s*1180px\)\s*\{/,
    )

    expect(block).toMatch(/\.page\s*\{[\s\S]*grid-template-columns:\s*1fr/)
    expect(block).toMatch(/\.editorPane\s*\{[\s\S]*overflow:\s*visible/)
  })

  it('reflows timing and scoring fields from the editor container width', () => {
    expect(EXERCISE_EDITOR_CSS).toMatch(
      /container:\s*exercise-editor\s*\/\s*inline-size/,
    )

    const mediumBlock = extractRuleBlock(
      EXERCISE_EDITOR_CSS,
      /@container\s+exercise-editor\s*\(max-width:\s*680px\)\s*\{/,
    )
    const narrowBlock = extractRuleBlock(
      EXERCISE_EDITOR_CSS,
      /@container\s+exercise-editor\s*\(max-width:\s*460px\)\s*\{/,
    )

    expect(mediumBlock).toMatch(
      /\.compactGrid,[\s\S]*grid-template-columns:\s*repeat\(2,/,
    )
    expect(narrowBlock).toMatch(
      /\.compactGrid,[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    )
  })

  it('reflows timeline tools and precise rows from the timeline width', () => {
    expect(TIMELINE_EDITOR_CSS).toMatch(
      /container:\s*timeline-editor\s*\/\s*inline-size/,
    )

    const block = extractRuleBlock(
      TIMELINE_EDITOR_CSS,
      /@container\s+timeline-editor\s*\(max-width:\s*680px\)\s*\{/,
    )

    expect(block).toMatch(/\.header,[\s\S]*flex-direction:\s*column/)
    expect(block).toMatch(
      /\.eventRow\s*\{[\s\S]*grid-template-columns:\s*1fr\s+1fr/,
    )
  })
})

describe('PR preview API environment', () => {
  it('uses the development bundle for Wrangler preview uploads', () => {
    expect(WRANGLER_CONFIG).toMatch(
      /"preview"\s*:\s*\{[\s\S]*"build"\s*:\s*\{[\s\S]*"command"\s*:\s*"pnpm run build:dev"/,
    )
  })

  it('fails deployment if the second build points at production', () => {
    expect(BUILD_WORKFLOW).toContain(
      "grep -R -q --include='*.js' 'https://api-dev.mercurypitch.com' dist/assets",
    )
    expect(BUILD_WORKFLOW).toContain(
      'Preview bundle unexpectedly targets the production API.',
    )
  })
})
