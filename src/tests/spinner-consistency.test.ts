// ============================================================
// One spinner, and no stylesheet quietly growing another
// ============================================================
//
// `src/components/shared/Spinner.tsx` opens with "The one spinner. Everything
// that has to say 'working on it' uses this." Two surfaces did not: the
// stale-build banner and the Drive settings rows both rotated the RotateCcw
// refresh glyph instead — an arrow with an arrowhead and a gap, which the eye
// tracks going round and reads as a tumbling object. Reported as "nauseating,
// spinning weirdly, not a proper spinner".
//
// The behaviour halves are in `StaleBuildRecovery.test.tsx` and
// `SyncSettings.test.tsx`. This is the mutation guard on the stylesheets: a
// rotation keyframe reappearing in either module is exactly how the glyph
// would come back.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string): string => readFileSync(path, 'utf8')

const OWN_NO_SPINNER: readonly (readonly [string, string])[] = [
  ['the stale-build banner', 'src/components/StaleBuildRecovery.module.css'],
  ['the Drive settings rows', 'src/components/SyncSettings.module.css'],
]

describe('the surfaces that were rotating a refresh arrow', () => {
  it.each(OWN_NO_SPINNER)('%s declares no rotation of its own', (_, path) => {
    // Any rotation at all, not just the 360deg turn: the Drive one span
    // -360deg on purpose ("the arrow points counter-clockwise"), which is the
    // kind of reasoning that puts a turning glyph back. Other animations are
    // fine — the Drive scan bar's sliding fill is a real progress bar.
    expect(read(path)).not.toMatch(/rotate\(/)
  })
})

describe('the one spinner still turns', () => {
  const css = read('src/components/shared/Spinner.module.css')

  it('sweeps an arc with no landmark on it', () => {
    expect(css).toContain('animation: spinner-turn 0.9s linear infinite')
    expect(css).toContain('transform: rotate(360deg)')
  })

  it('slows under reduced motion rather than freezing', () => {
    // A frozen indicator is indistinguishable from a decoration, which is
    // what the stale banner did — it set `animation: none` and left a
    // motionless refresh arrow on screen for the whole reload.
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('animation-duration: 2.4s')
    expect(css).not.toMatch(/animation: none/)
  })
})
