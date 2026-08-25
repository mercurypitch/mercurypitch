// @vitest-environment node

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
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
const DB_DEPLOY_WORKFLOW = readFileSync(
  resolve(__dirname, '../../.github/workflows/deploy-db.yml'),
  'utf-8',
)
const DB_PREVIEW_TEMPLATE = readFileSync(
  resolve(
    __dirname,
    '../../workers/db-worker/wrangler.pr-preview.template.jsonc',
  ),
  'utf-8',
)
const PREVIEW_ISOLATION_SCRIPT = resolve(
  __dirname,
  '../../scripts/assert-pr-preview-isolation.mjs',
)
const PREVIEW_DATABASE_PLACEHOLDER_ID = '00000000-0000-0000-0000-000000000000'
const RESOLVED_PREVIEW_DATABASE_ID = '11111111-2222-4333-8444-555555555555'
const FOREIGN_DATABASE_ID = 'deadbeef-dead-4bad-8bad-deadbeefcafe'

function validatePreviewConfig(
  configSource: string,
  workerName = 'mercury-pitch-db-preview',
  databaseName = 'mercurypitch-db-preview',
  databaseId?: string,
) {
  const directory = mkdtempSync(join(tmpdir(), 'preview-isolation-'))
  const configPath = join(directory, 'wrangler.jsonc')
  writeFileSync(configPath, configSource)
  try {
    const args = [
      PREVIEW_ISOLATION_SCRIPT,
      configPath,
      workerName,
      databaseName,
    ]
    if (databaseId !== undefined) args.push(databaseId)
    return spawnSync(process.execPath, args, { encoding: 'utf8' })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

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
    expect(BUILD_WORKFLOW).toMatch(
      /pnpm exec wrangler versions upload \\\n\s+--config "\$generated_db_config"/,
    )
    expect(BUILD_WORKFLOW).toMatch(
      /pnpm exec wrangler versions list \\\n\s+--name "\$db_worker_name"/,
    )
    expect(BUILD_WORKFLOW).toMatch(
      /pnpm exec wrangler deploy \\\n\s+--config "\$generated_db_config"/,
    )
    expect(BUILD_WORKFLOW).toContain(
      'if [ "$preview_worker_exists" = \'true\' ]',
    )
    expect(BUILD_WORKFLOW).toContain(
      "grep -E '(Worker|Current) Version ID:' db-upload.log",
    )
    expect(BUILD_WORKFLOW).toContain(
      'export VITE_API_BASE_URL="$db_preview_url"',
    )
    expect(BUILD_WORKFLOW).toContain(
      `grep -R -F -q --include='*.js' "$db_preview_url" dist/assets`,
    )
  })

  it('uses a dedicated Worker and never inherits protected environment secrets', () => {
    expect(DB_PREVIEW_TEMPLATE).toMatch(
      /"name"\s*:\s*"mercury-pitch-db-preview"/,
    )
    expect(DB_PREVIEW_TEMPLATE).not.toMatch(
      /"name"\s*:\s*"(?:mercury-pitch-db-dev|mercury-pitch-db)"/,
    )
    expect(DB_PREVIEW_TEMPLATE).toMatch(/"preview_urls"\s*:\s*true/)
    expect(DB_PREVIEW_TEMPLATE).toMatch(/"workers_dev"\s*:\s*false/)
    expect(DB_PREVIEW_TEMPLATE).toMatch(/"required"\s*:\s*\["JWT_SECRET"\]/)
    expect(BUILD_WORKFLOW).toContain(
      'db_worker_name="mercury-pitch-db-preview"',
    )
    expect(BUILD_WORKFLOW).not.toContain(
      'db_worker_name="mercury-pitch-db-dev"',
    )
    expect(BUILD_WORKFLOW).toContain(
      '--secrets-file "$preview_db_secrets_file"',
    )
    expect(BUILD_WORKFLOW).toContain(
      'preview_jwt_secret="$(openssl rand -hex 32)"',
    )
    expect(BUILD_WORKFLOW).toContain(
      'printf \'JWT_SECRET=%s\\n\' "$preview_jwt_secret"',
    )
    expect(BUILD_WORKFLOW).toContain(
      'node scripts/assert-pr-preview-isolation.mjs',
    )
    expect(BUILD_WORKFLOW).toContain(
      'db_preview_url="https://${db_version_prefix}-${db_worker_name}.${workers_dev_subdomain}.workers.dev"',
    )
    const subdomainRead = BUILD_WORKFLOW.match(
      /preview_subdomain_settings=\$\([\s\S]*?\n\s*\)/,
    )?.[0]
    expect(subdomainRead).toContain(
      '/workers/scripts/${db_worker_name}/subdomain',
    )
    expect(subdomainRead).not.toMatch(/(?:--request|-X|--data(?:-raw)?)/)
    expect(BUILD_WORKFLOW).toMatch(
      /\.success == true and \.result\.enabled == false and \.result\.previews_enabled == true/,
    )
  })

  it.each(['mercury-pitch-db-dev', 'mercury-pitch-db'])(
    'rejects protected Worker %s before a Cloudflare mutation',
    (protectedWorker) => {
      const mutatedConfig = DB_PREVIEW_TEMPLATE.replace(
        '"name": "mercury-pitch-db-preview"',
        `"name": "${protectedWorker}"`,
      )
      expect(validatePreviewConfig(mutatedConfig).status).not.toBe(0)
      expect(
        validatePreviewConfig(DB_PREVIEW_TEMPLATE, protectedWorker).status,
      ).not.toBe(0)
    },
  )

  it('uses semantic JSONC values instead of control fields spoofed in comments', () => {
    const spoofedConfig = `// "name": "mercury-pitch-db-preview"
${DB_PREVIEW_TEMPLATE.replace(
  '"name": "mercury-pitch-db-preview"',
  '"name": "mercury-pitch-db"',
)}`

    const result = validatePreviewConfig(spoofedConfig)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'PR preview Worker must be exactly mercury-pitch-db-preview',
    )
  })

  it('rejects duplicate JSONC control keys even when an escape hides the duplicate', () => {
    const duplicatedConfig = DB_PREVIEW_TEMPLATE.replace(
      '"name": "mercury-pitch-db-preview"',
      '"name": "mercury-pitch-db-preview",\n  "\\u006eame": "mercury-pitch-db-preview"',
    )

    const result = validatePreviewConfig(duplicatedConfig)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Duplicate JSONC key at $.name')
  })

  it('requires the all-zero D1 placeholder before database resolution', () => {
    const preResolvedConfig = DB_PREVIEW_TEMPLATE.replace(
      PREVIEW_DATABASE_PLACEHOLDER_ID,
      FOREIGN_DATABASE_ID,
    )

    const result = validatePreviewConfig(preResolvedConfig)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'D1 id must exactly match the expected preview database id',
    )
  })

  it('accepts only the resolved preview D1 UUID after config generation', () => {
    const generatedConfig = DB_PREVIEW_TEMPLATE.replace(
      PREVIEW_DATABASE_PLACEHOLDER_ID,
      RESOLVED_PREVIEW_DATABASE_ID,
    )

    const matchingResult = validatePreviewConfig(
      generatedConfig,
      'mercury-pitch-db-preview',
      'mercurypitch-db-preview',
      RESOLVED_PREVIEW_DATABASE_ID,
    )
    const mismatchedConfig = generatedConfig.replace(
      RESOLVED_PREVIEW_DATABASE_ID,
      FOREIGN_DATABASE_ID,
    )
    const mismatchedResult = validatePreviewConfig(
      mismatchedConfig,
      'mercury-pitch-db-preview',
      'mercurypitch-db-preview',
      RESOLVED_PREVIEW_DATABASE_ID,
    )

    expect(matchingResult.status).toBe(0)
    expect(mismatchedResult.status).not.toBe(0)
    expect(mismatchedResult.stderr).toContain(
      'D1 id must exactly match the expected preview database id',
    )
  })

  it('rejects every unapproved top-level Wrangler surface', () => {
    const unapprovedEntries = [
      '  "unsafe": {},',
      `  "unsafe": {
    "bindings": [
      {
        "name": "DB",
        "type": "d1",
        "id": "${FOREIGN_DATABASE_ID}",
      },
    ],
  },`,
      '  "kv_namespaces": [{ "binding": "EXTRA", "id": "foreign" }],',
      '  "build": { "command": "node foreign-build.mjs" },',
    ]

    for (const entry of unapprovedEntries) {
      const config = DB_PREVIEW_TEMPLATE.replace(
        '  "d1_databases": [',
        `${entry}\n  "d1_databases": [`,
      )
      const result = validatePreviewConfig(config)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(
        'PR preview Wrangler config must contain exactly the approved keys',
      )
    }
  })

  it('rejects nested binding drift', () => {
    const driftedConfig = DB_PREVIEW_TEMPLATE.replace(
      '      "migrations_dir": "migrations",',
      '      "migrations_dir": "migrations",\n      "remote": true,',
    )

    const result = validatePreviewConfig(driftedConfig)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'PR preview D1 binding must contain exactly the approved keys',
    )
  })

  it('accepts the isolated preview contract', () => {
    const result = validatePreviewConfig(DB_PREVIEW_TEMPLATE)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('PR preview isolation contract: PASS')
  })

  it('bootstraps only an absent dedicated preview Worker', () => {
    const isolationCheck = BUILD_WORKFLOW.indexOf(
      'node scripts/assert-pr-preview-isolation.mjs',
    )
    const existenceCheck = BUILD_WORKFLOW.indexOf(
      'pnpm exec wrangler versions list',
    )
    const bootstrap = BUILD_WORKFLOW.indexOf('pnpm exec wrangler deploy')
    const settingsCheck = BUILD_WORKFLOW.indexOf(
      'preview_subdomain_settings=$(',
    )
    const previewUrl = BUILD_WORKFLOW.indexOf('db_preview_url="https://')

    expect(BUILD_WORKFLOW).toContain("grep -F -q 'code: 10007'")
    expect(BUILD_WORKFLOW).toMatch(
      /node scripts\/assert-pr-preview-isolation\.mjs \\\n\s+workers\/db-worker\/wrangler\.pr-preview\.template\.jsonc \\\n\s+"\$db_worker_name" \\\n\s+"\$preview_database_name"/,
    )
    expect(BUILD_WORKFLOW).toMatch(
      /node scripts\/assert-pr-preview-isolation\.mjs \\\n\s+"\$generated_db_config" \\\n\s+"\$db_worker_name" \\\n\s+"\$preview_database_name" \\\n\s+"\$database_id"/,
    )
    expect(isolationCheck).toBeGreaterThan(-1)
    expect(existenceCheck).toBeGreaterThan(isolationCheck)
    expect(bootstrap).toBeGreaterThan(existenceCheck)
    expect(settingsCheck).toBeGreaterThan(bootstrap)
    expect(previewUrl).toBeGreaterThan(settingsCheck)
    expect(DB_PREVIEW_TEMPLATE).toContain('"workers_dev": false')
    expect(DB_PREVIEW_TEMPLATE).not.toMatch(/"routes"\s*:/)
  })

  it('pairs Cloudflare test credentials only inside immutable PR previews', () => {
    expect(DB_PREVIEW_TEMPLATE).toContain('"PR_PREVIEW": "true"')
    expect(BUILD_WORKFLOW).toContain(
      'node scripts/assert-pr-preview-isolation.mjs',
    )
    expect(BUILD_WORKFLOW).toContain(
      'preview_turnstile_site_key="1x00000000000000000000AA"',
    )
    expect(DB_PREVIEW_TEMPLATE).toContain(
      '"TURNSTILE_SECRET": "1x0000000000000000000000000000000AA"',
    )
    expect(BUILD_WORKFLOW).toContain(
      'export VITE_TURNSTILE_SITE_KEY="$preview_turnstile_site_key"',
    )
    expect(BUILD_WORKFLOW).toContain('export VITE_PR_PREVIEW=true')
    expect(BUILD_WORKFLOW).toContain(
      `grep -R -F -q --include='*.js' "$preview_turnstile_site_key" dist/assets`,
    )
    expect(BUILD_WORKFLOW).toContain(
      'Preview bundle unexpectedly contains the real Turnstile site key.',
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

  it('canaries the real Turnstile secret after dev deploys only', () => {
    expect(DB_DEPLOY_WORKFLOW).toContain(
      '- name: Verify dev Turnstile credential isolation',
    )
    expect(DB_DEPLOY_WORKFLOW).toMatch(
      /- name: Verify dev Turnstile credential isolation\s+if: env\.DEPLOY_ENV == 'dev'/,
    )
    expect(DB_DEPLOY_WORKFLOW).toContain(
      "'https://api-dev.mercurypitch.com/api/auth/login'",
    )
    expect(DB_DEPLOY_WORKFLOW).toContain('XXXX.DUMMY.TOKEN.XXXX')
    expect(DB_DEPLOY_WORKFLOW).toContain(
      'CAPTCHA verification failed. Please try again.',
    )
    expect(DB_DEPLOY_WORKFLOW).not.toMatch(
      /Verify dev Turnstile credential isolation[\s\S]*https:\/\/api\.mercurypitch\.com/,
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
