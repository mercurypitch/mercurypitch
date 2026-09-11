// ============================================================
// One clock, and it is not this app's to build
// ============================================================
//
// Beside Cue used to construct five AudioContexts — asset output, the
// onboarding cinematic, the tap tuner, and both glass drivers — and the 3D
// glass world would have made six, past the cap older Chrome put on a tab
// (docs/games/glass-3d.md §7). Worse than the cap: each one runs its own
// clock, so a tap stamped by one cannot be judged against a note scheduled
// on another.
//
// Five became one owner, and that owner has now left the app — it is
// `@irchiinnuss/audio-io`, so MercuryPitch's rooms can take the same clock.
// Which means this app's own answer is now zero, and that is what is
// asserted here. The package keeps the matching test about its own tree
// (`packages/audio-io/src/shared-audio-context.test.ts`).

import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const SOURCE_ROOT = resolve(process.cwd(), 'src')

function productionSources(): string[] {
  return readdirSync(SOURCE_ROOT, { recursive: true, encoding: 'utf8' })
    .filter((name) => /\.tsx?$/u.test(name) && !/\.test\.tsx?$/u.test(name))
    .map((name) => name.split('/').join(sep))
}

describe('AudioContext construction', () => {
  it('never happens in this app', () => {
    const builders = productionSources().filter((name) =>
      /new\s+(?:webkit)?AudioContext\s*\(/u.test(
        readFileSync(join(SOURCE_ROOT, name), 'utf8'),
      ),
    )

    expect(builders).toEqual([])
  })

  it('scans a source tree it can actually see', () => {
    // Without this, a scan that found nothing because it was pointed at an
    // empty directory would read exactly like a scan that found nothing
    // because the invariant holds.
    const sources = productionSources()

    expect(sources.length).toBeGreaterThan(20)
    expect(sources).toContain(join('audio', 'web-audio-output.ts'))
  })
})
