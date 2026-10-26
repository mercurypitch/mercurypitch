// Starting a Merc tour: one at a time, in a root of its own on <body>, and
// coachActive() naming it for exactly as long as its layer is up.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { coachActive } from '@/lib/coach-state'
import type { CoachTour } from '@/lib/coach-types'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import { COACH_ROOT_ID, endCoachTour, startCoachTour } from './start'

const { trackTour } = vi.hoisted(() => ({ trackTour: vi.fn() }))
vi.mock('@/lib/guide-funnel', () => ({ trackTour }))
// jsdom has no WebGL: Merc is his still.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

const tour = (key: CoachTour['key'], ...titles: string[]): CoachTour => ({
  key,
  steps: titles.map((title, index) => ({
    id: `step-${index}`,
    kind: 'show',
    title,
    body: `${title}, said plainly.`,
    merc: 'point',
  })),
})

const roots = (): Element[] => [
  ...document.querySelectorAll(`#${COACH_ROOT_ID}`),
]

/** The layer unmounts a microtask after it closes. */
const settle = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  document.body.replaceChildren()
})

afterEach(async () => {
  document.body.replaceChildren()
  await settle()
})

describe('startCoachTour', () => {
  it('mounts the layer in a root of its own and names the tour while it runs', async () => {
    const handle = await startCoachTour(tour('sing', 'Tap to start'))

    expect(roots()).toHaveLength(1)
    expect(roots()[0]?.parentElement).toBe(document.body)
    expect(roots()[0]).toHaveTextContent('Tap to start')
    expect(coachActive()).toBe('sing')

    handle.end()
    await expect(handle.ended).resolves.toBe('exit')
    await settle()
    expect(roots()).toHaveLength(0)
    expect(coachActive()).toBeNull()
  })

  it('ends a running tour before starting another', async () => {
    const onEnd = vi.fn()
    const first = await startCoachTour(tour('sing', 'Tap to start'), { onEnd })
    const second = await startCoachTour(
      tour('karaoke-night', 'Start with the demo'),
    )

    await expect(first.ended).resolves.toBe('exit')
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('exit')
    await settle()
    expect(roots()).toHaveLength(1)
    expect(roots()[0]).toHaveTextContent('Start with the demo')
    expect(coachActive()).toBe('karaoke-night')

    second.end()
    await settle()
    expect(coachActive()).toBeNull()
  })

  it('never shows a tour that was replaced while it loaded', async () => {
    const replaced = startCoachTour(tour('sing', 'Tap to start'))
    const kept = startCoachTour(tour('karaoke-night', 'Sing along'))
    const [gone, shown] = await Promise.all([replaced, kept])

    await expect(gone.ended).resolves.toBe('exit')
    await settle()
    expect(roots()).toHaveLength(1)
    expect(roots()[0]).toHaveTextContent('Sing along')

    shown.end()
  })

  it('ends the tour on screen when the page moves on, as an exit', async () => {
    const handle = await startCoachTour(tour('sing', 'Tap to start', 'Sing'))
    endCoachTour()

    await expect(handle.ended).resolves.toBe('exit')
    expect(trackTour).toHaveBeenLastCalledWith('tour_exit', 'sing', {
      step: 1,
      of: 2,
    })
    await settle()
    expect(roots()).toHaveLength(0)
    expect(coachActive()).toBeNull()
  })

  it('drops a tour still loading when the page moves on', async () => {
    const loading = startCoachTour(tour('sing', 'Tap to start'))
    expect(coachActive()).toBe('sing')
    endCoachTour()
    expect(coachActive()).toBeNull()

    const handle = await loading
    await expect(handle.ended).resolves.toBe('exit')
    await settle()
    expect(roots()).toHaveLength(0)
  })

  it('reports done when the singer finishes, and lets go of the page', async () => {
    const handle = await startCoachTour(tour('sing', 'Only step'))
    const done = [
      ...(roots()[0]?.querySelectorAll<HTMLButtonElement>('button') ?? []),
    ].find((button) => button.textContent === 'Done')
    expect(done).toBeDefined()
    done?.click()

    await expect(handle.ended).resolves.toBe('done')
    await settle()
    expect(roots()).toHaveLength(0)
    expect(coachActive()).toBeNull()
  })
})
