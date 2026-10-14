// ============================================================
// Contract: which builds turn on consent preview
// ============================================================
//
// CONSENT_PREVIEW (src/lib/defaults.ts) shows the cookie bar in a build with
// no Google tag. It belongs to the dev deploy and PR previews only, and the
// only place it is set is the `build:dev` script, which both of their
// Wrangler builds run. Production's Wrangler build runs `build`, which must
// never carry it. `pnpm dev`, e2e and tour builds stay off too, so their
// screens are not covered by a bar they never asked for.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..')
const FLAG = 'VITE_CONSENT_PREVIEW'

const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8')

interface WranglerEnv {
  build?: { command?: string }
}

interface WranglerConfig extends WranglerEnv {
  env: Record<string, WranglerEnv | undefined>
}

function wranglerConfig(): WranglerConfig {
  const parsed = ts.parseConfigFileTextToJson(
    'wrangler.jsonc',
    read('wrangler.jsonc'),
  )
  if (parsed.error !== undefined)
    throw new Error('wrangler.jsonc did not parse')
  return parsed.config as WranglerConfig
}

/** The build command Wrangler runs for an env (`build` is inherited). */
function buildCommand(config: WranglerConfig, env: string): string {
  return config.env[env]?.build?.command ?? config.build?.command ?? ''
}

const scripts = (
  JSON.parse(read('package.json')) as { scripts: Record<string, string> }
).scripts

describe('consent preview build flag', () => {
  it('is set by build:dev, and by no other script', () => {
    expect(scripts['build:dev']).toMatch(
      new RegExp(`^cross-env ${FLAG}=true vite build --mode development `),
    )
    const others = Object.entries(scripts)
      .filter(([name, cmd]) => name !== 'build:dev' && cmd.includes(FLAG))
      .map(([name]) => name)
    expect(others).toEqual([])
  })

  it('reaches the dev deploy and PR previews, and not production', () => {
    const config = wranglerConfig()
    expect(buildCommand(config, 'dev')).toBe('pnpm run build:dev')
    expect(buildCommand(config, 'preview')).toBe('pnpm run build:dev')
    expect(buildCommand(config, 'prod')).toBe('pnpm run build')
    expect(scripts.build).not.toContain(FLAG)
  })

  it('is in no env file, so pnpm dev and the tag build stay off', () => {
    for (const file of ['.env.development', '.env.production']) {
      expect(read(file)).not.toMatch(new RegExp(`^\\s*${FLAG}\\s*=`, 'm'))
    }
  })

  it('is not set on a workflow step, where it could reach the tag build', () => {
    expect(read('.github/workflows/build.yml')).not.toContain(FLAG)
  })

  it('is read only in development mode, so a production build compiles it out', () => {
    expect(read('src/lib/defaults.ts')).toMatch(
      new RegExp(
        `import\\.meta\\.env\\.MODE === 'development' &&\\s*import\\.meta\\.env\\.${FLAG} === 'true'`,
      ),
    )
  })
})
