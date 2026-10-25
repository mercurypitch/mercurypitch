// ============================================================
// The Sing tab's Merc tour: four stops on either screen
// ============================================================
//
// Merc starts at the mic, since the mic is what makes him listen (Play does
// not start it: R18), waits for a sung note with a note to copy, says what the
// line is, and ends where kept takes are played back, with Lesson 1 to read
// later. The runner (runner.ts) drops the steps for the other kind of screen,
// so each screen is read through it, as the layer reads the tour.

import { describe, expect, it, vi } from 'vitest'
import type { CoachRunner } from '@/components/coach/runner'
import { createCoachRunner } from '@/components/coach/runner'
import type { CoachStep } from '@/lib/coach-types'
import { SING_TOUR } from './sing-tour'

const SCREENS = [
  { name: 'phone', phone: true },
  { name: 'desktop', phone: false },
] as const

/** A runner for one screen, on an event bus where nothing is ever sung. */
function runnerFor(phone: boolean): CoachRunner {
  return createCoachRunner(SING_TOUR, {
    phone,
    track: vi.fn(),
    on: () => () => undefined,
  })
}

/** The steps one screen shows, in order. */
function stepsFor(phone: boolean): CoachStep[] {
  const runner = runnerFor(phone)
  const steps: CoachStep[] = []
  for (let at = runner.snapshot(); at !== null; at = runner.snapshot()) {
    steps.push(at.step)
    if (at.step.kind === 'do') runner.skip()
    else runner.next()
  }
  runner.dispose()
  return steps
}

/** Everything a step says. */
const words = (step: CoachStep): string[] => [
  step.title,
  step.body,
  step.lesson?.title ?? '',
]

describe('SING_TOUR', () => {
  it.each(SCREENS)(
    'waits for a sung note on the second stop, on a $name',
    ({ phone }) => {
      const second = stepsFor(phone)[1]

      expect(second?.kind).toBe('do')
      expect(second?.waitFor).toBe('pitch-detected')
      expect(second?.sound).toBe('hold-tone')
      expect(second?.merc).toBe('listen')
    },
  )

  it.each(SCREENS)(
    'keeps to four stops and links Lesson 1 at the end, on a $name',
    ({ phone }) => {
      const steps = stepsFor(phone)

      expect(steps).toHaveLength(4)
      expect(steps.at(-1)?.kind).toBe('watch')
      expect(steps.at(-1)?.lesson).toEqual({
        href: '/learn/01',
        title: 'Why the line moves: Lesson 1, What is a note?',
      })
      expect(steps.slice(0, -1).map((step) => step.lesson)).toEqual([
        undefined,
        undefined,
        undefined,
      ])
    },
  )

  it('says only you can hear you, at the mic', () => {
    for (const { phone } of SCREENS) {
      expect(stepsFor(phone)[0]?.body).toContain('Only you can hear you.')
    }
  })

  it('starts at the mic toggle, by the hook each screen gives it', () => {
    const first = SING_TOUR.steps[0]

    expect(first?.kind).toBe('show')
    // The phone's mic, under its legacy hook, and the desktop bar's own.
    expect(first?.target).toContain('[data-tour="singing-transport"]')
    expect(first?.target).toContain('[data-tour="sing.mic"]')
  })

  it('rings the line where each screen draws it', () => {
    for (const { phone } of SCREENS) {
      const [, sing, line] = stepsFor(phone)
      for (const step of [sing, line]) {
        expect(step?.target).toContain('[data-stage-canvas]')
        expect(step?.target).toContain('#canvas-container')
      }
    }
  })

  it('ends at Hear Yourself, by what always holds it, and never says "here"', () => {
    const phoneLast = stepsFor(true).at(-1)
    const desktopLast = stepsFor(false).at(-1)

    // A phone's More always holds it; a wide bar's You group does, its own
    // tab folded into the group's menu when the bar is squeezed.
    expect(phoneLast?.target).toBe('[data-tour="mobile-tabbar-more"]')
    expect(phoneLast?.body).toContain('under More')
    expect(desktopLast?.target).toBe('[data-tab-group="you"]')
    expect(desktopLast?.body).toContain('with Home and Progress')
    for (const step of [phoneLast, desktopLast]) {
      expect(step?.body).toContain('Hear Yourself')
      // It can stand centred (a squeezed bar folds the tab away), where
      // "here" would point at nothing.
      expect(words(step as CoachStep).join(' ')).not.toMatch(/\bhere\b/i)
    }
  })

  it.each(SCREENS)(
    'moves on without a note on a $name: Next waits, Skip leaves, and the tour is still done',
    ({ phone }) => {
      const runner = runnerFor(phone)
      runner.next()

      // No note is coming: the mic was refused, or the room is silent.
      runner.next()
      expect(runner.snapshot()?.index).toBe(1)
      runner.skip()
      expect(runner.snapshot()?.index).toBe(2)
      runner.next()
      runner.next()

      expect(runner.snapshot()).toBeNull()
      expect(runner.ended()).toBe('done')
    },
  )

  it('writes no em dash and names the tour for the Sing tab', () => {
    const text = SING_TOUR.steps.flatMap(words).join(' ')

    expect(text).not.toContain('—')
    expect(SING_TOUR.key).toBe('sing')
  })
})
