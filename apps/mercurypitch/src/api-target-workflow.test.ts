// ============================================================
// Production reaches only the store binary
// ============================================================
//
// A production dispatch exported MERCURYPITCH_API_TARGET=production to every
// job of the run, so the sideloadable debug APK, the simulator app and the
// ad-hoc IPA were compiled against the production worker too, and
// assert-bundle agreed with them because it reads the same switch. The rule:
// every build is dev, the store binaries take the dispatch's pick on top, and
// a production dispatch that is not on a tag fails before it builds.
//
// Read off the workflow text: nothing runs these jobs locally. Where a step's
// own shell decides something, that shell is run here, with `node` stubbed.

import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WORKFLOWS = fileURLToPath(
  new URL('../../../.github/workflows/', import.meta.url),
)
const CALLER = readFileSync(`${WORKFLOWS}mercurypitch-mobile.yml`, 'utf8')
const REUSABLE = readFileSync(`${WORKFLOWS}capacitor-app.yml`, 'utf8')

/**
 * A `key: |` block's lines, by its key, at the indentation it is written.
 * A blank line inside the block is part of it, as YAML reads it: a script
 * that stopped at its first one would run as a script that does nothing.
 */
function block(text: string, key: string): string {
  const match = new RegExp(
    `\\n( *)${key}: \\|\\n((?:\\1  .*\\n|[ \\t]*\\n)+)`,
    'u',
  ).exec(text)
  if (match === null) throw new Error(`no ${key} block`)
  return match[2]
}

/** One job of the reusable workflow, by its id. */
function job(id: string): string {
  const jobs = REUSABLE.slice(REUSABLE.indexOf('\njobs:\n'))
  const start = jobs.indexOf(`\n  ${id}:\n`)
  if (start < 0) throw new Error(`no job ${id}`)
  const rest = jobs.slice(start + 1)
  const next = rest.slice(1).search(/\n {2}[a-z-]+:\n/u)
  return next < 0 ? rest : rest.slice(0, next + 1)
}

/** Where a step starts in a job's text, by its name. */
function step(text: string, name: string): number {
  const at = text.indexOf(`- name: ${name}\n`)
  if (at < 0) throw new Error(`no step "${name}"`)
  return at
}

/** A step's own text, by its name: up to the next step. */
function stepText(text: string, name: string): string {
  const start = step(text, name)
  const next = text.indexOf('\n      - name: ', start + 1)
  return text.slice(start, next < 0 ? undefined : next)
}

const STORE_EXPORT = "Export the caller's store build environment"

describe('the caller', () => {
  it('builds every web bundle against dev', () => {
    const web = block(CALLER, 'web-build-env')
    expect(web.trim()).toBe('MERCURYPITCH_API_TARGET=dev')
  })

  it('hands the dispatch pick to the store binaries only', () => {
    expect(block(CALLER, 'store-build-env')).toContain(
      "MERCURYPITCH_API_TARGET=${{ inputs.api-target || 'dev' }}",
    )
  })

  it('fails a production dispatch that is not on a tag, before building', () => {
    expect(CALLER).toMatch(/\n {4}needs: target-guard\n/u)
    const guard = CALLER.slice(CALLER.indexOf('\n  target-guard:\n'))
    expect(guard).toContain('REF_TYPE: ${{ github.ref_type }}')
    expect(guard).toContain(
      '[[ "$API_TARGET" == "production" && "$REF_TYPE" != "tag" ]]',
    )
    expect(guard).toContain('exit 1')
  })
})

describe('the reusable workflow', () => {
  it('Android: the debug APK is built, checked and uploaded before the store switches', () => {
    const android = job('android')
    const exported = step(android, STORE_EXPORT)
    expect(exported).toBeGreaterThan(
      step(android, 'Build web assets for the debug APK'),
    )
    expect(exported).toBeGreaterThan(step(android, 'Verify the debug bundle'))
    expect(exported).toBeGreaterThan(step(android, 'Upload debug APK'))
    expect(exported).toBeLessThan(
      step(android, 'Rebuild web assets for release'),
    )
    expect(exported).toBeLessThan(step(android, 'Verify the release bundle'))
  })

  it('the App Store archive takes the store switches before its build', () => {
    const release = job('ios-testflight')
    expect(step(release, STORE_EXPORT)).toBeLessThan(
      step(release, 'Build web assets'),
    )
  })

  it('the simulator app and the ad-hoc IPA never see them', () => {
    expect(job('ios')).not.toContain('store-build-env')
    expect(job('ios')).not.toContain('STORE_BUILD_ENV')
  })
})

describe('every iOS web build is checked, as the Android ones are', () => {
  // PR 859 final review, NB1. The Android job runs the caller's
  // verify-assets (assert-bundle, for Mercury Pitch) after each web build;
  // the iOS jobs built the TestFlight, simulator and release bundles and
  // checked none of them. A bundle that fetched the runtime from a CDN, or
  // carried the wrong worker, went to a phone unasserted.
  const checked = (text: string, name: string, when: string): void => {
    const verify = stepText(text, name)
    expect(verify).toContain(`if: ${when}`)
    expect(verify).toContain('STAGE: dist')
    expect(verify).toContain('export DIST_DIR="$APP_DIR/dist"')
    expect(verify).toContain('bash -euo pipefail -c "$VERIFY_ASSETS"')
  }

  it('the TestFlight archive checks the bundle it is about to archive', () => {
    const release = job('ios-testflight')
    expect(release).toContain('VERIFY_ASSETS: ${{ inputs.verify-assets }}')
    const verify = step(release, 'Verify the TestFlight bundle')
    expect(verify).toBeGreaterThan(step(release, 'Build web assets'))
    expect(verify).toBeLessThan(
      step(release, 'Archive, and upload from main and tags'),
    )
    checked(
      release,
      'Verify the TestFlight bundle',
      "env.HAS_ASC == 'true' && inputs.verify-assets != ''",
    )
  })

  it('the simulator app and the release IPA check theirs, each after its build', () => {
    const ios = job('ios')
    expect(ios).toContain('VERIFY_ASSETS: ${{ inputs.verify-assets }}')
    const simulator = step(ios, 'Verify the simulator bundle')
    expect(simulator).toBeGreaterThan(
      step(ios, 'Build web assets for the simulator'),
    )
    expect(simulator).toBeLessThan(step(ios, 'Build for simulator'))
    checked(ios, 'Verify the simulator bundle', "inputs.verify-assets != ''")

    const release = step(ios, 'Verify the release bundle')
    expect(release).toBeGreaterThan(step(ios, 'Rebuild web assets for release'))
    expect(release).toBeLessThan(step(ios, 'Archive and export IPA'))
    checked(
      ios,
      'Verify the release bundle',
      "env.HAS_SIGNING == 'true' && env.IS_RELEASE == 'true' && inputs.verify-assets != ''",
    )
  })
})

/** A YAML block scalar's text as the parser hands it over: dedented. */
function dedent(text: string): string {
  const lines = text.split('\n')
  const indent = Math.min(
    ...lines
      .filter((line) => line.trim() !== '')
      .map((line) => /^ */u.exec(line)?.[0].length ?? 0),
  )
  return lines.map((line) => line.slice(indent)).join('\n')
}

/**
 * Runs one step's own shell as its job would, with PATH and `env` only, and
 * returns the lines it wrote to the file GitHub hands it as `file`.
 */
function runStep(
  id: string,
  name: string,
  file: 'GITHUB_ENV' | 'GITHUB_OUTPUT',
  env: Record<string, string>,
): string[] {
  // A step's text ends where the next one starts, without its newline.
  const script = dedent(block(`${stepText(job(id), name)}\n`, 'run'))
  const dir = mkdtempSync(join(tmpdir(), 'mp-step-'))
  try {
    const written = join(dir, 'written')
    writeFileSync(written, '')
    const result = spawnSync('bash', ['-c', script], {
      env: { PATH: process.env.PATH, [file]: written, ...env },
      encoding: 'utf8',
    })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    return readFileSync(written, 'utf8').split('\n').filter(Boolean)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// The store binary of a production dispatch is the one a reviewer installs,
// and it shipped the portable console and the Developer screen: the flag
// that turns them on is a line in the committed .env, and turning it off was
// a line in a checklist. A TestFlight build is a dev build and keeps both.
describe('the portable console in the store binary', () => {
  /**
   * The caller's store-build-env as GitHub renders it for a dispatch pick.
   * An expression this does not know fails the test rather than guessing.
   */
  const render = (target: 'dev' | 'production'): string => {
    const values: Record<string, string> = {
      "inputs.api-target || 'dev'": target,
      "inputs.api-target == 'production' && 'VITE_PORTABLE_CONSOLE=false' || ''":
        target === 'production' ? 'VITE_PORTABLE_CONSOLE=false' : '',
    }
    return dedent(block(CALLER, 'store-build-env')).replace(
      /\$\{\{ (.*?) \}\}/gu,
      (_, expression: string) => {
        const value = values[expression]
        if (value === undefined) {
          throw new Error(`no rendering for \${{ ${expression} }}`)
        }
        return value
      },
    )
  }

  /** What a job's store export step writes to GITHUB_ENV, by running it. */
  const exported = (id: string, rendered: string): string[] =>
    runStep(id, STORE_EXPORT, 'GITHUB_ENV', { STORE_BUILD_ENV: rendered })

  for (const id of ['android', 'ios-testflight']) {
    it(`${id}: a production dispatch turns it off in the store binary`, () => {
      expect(exported(id, render('production'))).toEqual([
        'MERCURYPITCH_API_TARGET=production',
        'VITE_PORTABLE_CONSOLE=false',
      ])
    })

    it(`${id}: a TestFlight build leaves it to the committed .env`, () => {
      // Nothing at all, not an empty value: a VITE_ variable in the process
      // wins over the env files, so `VITE_PORTABLE_CONSOLE=` would turn the
      // console off in every TestFlight build.
      expect(exported(id, render('dev'))).toEqual([
        'MERCURYPITCH_API_TARGET=dev',
      ])
    })
  }
})

describe('the store binary check', () => {
  interface Verified {
    status: number | null
    ran: string[]
  }

  /**
   * Runs the caller's verify-assets as the reusable workflow does, with
   * `node` stubbed to record each script it was asked to run, and to fail
   * the one named by `failing`.
   */
  const verify = (env: Record<string, string>, failing = ''): Verified => {
    const dir = mkdtempSync(join(tmpdir(), 'mp-verify-'))
    try {
      const log = join(dir, 'ran')
      writeFileSync(
        join(dir, 'node'),
        [
          '#!/bin/sh',
          'echo "$*" >> "$NODE_LOG"',
          'if [ -n "$NODE_FAILS" ]; then',
          '  case "$*" in *"$NODE_FAILS"*) exit 1 ;; esac',
          'fi',
          'exit 0',
          '',
        ].join('\n'),
      )
      chmodSync(join(dir, 'node'), 0o755)
      const result = spawnSync(
        'bash',
        ['-euo', 'pipefail', '-c', dedent(block(CALLER, 'verify-assets'))],
        {
          env: {
            PATH: `${dir}:${process.env.PATH ?? ''}`,
            NODE_LOG: log,
            NODE_FAILS: failing,
            DIST_DIR: 'DIST',
            ANDROID_ASSETS_DIR: 'ANDROID',
            ...env,
          },
          encoding: 'utf8',
        },
      )
      const ran = existsSync(log)
        ? readFileSync(log, 'utf8').split('\n').filter(Boolean)
        : []
      return { status: result.status, ran }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  const BUNDLE = 'apps/mercurypitch/scripts/assert-bundle.mjs'
  const CONSOLE = 'scripts/assert-no-portable-console.mjs'

  it('asserts the production store dist carries no console, before and after cap sync', () => {
    expect(
      verify({ STAGE: 'dist', MERCURYPITCH_API_TARGET: 'production' }),
    ).toEqual({ status: 0, ran: [`${BUNDLE} DIST`, `${CONSOLE} DIST`] })
    expect(
      verify({ STAGE: 'synced', MERCURYPITCH_API_TARGET: 'production' }),
    ).toEqual({
      status: 0,
      ran: [
        `${BUNDLE} DIST --android-assets ANDROID`,
        `${CONSOLE} DIST`,
        `${CONSOLE} ANDROID`,
      ],
    })
  })

  it('fails the store build when the console is there', () => {
    expect(
      verify({ STAGE: 'dist', MERCURYPITCH_API_TARGET: 'production' }, CONSOLE)
        .status,
    ).not.toBe(0)
  })

  it('leaves a test build its console', () => {
    expect(verify({ STAGE: 'dist', MERCURYPITCH_API_TARGET: 'dev' })).toEqual({
      status: 0,
      ran: [`${BUNDLE} DIST`],
    })
    expect(verify({ STAGE: 'synced', MERCURYPITCH_API_TARGET: 'dev' })).toEqual(
      { status: 0, ran: [`${BUNDLE} DIST --android-assets ANDROID`] },
    )
    // The check runs under `set -u`: a job with no target at all is a test
    // build, not an unbound variable.
    expect(verify({ STAGE: 'dist' })).toEqual({
      status: 0,
      ran: [`${BUNDLE} DIST`],
    })
  })
})

// The debug APK said 0.1.0 whatever it was built from: nothing named it, so
// it carried the build script's fallback, and beside a TestFlight on 0.8.1
// that reads as a stale build. It is named for its run now. Its code stays 1,
// so any debug build still installs over any other.
describe('the version each Android build carries', () => {
  /** What "Resolve release version" writes to GITHUB_OUTPUT, by running it. */
  const resolved = (env: Record<string, string>): Record<string, string> =>
    Object.fromEntries(
      runStep('android', 'Resolve release version', 'GITHUB_OUTPUT', {
        TAG_PREFIX: 'mp-v',
        RUN_NUMBER: '441',
        IS_RELEASE: 'false',
        PR_NUMBER: '0',
        ...env,
      }).map((line) => {
        const at = line.indexOf('=')
        return [line.slice(0, at), line.slice(at + 1)]
      }),
    )

  it('a tag names the release it is, and the debug APK adds its run', () => {
    expect(resolved({ IS_RELEASE: 'true', REF_NAME: 'mp-v0.8.1' })).toEqual({
      name: '0.8.1',
      code: '441',
      'debug-name': '0.8.1+run441',
    })
  })

  it('a pull request is named for its number', () => {
    expect(resolved({ PR_NUMBER: '886', REF_NAME: '886/merge' })).toEqual({
      name: '0.0.0-pr886',
      code: '441',
      'debug-name': '0.0.0-pr886+run441',
    })
  })

  it('a push is named for its branch, not a pull request 0', () => {
    expect(resolved({ REF_NAME: 'main' })).toMatchObject({
      name: '0.0.0-main',
      'debug-name': '0.0.0-main+run441',
    })
    expect(resolved({ REF_NAME: 'feat/some_thing' })).toMatchObject({
      name: '0.0.0-feat-some-thing',
    })
  })

  it('the debug APK takes the name only, and keeps code 1', () => {
    // A code from the run would make an older build a downgrade the package
    // installer refuses, and uninstalling loses what only the phone holds.
    const debug = stepText(job('android'), 'Test, lint, and package debug')
    expect(debug).toContain(
      'VERSION_NAME: ${{ steps.version.outputs.debug-name }}',
    )
    expect(debug).toContain('export "${PREFIX}_VERSION_NAME=$VERSION_NAME"')
    expect(debug).not.toContain('VERSION_CODE')
  })

  it('the store binary keeps the plain name and the run as its code', () => {
    const release = stepText(job('android'), 'Build release bundle and APK')
    expect(release).toContain('VERSION_NAME: ${{ steps.version.outputs.name }}')
    expect(release).toContain('VERSION_CODE: ${{ steps.version.outputs.code }}')
  })
})
