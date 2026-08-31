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
// round-trip open. Two invariants close them: leaving the Exercises tab
// always disarms the flag, unconditionally — and so does the drill path,
// which remounts the exercise without any tab change at all and so never
// reaches the first one.
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

/**
 * Body of the block a call opens, matched by brace balance.
 *
 * The scan is anchored to the live handler rather than run over the whole
 * file: an identical branch sitting in a function nobody calls would
 * otherwise satisfy it while the tab round-trip still restarted the run.
 */
function callBody(text: string, opener: string): string {
  const at = text.indexOf(opener)
  if (at === -1) return ''
  let depth = 1
  let index = at + opener.length
  const start = index
  while (index < text.length && depth > 0) {
    const char = text[index]
    if (char === '{') depth += 1
    else if (char === '}') depth -= 1
    index += 1
  }
  return text.slice(start, index - 1)
}

const transitionHandler = callBody(
  source,
  'onTabTransition((prevTab, newTab) => {',
)

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
  it('reads the live tab-transition handler, not a copy of it', () => {
    // Guards the anchor the next assertion stands on: if the handler is ever
    // renamed or reshaped, that assertion must fail loudly rather than pass
    // over an empty string.
    expect(transitionHandler).not.toBe('')
    expect(transitionHandler).toContain('prevTab === TAB_EXERCISES')
  })

  it('is disarmed by every departure from the Exercises tab, not only special ones', () => {
    // The unconditional branch: `prevTab === TAB_EXERCISES` with nothing
    // else in the condition. Guarded branches (guided practice) may do
    // more, but cannot be the only place the flag is cleared.
    const plainBranches = ifBodies(
      transitionHandler,
      'prevTab === TAB_EXERCISES',
    )
    const disarming = plainBranches.filter((body) =>
      body.includes('setAutoStartExercise(false)'),
    )
    expect(
      disarming.length,
      'no unconditional prevTab === TAB_EXERCISES branch clears autoStartExercise — ' +
        'a finished exercise will restart itself when the tab is revisited',
    ).toBeGreaterThan(0)
  })

  it('is disarmed on the drill path too, which remounts without a tab change', () => {
    // `setActiveTab` only fires the transition listener when the tab really
    // changes, so a routine or challenge "Practice" pressed from inside the
    // Exercises tab remounts the exercise with the flag still armed. That
    // path lands on a setup screen by design — the same reason the deep-link
    // slug clears it — so it has to consume the flag where it mounts.
    const drillBranches = ifBodies(
      source,
      'drill && activeTab() === TAB_EXERCISES',
    )
    expect(drillBranches).toHaveLength(1)
    expect(drillBranches[0]).toContain('setAutoStartExercise(false)')
  })
})
