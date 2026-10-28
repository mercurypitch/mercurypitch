// ============================================================
// Lesson 12 page doubles — the page's own markup, and its steps on the deck
// ============================================================
//
// A test that drives Lesson 12's modules as the page does loads
// learn/12.html's body into jsdom (`loadPage`), so every selector meets the
// markup it meets in a browser, and mounts the steps on the page's own deck
// as main.ts does (`mountSteps`). The page's scripts never run: the test
// mounts what it drives.
// Every sound on the page is one of the kit's runs, so a test that hears
// them swaps kit/run.ts for the kit's recorder
// (kit/run-recorder.test-fixtures.ts, whose header gives the `vi.mock`).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { initSteps } from './steps'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/12.html'), 'utf8')

/** learn/12.html's body, in the test's document. */
export function loadPage(): void {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/12.html has no body')
  document.body.innerHTML = body[1]
}

/** The element `selector` finds, or a failure naming it. */
export function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

/** The page's deck with its steps mounted, opened on step 1 as the page opens it. */
export function mountSteps(): StepDeck {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  initSteps()
  deck.start()
  return deck
}
