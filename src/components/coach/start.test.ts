// Starting a Merc tour: one at a time, in a root of its own on <body>, and
// coachActive() naming it for exactly as long as its layer is up.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { coachActive } from '@/lib/coach-state'
import type { CoachTour } from '@/lib/coach-types'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import { provideTourSetting } from '@/lib/tour-screen'
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

    describe('to a heading the singer can see', () => {
      // jsdom lays nothing out: each heading is given a box, and the page a
      // hit test that says what lies at a point, as a browser would.
      const boxes = new Map<Element, DOMRect>()
      let topAt: (x: number, y: number) => Element | null = () => null

      beforeEach(() => {
        boxes.clear()
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
          function (this: Element) {
            return boxes.get(this) ?? new DOMRect(0, 0, 0, 0)
          },
        )
        Object.defineProperty(document, 'elementFromPoint', {
          configurable: true,
          value: (x: number, y: number) => topAt(x, y),
        })
      })

      afterEach(() => {
        vi.restoreAllMocks()
        Reflect.deleteProperty(document, 'elementFromPoint')
      })

      /** A heading laid out at `y`, 20 px tall across the window. */
      const heading = (tag: string, text: string, y: number): HTMLElement => {
        const el = document.createElement(tag)
        el.textContent = text
        boxes.set(el, new DOMRect(0, y, 300, 20))
        return el
      }

      it("passes over one a stage covers, for the stage's own", async () => {
        // Karaoke Night on a phone with a song on stage: the rail's opener
        // card sits under the stage, which draws the song's title.
        const rail = heading('h2', 'Goodbye to Spring', 100)
        const stage = document.createElement('div')
        const title = heading('h2', 'Goodbye to Spring', 10)
        stage.append(title)
        document.body.append(rail, stage)
        topAt = (_x, y) => (y >= 10 && y < 30 ? title : stage)
        const handle = await startCoachTour(tour('karaoke-night', 'Only step'))
        await settle()

        handle.end()
        await settle()

        expect(document.activeElement).toBe(title)
      })

      it('passes over one that is not drawn, though it would take a tap', async () => {
        const faded = heading('h1', 'Your stage is set', 100)
        Object.defineProperty(faded, 'checkVisibility', { value: () => false })
        const main = document.createElement('main')
        const shown = heading('h2', 'Goodbye to Spring', 200)
        main.append(shown)
        document.body.append(faded, main)
        topAt = (_x, y) => (y < 150 ? faded : shown)
        const handle = await startCoachTour(tour('karaoke-night', 'Only step'))
        await settle()

        handle.end()
        await settle()

        expect(document.activeElement).toBe(shown)
      })

      it('takes the main one still, when none can be seen', async () => {
        const main = document.createElement('main')
        const h1 = heading('h1', 'Your stage is set', 100)
        main.append(h1)
        const cover = document.createElement('div')
        document.body.append(main, cover)
        topAt = () => cover
        const handle = await startCoachTour(tour('karaoke-night', 'Only step'))
        await settle()

        handle.end()
        await settle()

        expect(document.activeElement).toBe(h1)
      })
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

describe('"Show me more"', () => {
  const NEXT_ON_PLAN = { title: 'Next on your plan', body: 'Sing a scale.' }

  /** A promise and the hands that settle it, for steps that load on cue. */
  function deferred<T>(): {
    promise: Promise<T>
    resolve: (value: T) => void
    reject: (error: unknown) => void
  } {
    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<T>((yes, no) => {
      resolve = yes
      reject = no
    })
    return { promise, resolve, reject }
  }

  /** The Sing tour, one stop long, offering `steps` as its second tour. */
  const offering = (steps: () => Promise<CoachTour>): CoachTour => ({
    ...tour('sing', 'Keep a take'),
    more: { key: 'sing-more', label: 'Show me more', load: steps },
  })

  const press = (label: string): void => {
    const button = [
      ...(roots()[0]?.querySelectorAll<HTMLButtonElement>('button') ?? []),
    ].find((b) => b.textContent === label)
    if (!button) throw new Error(`no ${label}`)
    button.click()
  }

  /** Waits for what a tour's layer shows, across the load and the mount. */
  const showing = async (text: string): Promise<void> => {
    await vi.waitFor(() => {
      expect(roots()).toHaveLength(1)
      expect(roots()[0]).toHaveTextContent(text)
    })
  }

  it('starts the tour it offers in its place, its steps loaded on the tap, and hands over only at its end', async () => {
    const load = vi.fn(async () => tour('sing-more', 'Repeat goes round'))
    const go = vi.fn()
    const first = await startCoachTour(offering(load), {
      handoff: () => ({ ...NEXT_ON_PLAN, go }),
    })
    expect(load).not.toHaveBeenCalled()

    press('Show me more')

    expect(load).toHaveBeenCalledOnce()
    await expect(first.ended).resolves.toBe('done')
    expect(trackTour).toHaveBeenCalledWith('tour_done', 'sing', {
      step: 1,
      of: 1,
    })
    // No hand-over between the two, and the coach still named meanwhile.
    expect(document.body).not.toHaveTextContent(NEXT_ON_PLAN.title)
    expect(coachActive()).toBe('sing-more')
    await showing('Repeat goes round')
    expect(coachActive()).toBe('sing-more')

    press('Done')
    await showing(NEXT_ON_PLAN.title)
    press('Go')
    expect(go).toHaveBeenCalledOnce()
    await settle()
    expect(coachActive()).toBeNull()
  })

  it('leaves Done on the offering tour to hand over as it always has', async () => {
    const load = vi.fn(async () => tour('sing-more', 'Repeat goes round'))
    await startCoachTour(offering(load), {
      handoff: () => ({ ...NEXT_ON_PLAN, go: vi.fn() }),
    })

    press('Done')

    await showing(NEXT_ON_PLAN.title)
    expect(load).not.toHaveBeenCalled()
  })

  it('gives focus back and lets go when the tour it offers does not load', async () => {
    const control = document.createElement('button')
    document.body.append(control)
    control.focus()
    const steps = deferred<CoachTour>()
    await startCoachTour(offering(() => steps.promise))
    await settle()

    press('Show me more')
    await settle()
    expect(coachActive()).toBe('sing-more')
    steps.reject(new Error('chunk failed'))

    await vi.waitFor(() => expect(coachActive()).toBeNull())
    expect(roots()).toHaveLength(0)
    expect(document.activeElement).toBe(control)
  })

  describe('the page its steps set', () => {
    /** Singing's view as the page holds it, and how often a tour put it back. */
    const page = { notation: true, putBack: 0 }
    let remove: () => void = () => undefined

    beforeEach(() => {
      page.notation = true
      page.putBack = 0
      remove = provideTourSetting('sing.melody', () => {
        if (!page.notation) return null
        page.notation = false
        return () => {
          page.notation = true
          page.putBack += 1
        }
      })
    })
    afterEach(() => remove())

    /** A tour whose steps need the Melody view. */
    const onMelody = (key: CoachTour['key'], title: string): CoachTour => {
      const plain = tour(key, title)
      return {
        ...plain,
        steps: plain.steps.map((step) => ({
          ...step,
          screen: ['sing.melody'],
        })),
      }
    }

    it('sets it as the step shows and puts it back once the tour ends', async () => {
      const handle = await startCoachTour(onMelody('sing', 'That line'))
      expect(page.notation).toBe(false)

      handle.end()
      await settle()
      expect(page.notation).toBe(true)
      expect(page.putBack).toBe(1)
    })

    it('keeps it set into the tour "Show me more" starts, and puts it back after that one', async () => {
      await startCoachTour({
        ...onMelody('sing', 'That line'),
        more: {
          key: 'sing-more',
          label: 'Show me more',
          load: async () => onMelody('sing-more', 'Repeat goes round'),
        },
      })

      press('Show me more')
      await showing('Repeat goes round')
      // Not put back between the two: the page did not flick to Notation.
      expect(page.putBack).toBe(0)
      expect(page.notation).toBe(false)

      press('Done')
      await settle()
      expect(page.notation).toBe(true)
      expect(page.putBack).toBe(1)
    })

    it('puts it back when the tour "Show me more" offers does not load', async () => {
      const steps = deferred<CoachTour>()
      await startCoachTour({
        ...onMelody('sing', 'That line'),
        more: {
          key: 'sing-more',
          label: 'Show me more',
          load: () => steps.promise,
        },
      })

      press('Show me more')
      await settle()
      steps.reject(new Error('chunk failed'))

      await vi.waitFor(() => expect(page.notation).toBe(true))
      expect(page.putBack).toBe(1)
    })
  })

  it('never shows the tour it offers once the page has moved on', async () => {
    const steps = deferred<CoachTour>()
    await startCoachTour(offering(() => steps.promise))

    press('Show me more')
    await settle()
    endCoachTour()
    steps.resolve(tour('sing-more', 'Repeat goes round'))
    await settle()
    await settle()

    expect(roots()).toHaveLength(0)
    expect(coachActive()).toBeNull()
  })
})
