// ============================================================
// Lesson 14 page doubles — the page's own markup, and its steps on the deck
// ============================================================
//
// A test that drives Lesson 14's modules as the page does loads
// learn/14.html's body into jsdom (`loadPage`), so every selector meets the
// markup it meets in a browser, and mounts the steps on the page's own deck
// as main.ts does (`mountSteps`), handing back the song line they mount.
// Sound is on, as after a first tap, with `soundOn`. The page's scripts
// never run: the test mounts what it drives. Every sound on the page is one
// of the kit's runs, so a test that hears them swaps kit/run.ts for the
// kit's recorder (kit/run-recorder.test-fixtures.ts, whose header gives the
// `vi.mock`).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type { SongLine } from './song-line'
import { initSteps } from './steps'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/14.html'), 'utf8')

/** learn/14.html's body, in the test's document. */
export function loadPage(): void {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/14.html has no body')
  document.body.innerHTML = body[1]
}

/** Sound on, as after the first tap. */
export function soundOn(): void {
  vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
  vi.spyOn(Sound, 'state', 'get').mockReturnValue('on')
}

/** The element `selector` finds, or a failure naming it. */
export function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

/** The visible control inside the stage that `selector` finds. */
export function shown<T extends HTMLElement = HTMLButtonElement>(
  selector: string,
): T {
  const found = Array.from(
    document.querySelectorAll<T>(`#toySong ${selector}`),
  ).find((b) => b.closest('[hidden]') === null)
  if (found === undefined) throw new Error(`no visible ${selector}`)
  return found
}

/** A control's accessible name, as a screen reader reads it. */
export const nameOf = (b: Element): string =>
  b.getAttribute('aria-label') ??
  (b.textContent ?? '').replace(/\s+/g, ' ').trim()

/** Lets the promises the page awaits settle. */
export const settle = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

/** The page's deck with its steps mounted, opened on step 1 as the page opens it, and the song line on its stage. */
export function mountSteps(): StepDeck & { readonly line: SongLine } {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  const line = initSteps(deck)
  deck.start()
  return Object.assign(deck, { line })
}
