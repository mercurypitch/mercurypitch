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
