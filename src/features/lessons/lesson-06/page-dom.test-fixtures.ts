// ============================================================
// Lesson 6 page doubles — the page's own markup, and every voice it starts
// ============================================================
//
// A test that drives Lesson 6's modules as the page does loads
// learn/06.html's body into jsdom (`loadPage`), so every selector meets the
// markup it meets in a browser, and hears the page through a fake
// `Sound.voice` (`listen`): each voice the page starts, its note, and
// whether it was stopped. Sound is on, as after a first tap. The page's
// scripts never run: the test mounts what it drives, the steps on the
// page's own deck (`mountSteps`) as main.ts mounts them.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { createModeStore } from '@/features/lessons/kit/names'
import type { Voice } from '@/features/lessons/kit/sound'
import { Sound } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import { classify } from './melody'
import { initSteps } from './steps'
import type { NamesMode } from './tune-words'
import { NAMES_MODES } from './tune-words'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/06.html'), 'utf8')

/** learn/06.html's body, in the test's document. */
export function loadPage(): void {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/06.html has no body')
  document.body.innerHTML = body[1]
}

/** A voice the page started: its MIDI note, and whether it has been stopped. */
export interface HeardVoice {
  readonly midi: number
  stopped: boolean
}

/** Turns sound on and returns every voice the page starts from now on, in order. */
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
      setFreq: () => undefined,
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
export function mountSteps(): StepDeck {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  initSteps(deck, createModeStore<NamesMode>(NAMES_MODES, 'letters'))
  deck.start()
  return deck
}

/** Plays Step or leap?'s round to its end, listening, and answers it wrong (fake timers). */
export function missARound(heard: HeardVoice[]): void {
  el('#stepLeapGame [data-eg-play]').click()
  vi.advanceTimersByTime(1600)
  const [a, b] = heard.slice(-2).map((v) => v.midi)
  const wrong = classify(b - a) === 'step' ? 'leap' : 'step'
  el(`#stepLeapGame [data-eg-answer="${wrong}"]`).click()
}
