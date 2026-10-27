// ============================================================
// Lesson 10 Sing it doubles — the card on the page's markup, a visit at a time
// ============================================================
//
// Sing it's tests run the card on learn/10.html's markup (page-dom.test-
// fixtures.ts), each visit its modules loaded afresh (`loadSing`), so the
// voice choice reads `fyp-voice` as a new visit does and the visit's ending
// starts from the practise card. Sound is on, as after a first tap. Every
// sound is one of the kit's runs, swapped for the kit's recorder, so a test
// says how Merc's notes end; the swap is the test file's own, and carries
// the recorder, so these doubles reach the one the page plays through:
//
//   vi.mock('@/features/lessons/kit/run', async (actual) => {
//     const recorder =
//       await import('@/features/lessons/kit/run-recorder.test-fixtures')
//     return {
//       ...(await actual<typeof RunModule>()),
//       ...recorder.recordedRuns,
//       recorder,
//     }
//   })

import { vi } from 'vitest'
import type * as Recorder from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { SingEvent, SingState } from './sing-flow'
import { HINT, singView } from './sing-flow'

/** The ring's stills, as main.ts passes Merc and Tavi's images. */
export const STILLS = { blue: 'blue.png', orange: 'orange.png' } as const

export interface VisitOptions {
  /** The voice an earlier lesson stored, or none. */
  readonly voice?: Voice | null
  /** Keep the storage the last visit left, as a second visit finds it. */
  readonly again?: boolean
}

/** Sing it's panels, in the card's order. */
export const PANELS = ['comfort', 'listen', 'voice', 'notes', 'feel'] as const

/** A visit: the page's modules loaded afresh, Sing it mounted on the page's markup, the sound on. */
export async function loadSing(o: VisitOptions = {}) {
  vi.resetModules()
  if (o.again !== true) localStorage.clear()
  if (o.voice) localStorage.setItem('fyp-voice', JSON.stringify(o.voice))
  const dom = await import('./page-dom.test-fixtures')
  const sing = await import('./sing')
  const comfort = await import('@/features/lessons/kit/comfort')
  const sound = await import('@/features/lessons/kit/sound')
  const owner = await import('@/features/lessons/kit/now-playing')
  const { recorder } =
    (await import('@/features/lessons/kit/run')) as unknown as {
      readonly recorder: typeof Recorder
    }
  recorder.resetRuns()
  dom.loadPage()
  dom.soundOn()
  sing.initSing(STILLS)
  return { ...dom, ...comfort, ...sound, ...owner, runs: recorder.runs }
}

export type Visit = Awaited<ReturnType<typeof loadSing>>

/** Shown on the card: neither it nor any box around it hidden. */
export function onCard(p: Visit, selector: string): boolean {
  for (let el: HTMLElement | null = p.el(selector); el; el = el.parentElement)
    if (el.hidden) return false
  return true
}

export const status = (p: Visit): string =>
  p.el('#singStatus').textContent ?? ''

/** The comfort check answered, and the voice chosen when one is named. */
export function choose(
  p: Visit,
  comfort: 'sing' | 'listen',
  voice?: Voice,
): void {
  p.el(`[data-comfort="${comfort}"]`).click()
  if (voice !== undefined)
    p.el(`[data-panel="voice"] [data-voice="${voice}"]`).click()
}

/** The latest of Merc's plays: a run of notes. */
export function lastRun(p: Visit): RecordedRun {
  const run = p.runs.at(-1)
  if (run === undefined) throw new Error('nothing has played')
  return run
}

/** Play Merc's notes pressed, and the notes heard to their end. */
export async function hearMerc(p: Visit): Promise<RecordedRun> {
  p.el('[data-notes-play]').click()
  const run = lastRun(p)
  run.end(true)
  await p.settle()
  return run
}

/** A step of a walk: what the viewer does, and the event it sends the flow. */
export interface Step {
  readonly act: (p: Visit) => Promise<void> | void
  readonly e: SingEvent
}

export const comfortStep = (c: 'sing' | 'listen'): Step => ({
  act: (p) => p.el(`[data-comfort="${c}"]`).click(),
  e: { type: 'comfort', comfort: c },
})
export const voiceStep = (v: Voice): Step => ({
  act: (p) => p.el(`[data-panel="voice"] [data-voice="${v}"]`).click(),
  e: { type: 'voice', voice: v },
})
export const heardStep = (heard: boolean): Step => ({
  act: async (p) => {
    vi.mocked(p.Sound.canPlay).mockReturnValue(heard)
    await hearMerc(p)
  },
  e: { type: 'played', heard },
})

/** What the card shows, in the flow's own terms: the panels shown, and each part's own state within its panel. */
export function shows(p: Visit) {
  const hint = p.el('[data-guide-hint]')
  return {
    panels: PANELS.filter((id) => onCard(p, `[data-panel="${id}"]`)),
    voiceLine: p.el('[data-voice-line="stored"]').hidden ? 'none' : 'stored',
    singParts: Array.from(
      document.querySelectorAll<HTMLElement>('[data-sing-part]'),
    ).map((el) => !el.hidden),
    startEnabled:
      p.el('[data-guide-start]').getAttribute('aria-disabled') === 'false',
    hint: hint.hidden ? null : hint.textContent,
    after:
      Array.from(document.querySelectorAll<HTMLElement>('[data-after]')).find(
        (el) => !el.hidden,
      )?.dataset.after ?? null,
    doctor: !p.el('[data-after-doctor]').hidden,
    status: status(p),
    card: p.VisitEnding.ending,
  }
}

/** What the flow offers for a state, as `shows` reads the card. */
export function offered(s: SingState) {
  const v = singView(s)
  return {
    panels: PANELS.filter((id) => v.panels.includes(id)),
    voiceLine: v.voiceLine,
    singParts: Array.from(
      document.querySelectorAll('[data-sing-part]'),
      () => v.singParts,
    ),
    startEnabled: v.startEnabled,
    hint: v.hint === null ? null : HINT[v.hint],
    after: v.after,
    doctor: v.doctor,
    status: v.status,
    card: v.card,
  }
}

/** After each test: the page gone, and the browser as it was. */
export function closeSing(): void {
  window.dispatchEvent(new Event('pagehide'))
  vi.useRealTimers()
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'hidden')
  document.body.textContent = ''
  localStorage.clear()
}
