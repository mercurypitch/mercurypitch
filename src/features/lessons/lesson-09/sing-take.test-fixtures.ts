// ============================================================
// Lesson 9 Sing it take fixtures — a listener double, the card, a take
// ============================================================
//
// The page's take tests (sing-take.test.ts, sing-leave.test.ts) run Sing it
// on learn/09.html's markup with the listener as a double: its takes are
// synthetic frames at the detector's hop (`sung`), read by the real ladder
// reader, and it counts each load of its chunk, each ask for the
// microphone, each take opened and each release. The runs are the kit's
// recorders (kit/run-recorder.test-fixtures.ts), riding on the swapped
// module as Lesson 9's sing.test.ts has them, so Merc's ladder ends when the
// test says. The mocks are the test file's own:
//
//   const takes = vi.hoisted(() => ({}) as TakeDouble)
//
//   vi.mock('@/features/lessons/kit/listen', async (actual) =>
//     (await import('./sing-take.test-fixtures')).listenDouble(
//       await actual(),
//       takes,
//     ),
//   )
//
// with `Object.assign(takes, freshTakes())` before each test, and kit/run's
// swap as sing.test.ts names it.

import { vi } from 'vitest'
import type * as ListenModule from '@/features/lessons/kit/listen'
import type * as Recorder from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { F0Frame } from '@/lib/mirror/metrics'
import { DEFAULT_HOP_SEC } from '@/lib/mirror/metrics'

/** What the listener double does, and what it counted. */
export interface TakeDouble {
  /** Times the listener's chunk loaded. */
  loaded: number
  /** The consumer id the microphone was asked for, each time. */
  asked: string[]
  /** The next take's frames. */
  frames: F0Frame[]
  /** The voice's start as the listener reports it, when not the first voiced frame's. */
  voicedAt: number | null | undefined
  /** Runs as the page asks for the microphone, before the listener resolves. */
  opening: (() => void) | null
  /** Runs inside an open take, which then reads nothing: the viewer gone mid-take. */
  during: ((o: ListenModule.TakeOptions) => void) | null
  /** Runs once a take's frames are drawn, before it ends; a take cancelled by then reads nothing, as the kit's does. */
  inside: (() => void) | null
  opened: number
  released: number
  releasedNow: number
}

export const freshTakes = (): TakeDouble => ({
  loaded: 0,
  asked: [],
  frames: [],
  voicedAt: undefined,
  opening: null,
  during: null,
  inside: null,
  opened: 0,
  released: 0,
  releasedNow: 0,
})

/** kit/listen.ts with its listener and its takes swapped for the double's. */
export function listenDouble(
  real: typeof ListenModule,
  takes: TakeDouble,
): typeof ListenModule {
  takes.loaded += 1
  return {
    ...real,
    listen: (id: string) => {
      takes.asked.push(id)
      takes.opening?.()
      return Promise.resolve({
        holding: true,
        latest: () => null,
        release: () => {
          takes.released += 1
        },
        releaseNow: () => {
          takes.releasedNow += 1
        },
      })
    },
    takeFrames: (_: unknown, o: ListenModule.TakeOptions) => {
      takes.opened += 1
      if (takes.during !== null) {
        takes.during(o)
        return Promise.resolve(null)
      }
      const at =
        takes.voicedAt !== undefined
          ? takes.voicedAt
          : (takes.frames.find((f) => f.f0 > 0)?.t ?? null)
      const frames = takes.frames.map((f) => ({ ...f, rms: 0.1 }))
      for (const f of frames) o.onFrame?.(f, at)
      takes.inside?.()
      return Promise.resolve(o.cancelled() ? null : frames)
    },
  }
}

/** Frames at the detector's hop: half a second of silence, then each note (or silence, null) for its seconds. */
export function sung(
  ...notes: readonly (readonly [number | null, number])[]
): F0Frame[] {
  const frames: F0Frame[] = []
  let t = 0
  const add = (midi: number | null, seconds: number): void => {
    for (const end = t + seconds - 1e-9; t < end; t += DEFAULT_HOP_SEC)
      frames.push(
        midi === null
          ? { t, f0: 0, conf: 0 }
          : { t, f0: 440 * 2 ** ((midi - 69) / 12), conf: 0.95 },
      )
  }
  add(null, 0.5)
  for (const [midi, seconds] of notes) add(midi, seconds)
  return frames
}

/**
 * The page's modules, loaded afresh, with the lower voice stored, Sing it
 * mounted, the sound on and the comfort check answered "sing".
 */
export async function loadCard(takes: TakeDouble) {
  vi.resetModules()
  localStorage.setItem('fyp-voice', JSON.stringify('lower'))
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
  const card = sing.initSing()
  dom.soundOn()
  vi.spyOn(sound.Sound, 'context').mockReturnValue({} as AudioContext)
  dom.el('[data-comfort="sing"]').click()
  return {
    ...dom,
    ...comfort,
    ...sound,
    ...owner,
    runs: recorder.runs,
    card,
    takes,
  }
}

export type Page = Awaited<ReturnType<typeof loadCard>>

export const status = (p: Page): string => p.el('#singStatus').textContent ?? ''
export const summary = (p: Page): string | null =>
  p.el('#singChart canvas').getAttribute('aria-label')
export const lines = (p: Page): string[] =>
  Array.from(p.el('[data-readings]').children, (li) => li.textContent ?? '')
export const start = (p: Page): HTMLElement => p.el('[data-sing="start"]')
export const lastTake = (p: Page) => p.card.visit.takes.at(-1)
/** Merc's ladders the take began with, each a run of notes. */
export const mercRuns = (p: Page): RecordedRun[] =>
  p.runs.filter((r) => r.kind === 'notes')

/** Shown on the card: neither it nor any box around it hidden. */
export function onCard(p: Page, selector: string): boolean {
  for (let el: HTMLElement | null = p.el(selector); el; el = el.parentElement)
    if (el.hidden) return false
  return true
}

/** Merc's ladder, the latest of the page's runs: it starts only once the microphone is open. */
export function mercRun(p: Page): RecordedRun {
  const run = p.runs.at(-1)
  if (run === undefined || run.kind !== 'notes')
    throw new Error('Merc is not singing')
  return run
}

/** A turn of the test's real event loop, which the fake timers leave alone. */
const tick = (): Promise<void> =>
  new Promise((done) => {
    setImmediate(done)
  })

/**
 * `button` pressed: the take's module and the listener load inside the tap,
 * the microphone opens, then Merc's ladder starts, or the take ends unbegun.
 */
export async function press(p: Page, button: HTMLElement): Promise<void> {
  const runs = p.runs.length
  button.click()
  // the modules load, however long a busy machine takes to transform them
  const until = Date.now() + 10_000
  while (
    p.card.visit.taking !== null &&
    p.runs.length === runs &&
    Date.now() < until
  )
    await tick()
  await vi.advanceTimersByTimeAsync(0)
}

/** `button` pressed, Merc's ladder heard to its end, and a take of `frames` read. */
export async function take(
  p: Page,
  button: HTMLElement,
  frames: F0Frame[],
  voicedAt?: number | null,
): Promise<void> {
  p.takes.frames = frames
  p.takes.voicedAt = voicedAt
  await press(p, button)
  mercRun(p).end(true)
  await vi.advanceTimersByTimeAsync(400)
}

/** The tab hidden, as switching to another tab hides it: `document.hidden`, then its event. */
export function hideTab(): void {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => true,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

/** After each test: the page gone, letting go any microphone a test left open, and the browser as it was. */
export function closeCard(): void {
  window.dispatchEvent(new Event('pagehide'))
  vi.useRealTimers()
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'hidden')
  document.body.textContent = ''
  localStorage.clear()
}
