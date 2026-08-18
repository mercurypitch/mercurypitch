// ============================================================
// Compose's phone drawer and the tour steps that point into it
// ============================================================
//
// When Compose's header became one row on a phone, the whole floating
// control bar moved inside the "more" sheet. The buttons stayed in the DOM,
// so nothing threw — but three walkthrough steps pointed at targets behind a
// closed drawer, and only one of them was given the `reveal` that opens it.
// The other two spent a release spotlighting nothing on mobile, and the only
// thing that noticed was the 20-minute release walk.
//
// So: any step aiming at something the control bar owns has to open the
// drawer first. The selectors are read from the component rather than listed
// here, so moving one more button into the sheet cannot quietly reopen the
// hole.
//
// Scope: ids and data-attributes declared in ComposeControlBar.tsx itself.
// A target inside one of its child components (LoopControls) is not covered
// — no tour step points at one today.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TAB_COMPOSE } from '@/features/tabs/constants'
import { WALKTHROUGH_STEPS } from '@/stores/app-store'

/** The trigger that opens Compose's phone drawer. */
const DRAWER_REVEAL = '[data-testid="compose-mobile-more"]'

const controlBarSource = readFileSync(
  resolve(process.cwd(), 'src/components/compose/ComposeControlBar.tsx'),
  'utf8',
)

/**
 * Every selector the control bar can be addressed by: `#id`,
 * `[data-tour="…"]`, `[data-testid="…"]`.
 */
function controlBarSelectors(): Set<string> {
  const selectors = new Set<string>()
  for (const [, id] of controlBarSource.matchAll(/\bid="([^"]+)"/g)) {
    selectors.add(`#${id}`)
  }
  for (const [, name] of controlBarSource.matchAll(/\bdata-tour="([^"]+)"/g)) {
    selectors.add(`[data-tour="${name}"]`)
  }
  for (const [, name] of controlBarSource.matchAll(
    /\bdata-testid="([^"]+)"/g,
  )) {
    selectors.add(`[data-testid="${name}"]`)
  }
  return selectors
}

describe('Compose control-bar tour steps', () => {
  it('reads real selectors out of the control bar', () => {
    const selectors = controlBarSelectors()
    // Guard against a parse that finds nothing and passes vacuously.
    expect(selectors.size).toBeGreaterThan(3)
    expect(selectors.has('#record-btn')).toBe(true)
    expect(selectors.has('[data-tour="compose.share"]')).toBe(true)
  })

  it('opens the phone drawer before pointing inside it', () => {
    const selectors = controlBarSelectors()
    const inside = WALKTHROUGH_STEPS.filter(
      (step) =>
        // Scoped to Compose: `#bpm-input` and friends are declared by all
        // four control bars, and the Singing step that points at one opens
        // Singing's drawer, not this one.
        step.requiredTab === TAB_COMPOSE &&
        // A desktop-only step never runs on the phone walk.
        step.viewport !== 'desktop' &&
        selectors.has(step.targetSelector),
    )

    // If this ever hits zero the invariant has stopped being tested.
    expect(inside.length).toBeGreaterThan(0)

    for (const step of inside) {
      expect(
        step.reveal,
        `walkthrough step "${step.title}" points at ${step.targetSelector}, ` +
          `which lives in Compose's phone drawer — it needs ` +
          `reveal: '${DRAWER_REVEAL}' or it misses on a phone`,
      ).toBe(DRAWER_REVEAL)
    }
  })
})
