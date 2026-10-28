// ============================================================
// Lesson 12 page doubles — the page's own markup, and its steps on the deck
// ============================================================
//
// A test that drives Lesson 12's modules as the page does loads
// learn/12.html's body into jsdom (`loadPage`), so every selector meets the
// markup it meets in a browser, and mounts the steps on the page's own deck
// as main.ts does (`mountSteps`), handing back the ring of rooms they
// mount, or mounts the ring alone in one state (`mountRing`), its figure
// sized as a phone or the deck lays it out. Sound is on, as after a first
// tap, with `soundOn`. The page's scripts never run: the test mounts what
// it drives.
// Every sound on the page is one of the kit's runs, so a test that hears
// them swaps kit/run.ts for the kit's recorder
// (kit/run-recorder.test-fixtures.ts, whose header gives the `vi.mock`).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { ModeStore } from '@/features/lessons/kit/names'
import { createModeStore } from '@/features/lessons/kit/names'
import type { LettersSolfegeMode } from '@/features/lessons/kit/names-modes'
import { LETTERS_SOLFEGE_MODES } from '@/features/lessons/kit/names-modes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type { Rooms, RoomsMode } from './rooms'
import { mountRooms } from './rooms'
import { initSteps } from './steps'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/12.html'), 'utf8')

/** learn/12.html's body, in the test's document. */
export function loadPage(): void {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/12.html has no body')
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

/** A phone's figure at 390 x 844 (FACTS 75), and the deck's at 844 x 390. */
export const FULL = { w: 356, h: 310 }
export const COMPACT = { w: 778, h: 162 }

/** The figure's canvas, sized as the browser would lay it out. */
export function sizeFigure(size: { w: number; h: number }): void {
  vi.spyOn(
    el<HTMLCanvasElement>('#toyRooms [data-rooms-viz] canvas'),
    'getBoundingClientRect',
  ).mockReturnValue(new DOMRect(0, 0, size.w, size.h))
}

/** The stage's ring alone, mounted on the page's markup in `mode`, its figure `size`. */
export function mountRing(
  mode: RoomsMode = 'build',
  size: { w: number; h: number } = FULL,
): Rooms {
  loadPage()
  sizeFigure(size)
  return mountRooms(el('#toyRooms'), {
    mode,
    active: () => true,
    owner: NowPlaying,
  })
}

/** The chord strip's seven chips, I to vii°. */
export const chips = (): HTMLButtonElement[] =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '#toyRooms [data-chord-strip] button',
    ),
  )
/** A chip's line: its top (`top`) or its notes (`notes`). */
export const words = (b: Element, part: 'top' | 'notes'): string =>
  b.querySelector(`[data-chip-${part}]`)?.textContent ?? ''
/** What the ring's polite line says now. */
export const said = (): string =>
  el('#toyRooms [data-rooms-said]').textContent ?? ''
/** The figure's summary now, the slider's description. */
export const summary = (): string =>
  el('#toyRooms [data-rooms-summary]').textContent ?? ''

/** Lets the promises the page awaits settle. */
export const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

/** The page's deck with its steps mounted, opened on step 1 as the page opens it: the ring of rooms on its stage, and the page's names store, Letters. */
export function mountSteps(): StepDeck & {
  readonly rooms: Rooms
  readonly names: ModeStore<LettersSolfegeMode>
} {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  const names = createModeStore<LettersSolfegeMode>(
    LETTERS_SOLFEGE_MODES,
    'letters',
  )
  const rooms = initSteps(deck, names)
  deck.start()
  return Object.assign(deck, { rooms, names })
}
