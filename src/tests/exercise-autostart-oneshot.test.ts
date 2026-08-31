// ============================================================
// Auto-start is a launch intent, not a standing state
// ============================================================
//
// `autoStartExercise` lives in AppShell so it survives the Exercises tab's
// `<Show>` unmount. Every exercise consumes it in `onMount` against a
// freshly-idle `useBaseExercise` — so a `true` left armed after the launch
// makes any later remount (leave the tab, come back) start a brand-new run
// on its own, over the result screen the singer expected to find.
//
// The launch paths were patched one by one (deep-link slugs in 77f05e14,
// the hidden-tab bounce in 90a51058) and each left the ordinary tab
// round-trip open. The invariant that closes them all: leaving the
// Exercises tab always disarms the flag, unconditionally.
//
// A source scan, not a render test, for the same reason as
// `mixer-remount-key-batching.test.ts`: the trap is the *shape* of the
// transition handler — a future branch that clears it only under some
// extra condition would pass any behavioural test written for the paths
// we know about today.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')

/** Body of every `if (<exact condition>) { ... }`, matched by brace balance. */
function ifBodies(text: string, condition: string): string[] {
  const bodies: string[] = []
  const opener = `if (${condition}) {`
  let from = 0
  while (true) {
    const at = text.indexOf(opener, from)
    if (at === -1) break
    let depth = 1
    let index = at + opener.length
    const start = index
    while (index < text.length && depth > 0) {
      const char = text[index]
      if (char === '{') depth += 1
      else if (char === '}') depth -= 1
      index += 1
    }
    bodies.push(text.slice(start, index - 1))
    from = index
  }
  return bodies
}

describe('exercise auto-start', () => {
  it('is disarmed by every departure from the Exercises tab, not only special ones', () => {
    // The unconditional branch: `prevTab === TAB_EXERCISES` with nothing
    // else in the condition. Guarded branches (guided practice) may do
    // more, but cannot be the only place the flag is cleared.
    const plainBranches = ifBodies(source, 'prevTab === TAB_EXERCISES')
    const disarming = plainBranches.filter((body) =>
      body.includes('setAutoStartExercise(false)'),
    )
    expect(
      disarming.length,
      'no unconditional prevTab === TAB_EXERCISES branch clears autoStartExercise — ' +
        'a finished exercise will restart itself when the tab is revisited',
    ).toBeGreaterThan(0)
  })
})
