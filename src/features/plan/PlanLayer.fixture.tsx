// ============================================================
// PlanLayer fixture: what the layer's two test files share
// ============================================================
//
// The layer is opened in a mode and tapped the way a singer taps the screens,
// so PlanLayer.test.tsx and PlanLayer.ways.test.tsx need the same few things:
// the layer over a plan nobody has met, the record put back between cases, the
// way to the plan, and the pieces of the page found by what they are.
//
// A fixture cannot register a file's mocks or hooks for it (vi.mock is hoisted
// within the file that writes it), so each file keeps its own three vi.mock
// calls and runs `setUp` and `tearDown` from its own hooks. The plan record is
// a module signal that `localStorage.clear()` does not reach, so `setUp` puts
// it back.

import { cleanup, render, screen } from '@solidjs/testing-library'
import type { Mock } from 'vitest'
import { vi } from 'vitest'
import { GUIDE_FUNNEL_STORAGE_KEY } from '@/lib/guide-funnel'
import { applyPersistedValue } from '@/lib/storage'
import { setPracticeScope, setUiMode } from '@/stores/settings-store'
import { setActiveTab } from '@/stores/ui-store'
import type { PlanStop } from './build-plan'
import { PLAN_OPENED_KEY, PLAN_RECORD_KEY } from './plan-keys'
import type { PlanTexts } from './plan-record'
import { savePlanAnswers } from './plan-store'
import type { PlanLayerProps } from './PlanLayer'
import { PlanLayer } from './PlanLayer'
import { next, toFourthQuestion } from './PlanQuestions.fixture'
import type { PlanChoices } from './questions'

/** Singing for an audition: Start here Sing, Learn Hear Yourself, Play Karaoke Night, and the menu switch. */
export const AUDITION: PlanChoices = {
  q1: 'singing',
  q2: 'audition',
  q3: ['progress', 'tune'],
  q4: ['teacher'],
}
const NO_TEXTS: PlanTexts = { q3other: '', q4app: '' }

export interface Host {
  onClose: Mock<() => void>
}

/** The layer in a mode; `onClose` is the app's close, which a case may make note of. */
export function open(
  mode: PlanLayerProps['mode'],
  onClose: Mock<() => void> = vi.fn<() => void>(),
): Host {
  render(() => <PlanLayer mode={mode} onClose={onClose} />)
  return { onClose }
}

/** Opens the layer `times` over, closing it between: the next tap, or a reload. */
export function opened(mode: PlanLayerProps['mode'], times: number): void {
  for (let i = 0; i < times; i++) {
    open(mode)
    cleanup()
  }
}

/** The plan as nobody has met it: no record, no stop opened, nothing sent. */
export function fresh(): void {
  localStorage.clear()
  applyPersistedValue(PLAN_RECORD_KEY, 'null', { persist: false })
  applyPersistedValue(PLAN_OPENED_KEY, '[]', { persist: false })
}

/** What the guide funnel was told since the case began, in order. */
export function sent(): string[] {
  const raw = localStorage.getItem(GUIDE_FUNNEL_STORAGE_KEY) ?? '[]'
  return (JSON.parse(raw) as { event: string }[]).map((entry) => entry.event)
}

/** A person who has answered, and the plan they were given. */
export function answered(choices: PlanChoices = AUDITION): void {
  savePlanAnswers(choices, NO_TEXTS, null)
}

/** A guitar player's four questions, skipping the last two: the plan is up. */
export function toThePlan(): void {
  toFourthQuestion()
  next()
}

export const dialog = (): HTMLElement =>
  screen.getByRole('dialog', { name: 'Your plan' })
export const box = (): HTMLElement =>
  document.querySelector<HTMLElement>('[data-beat="questions"]')!
export const card = (kind: PlanStop['kind']): HTMLElement =>
  document.querySelector<HTMLElement>(`[data-kind="${kind}"]`)!
export const changeAnswers = (): HTMLElement | null =>
  screen.queryByRole('button', { name: 'Change my answers' })

/** Each file's `beforeEach`: fake timers, a fresh plan, the app on Singing at the plan's address. */
export function setUp(): void {
  vi.useFakeTimers()
  vi.clearAllMocks()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  fresh()
  setPracticeScope('all')
  setUiMode('advanced')
  setActiveTab('singing')
  history.replaceState(null, '', '#/plan')
}

/** Each file's `afterEach`. */
export function tearDown(): void {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
}
