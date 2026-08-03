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
const CONTENT_STUDIO_CSS = readFileSync(
  resolve(__dirname, '../features/admin/AdminContentStudio.module.css'),
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
const DB_PREVIEW_TEMPLATE = readFileSync(
  resolve(
    __dirname,
    '../../workers/db-worker/wrangler.pr-preview.template.jsonc',
  ),
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
  it('allocates the authoring console most of the workspace', () => {
    expect(CONTENT_STUDIO_CSS).toMatch(/container-type:\s*inline-size/)
    const compactStudioBlock = extractRuleBlock(
      CONTENT_STUDIO_CSS,
      /@media\s*\(max-width:\s*1100px\)\s*\{/,
    )
    expect(compactStudioBlock).toMatch(
      /\.body\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    )
    expect(CONTENT_STUDIO_CSS).toMatch(
      /\.workspaceWide\s*\{[^}]*max-width:\s*1800px/,
    )
    expect(EXERCISES_PAGE_CSS).toMatch(
      /grid-template-columns:\s*clamp\(220px,\s*22%,\s*270px\)\s+minmax\(0,\s*1fr\)/,
    )
  })

  it('stacks the exercise catalogue before nested rails crush the editor', () => {
    const block = extractRuleBlock(
      EXERCISES_PAGE_CSS,
      /@container\s*\(max-width:\s*1320px\)\s*\{/,
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

    const consoleBlock = extractRuleBlock(
      EXERCISE_EDITOR_CSS,
      /@container\s+exercise-editor\s*\(max-width:\s*1160px\)\s*\{/,
    )
    expect(consoleBlock).toMatch(
      /\.authorLayout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
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

    const compactBlock = extractRuleBlock(
      TIMELINE_EDITOR_CSS,
      /@container\s+timeline-editor\s*\(max-width:\s*900px\)\s*\{/,
    )
    expect(compactBlock).toMatch(
      /\.rowActions\s*\{[\s\S]*grid-column:\s*4\s*\/\s*-1[\s\S]*align-self:\s*center/,
    )
    expect(compactBlock).toMatch(
      /\.showCueField\s*\{[\s\S]*grid-column:\s*3[\s\S]*align-self:\s*center/,
    )
  })
})

describe('PR preview API environment', () => {
  it('uses the development bundle for Wrangler preview uploads', () => {
    expect(WRANGLER_CONFIG).toMatch(
      /"preview"\s*:\s*\{[\s\S]*"build"\s*:\s*\{[\s\S]*"command"\s*:\s*"pnpm run build:dev"/,
    )
  })

  it('pairs each frontend preview with one shared preview D1', () => {
    expect(BUILD_WORKFLOW).toContain(
      'preview_database_name="mercurypitch-db-preview"',
    )
    expect(BUILD_WORKFLOW).not.toContain('mercurypitch-pr-${PR_NUMBER}')
    // The preview DB follows the tracked migration chain, not a whole-schema
    // execute: schema.sql was retired when numbered migrations landed, and
    // re-running the chain from later PRs must only apply what is new.
    expect(BUILD_WORKFLOW).toContain(
      'pnpm exec wrangler d1 migrations apply "$preview_database_name"',
    )
    expect(BUILD_WORKFLOW).not.toContain('--file=workers/db-worker/schema.sql')
    expect(DB_PREVIEW_TEMPLATE).toContain('"migrations_dir": "migrations"')
    expect(BUILD_WORKFLOW).toContain(
      'pnpm exec wrangler versions upload \\\n' +
        '            --config "$generated_db_config"',
    )
    expect(BUILD_WORKFLOW).toContain(
      'export VITE_API_BASE_URL="$db_preview_url"',
    )
    expect(BUILD_WORKFLOW).toContain(
      `grep -R -F -q --include='*.js' "$db_preview_url" dist/assets`,
    )
  })

  it('enables only version previews and inherits the existing dev secrets', () => {
    expect(DB_PREVIEW_TEMPLATE).toMatch(/"name"\s*:\s*"mercury-pitch-db-dev"/)
    expect(DB_PREVIEW_TEMPLATE).toMatch(/"preview_urls"\s*:\s*true/)
    expect(DB_PREVIEW_TEMPLATE).toMatch(/"workers_dev"\s*:\s*false/)
    expect(DB_PREVIEW_TEMPLATE).toMatch(
      /"required"\s*:\s*\["ADMIN_KEY",\s*"JWT_SECRET"\]/,
    )
    expect(BUILD_WORKFLOW).toContain(
      `--data '{"enabled":false,"previews_enabled":true}'`,
    )
    expect(BUILD_WORKFLOW).toContain(
      'db_preview_url="https://${db_version_prefix}-${db_worker_name}.${workers_dev_subdomain}.workers.dev"',
    )
  })

  it('fails deployment if the paired build points at production', () => {
    expect(BUILD_WORKFLOW).toContain(
      `grep -R -F -q --include='*.js' "$db_preview_url" dist/assets`,
    )
    expect(BUILD_WORKFLOW).toContain(
      'Preview bundle unexpectedly targets the production API.',
    )
  })

  it('does not allocate or delete a database per PR', () => {
    expect(BUILD_WORKFLOW).not.toContain('cleanup-pr-preview:')
    expect(BUILD_WORKFLOW).not.toContain('wrangler d1 delete')
    expect(DB_PREVIEW_TEMPLATE).toMatch(
      /"database_name"\s*:\s*"mercurypitch-db-preview"/,
    )
  })
})
