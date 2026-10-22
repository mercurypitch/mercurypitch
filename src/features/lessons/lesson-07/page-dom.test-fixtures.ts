// ============================================================
// Lesson 7 page doubles — the page's own markup, and every note it starts
// ============================================================
//
// A test that drives Lesson 7's modules as the page does loads
// learn/07.html's body into jsdom (`loadPage`), so every selector meets the
// markup it meets in a browser, and hears the page through a fake
// `Sound.voice` (`listen`): each note the page starts, and whether it was
// stopped. Sound is on, as after a first tap; jsdom has no Web Audio, so a
// sung line (Merc's siren) draws in silence, its run timed as if heard. The
// page's scripts never run: the test mounts what it drives, the steps on the
// page's own deck (`mountSteps`) as main.ts mounts them.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type { RangeToy } from './range-toy'
import { initSteps } from './steps'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/07.html'), 'utf8')

/** learn/07.html's body, in the test's document. */
export function loadPage(): void {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/07.html has no body')
  document.body.innerHTML = body[1]
}

/** A note the page started: its MIDI note, and whether it has been stopped. */
export interface HeardVoice {
  midi: number
  stopped: boolean
}

/** Turns sound on and returns every note the page starts from now on, in order. */
export function listen(): HeardVoice[] {
  const heard: HeardVoice[] = []
  vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
  vi.spyOn(Sound, 'state', 'get').mockReturnValue('on')
  vi.spyOn(Sound, 'voice').mockImplementation((freq: number) => {
    const v: HeardVoice = {
      midi: Math.round(69 + 12 * Math.log2(freq / 440)),
      stopped: false,
    }
    heard.push(v)
    const voice: Voice = {
      alive: true,
      setFreq: (f: number) => {
        v.midi = Math.round(69 + 12 * Math.log2(f / 440))
      },
      setGain: () => undefined,
      stop: () => {
        v.stopped = true
      },
    }
    return voice
  })
  return heard
}

/** The element `selector` finds, or a failure naming it. */
export function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found
}

/** The page's deck with its steps mounted, opened on step 1 as the page opens it. */
export function mountSteps(): { deck: StepDeck; toy: RangeToy } {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  const toy = initSteps(deck)
  deck.start()
  return { deck, toy }
}

/** A key pressed on an element. */
export const press = (target: HTMLElement, key: string): void => {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  )
}
