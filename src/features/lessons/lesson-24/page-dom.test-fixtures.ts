// ============================================================
// Lesson 24 page doubles — the page's own markup, sound on, and its parts
// ============================================================
//
// A test that drives Lesson 24's modules as the page does loads
// learn/24.html's body into jsdom (`loadPage`), so every selector meets the
// markup it meets in a browser, and `mountSteps` adds the deck and the
// steps as main.ts mounts them. Sound is on, as after a first tap, with
// `soundOn`. The page's scripts never run: the test mounts what it drives.
// Every sound on the page is one of the kit's runs, so a test that hears
// them swaps kit/run.ts for the kit's recorder
// (kit/run-recorder.test-fixtures.ts, whose header gives the `vi.mock`).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type { Steps, StepsOptions } from './steps'
import { initSteps } from './steps'

/** learn/24.html, as the repository has it. */
export const PAGE = readFileSync(
  resolve(process.cwd(), 'learn/24.html'),
  'utf8',
)

/** learn/24.html's body, in the test's document. */
export function loadPage(): void {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/24.html has no body')
  document.body.innerHTML = body[1]
  document.body.className = 'season-2'
}

/** The page with its deck and its steps, as main.ts mounts them, on Step 1. */
export function mountSteps(
  o: StepsOptions = {},
): StepDeck & { readonly steps: Steps } {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  const steps = initSteps(deck, o)
  deck.start()
  return Object.assign(deck, { steps })
}

/** Sound on, as after the first tap. */
export function soundOn(): void {
  vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
  vi.spyOn(Sound, 'state', 'get').mockReturnValue('on')
}

/** The element `selector` finds, or a failure naming it. */
export function el<T extends Element = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

/** An element's words, as a reader meets them. */
export const words = (e: Element | null | undefined): string =>
  (e?.textContent ?? '').replace(/\s+/g, ' ').trim()

/** Lets the promises the page awaits settle. */
export const settle = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}
