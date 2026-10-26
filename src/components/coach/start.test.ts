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

  describe('gives focus back once the tour is over', () => {
    /** A page with its main heading and the control that had focus. */
    function page(): { heading: HTMLElement; control: HTMLButtonElement } {
      const main = document.createElement('main')
      const heading = document.createElement('h1')
      heading.textContent = 'Your stage is set'
      const control = document.createElement('button')
      control.textContent = 'Open the song list'
      main.append(heading, control)
      document.body.append(main)
      control.focus()
      return { heading, control }
    }
    const bubble = (): HTMLElement => {
      const el = roots()[0]?.querySelector<HTMLElement>(
        '[data-testid="coach-bubble"]',
      )
      if (!el) throw new Error('no bubble')
      return el
    }
    const press = (label: string): void => {
      const button = [
        ...(roots()[0]?.querySelectorAll<HTMLButtonElement>('button') ?? []),
      ].find(
        (b) =>
          b.textContent === label || b.getAttribute('aria-label') === label,
      )
      if (!button) throw new Error(`no ${label}`)
      button.click()
    }

    const ENDS: Record<string, () => void> = {
      Done: () => press('Done'),
      'End tour': () => press('End tour'),
      Escape: () =>
        bubble().dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        ),
      'a tab change': () => endCoachTour(),
    }

    for (const [how, end] of Object.entries(ENDS)) {
      it(`to what had it before the tour, after ${how}`, async () => {
        const { control } = page()
        const handle = await startCoachTour(tour('sing', 'Only step'))
        await settle()
        expect(document.activeElement).toBe(bubble())

        end()
        await handle.ended
        await settle()

        expect(roots()).toHaveLength(0)
        expect(document.activeElement).toBe(control)
      })
    }

    it("to the page's main heading when that control has gone, and leaves the heading as it was", async () => {
      const { heading, control } = page()
      const handle = await startCoachTour(tour('karaoke-night', 'Only step'))
      await settle()
      control.remove()

      press('Done')
      await handle.ended
      await settle()

      expect(document.activeElement).toBe(heading)
      // Focusable only while it holds focus.
      expect(heading.getAttribute('tabindex')).toBe('-1')
      heading.blur()
      expect(heading.hasAttribute('tabindex')).toBe(false)
    })

    it('to the highest heading there is when the page has no level-one heading to take it', async () => {
      // Karaoke Night with a song on stage: its h1 is not shown, and the
      // song's title is the page's heading.
      const hidden = document.createElement('h1')
      hidden.hidden = true
      hidden.textContent = 'Karaoke Night'
      const rail = document.createElement('h3')
      rail.textContent = 'Add a song'
      const main = document.createElement('main')
      const title = document.createElement('h2')
      title.textContent = 'Goodbye to Spring'
      main.append(title)
      document.body.append(hidden, rail, main)
      const handle = await startCoachTour(tour('karaoke-night', 'Only step'))
      await settle()

      handle.end()
      await settle()

      expect(document.activeElement).toBe(title)
    })

    it('only when the tour had it: focus the singer moved out into the page stays there', async () => {
      // A quiet wait draws no bubble, and the singer goes on with the page;
      // a tour that ends then (another song staged) takes nothing from them.
      const { control } = page()
      const other = document.createElement('button')
      other.textContent = 'Next song'
      document.body.append(other)
      const handle = await startCoachTour(tour('karaoke-night', 'Only step'))
      await settle()
      other.focus()

      handle.end()
      await settle()

      expect(document.activeElement).toBe(other)
      expect(control).not.toBe(document.activeElement)
    })

    it('when focus had fallen to the page itself as the tour ended', async () => {
      const { control } = page()
      const handle = await startCoachTour(tour('karaoke-night', 'Only step'))
      await settle()
      ;(document.activeElement as HTMLElement | null)?.blur()
      expect(document.activeElement).toBe(document.body)

      handle.end()
      await settle()

      expect(document.activeElement).toBe(control)
    })

    it('to the main heading when nothing had focus before the tour', async () => {
      const { heading, control } = page()
      control.blur()
      const handle = await startCoachTour(tour('sing', 'Only step'))
      await settle()

      handle.end()
      await settle()

      expect(document.activeElement).toBe(heading)
    })
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
