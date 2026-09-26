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
// Read off the workflow text: nothing runs these jobs locally.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WORKFLOWS = fileURLToPath(
  new URL('../../../.github/workflows/', import.meta.url),
)
const CALLER = readFileSync(`${WORKFLOWS}mercurypitch-mobile.yml`, 'utf8')
const REUSABLE = readFileSync(`${WORKFLOWS}capacitor-app.yml`, 'utf8')

/** A `key: |` block's lines, by its key, at the indentation it is written. */
function block(text: string, key: string): string {
  const match = new RegExp(`\\n( *)${key}: \\|\\n((?:\\1  .*\\n)+)`, 'u').exec(
    text,
  )
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
