// A tour step can only point at something that exists
// ============================================================
//
// Tour selectors rot silently. The room-noise control changed from a
// `<select id="preset-select">` to a slider, and the Settings tour kept
// pointing at the select: the step still ran, the spotlight just landed on
// nothing. Nothing failed until the release-time browser walk — and three
// e2e tests aiming at the same dead id had gone quiet too, because they sit
// outside the smoke set the PR gate runs.
//
// The browser walk stays the real check (it proves the target is *visible*).
// This is the cheap half of it: every hook a tour names has to appear
// somewhere in the source, so deleting a control fails the build of the PR
// that deletes it rather than the release two weeks later.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { WalkthroughStep } from '@/stores/app-store'
import { PAGE_TOURS, PRACTICE_MODES_TOUR_STEPS, STEM_MIXER_TOUR_STEPS, WALKTHROUGH_STEPS, } from '@/stores/app-store'

/** Everything a step can name, as one flat list of selectors. */
function selectorsOf(step: WalkthroughStep): string[] {
  return [step.targetSelector, ...(step.navigate ?? [])].filter(
    (selector): selector is string =>
      typeof selector === 'string' && selector.length > 0,
  )
}

/**
 * The stable hooks a selector leans on. Class names are deliberately not
 * collected: tours must not target hashed CSS-module classes, and the ones
 * that appear here are global helpers this check has no opinion about.
 */
function hooksIn(selector: string): string[] {
  const hooks: string[] = []
  for (const match of selector.matchAll(/#([A-Za-z][\w-]*)/g)) {
    hooks.push(`id:${match[1]!}`)
  }
  for (const match of selector.matchAll(
    /\[data-(tour|testid|collapsible|settings-anchor)="([^"]+)"\]/g,
  )) {
    hooks.push(`data-${match[1]!}:${match[2]!}`)
  }
  return hooks
}

/** Where selectors are declared rather than implemented. */
const DEFINITION_FILES = new Set(['app-store.ts', 'walkthrough.ts'])

function sourceText(): string {
  const chunks: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      // The tour and tutorial definitions, and this test, are where the
      // selectors are written down; finding one there proves nothing.
      if (DEFINITION_FILES.has(entry)) continue
      if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) {
        if (entry !== 'node_modules' && entry !== 'e2e') walk(path)
        continue
      }
      if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        chunks.push(readFileSync(path, 'utf8'))
      }
    }
  }
  walk(join(process.cwd(), 'src'))
  return chunks.join('\n')
}

/**
 * Hooks built from a template rather than written out. The browser walk is
 * the only thing that can prove these, so they are named here rather than
 * silently widening the check for everything else.
 */
const DYNAMIC_HOOKS = new Set([
  // `data-testid={`take-${take.id}`}` — TakePicker, one per take.
  'data-testid:take-live',
])

/**
 * Whether the hook's value is written down anywhere. A hook reaches its
 * element by several routes — `data-tour="x"` directly, or handed to a
 * shared control as `dataTour="x"` / `tour="x"` / `dataTour: 'x'` — so the
 * value in quotes is what is actually checked. Deleting the control takes
 * the string with it, which is the failure this is here to catch.
 */
function isPresent(hook: string, source: string): boolean {
  if (DYNAMIC_HOOKS.has(hook)) return true
  const value = hook.slice(hook.indexOf(':') + 1)
  return source.includes(`"${value}"`) || source.includes(`'${value}'`)
}

const ALL_TOURS: Record<string, readonly WalkthroughStep[]> = {
  walkthrough: WALKTHROUGH_STEPS,
  'stem-mixer': STEM_MIXER_TOUR_STEPS,
  'practice-modes': PRACTICE_MODES_TOUR_STEPS,
  ...Object.fromEntries(
    Object.entries(PAGE_TOURS).map(([tab, steps]) => [`page:${tab}`, steps]),
  ),
}

describe('tour selectors', () => {
  it('names only hooks that exist in the app', () => {
    const source = sourceText()
    const missing: string[] = []

    for (const [tour, steps] of Object.entries(ALL_TOURS)) {
      for (const step of steps ?? []) {
        for (const selector of selectorsOf(step)) {
          for (const hook of hooksIn(selector)) {
            if (!isPresent(hook, source)) {
              missing.push(`${tour} — "${step.title}" wants ${hook}`)
            }
          }
        }
      }
    }

    expect(missing).toEqual([])
  })

  it('never targets a hashed CSS-module class', () => {
    const offenders: string[] = []
    for (const [tour, steps] of Object.entries(ALL_TOURS)) {
      for (const step of steps ?? []) {
        for (const selector of selectorsOf(step)) {
          // A module class arrives as `styles.thing`; a bare `.thing` in a
          // selector is a global class and survives a rebuild.
          if (selector.includes('styles.')) {
            offenders.push(`${tour} — "${step.title}": ${selector}`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
