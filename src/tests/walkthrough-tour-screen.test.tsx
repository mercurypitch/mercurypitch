// ============================================================
// The spotlight sets the page a step needs, and puts it back
// ============================================================
//
// A step about Compose's piano roll pointed at nothing from Sheet Music, and
// the Path tour's orbs at nothing from the plain list. A step now names the
// view it needs (`screen`): the guide sets it as the step shows, including
// for a page whose code arrives after the tab switch, and puts it back the
// way the singer had it once the tour ends. A group an earlier step opened
// goes shut again when a later step does not name it.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Walkthrough } from '@/components/Walkthrough'
import { provideTourSetting } from '@/lib/tour-screen'
import type { WalkthroughStep } from '@/stores/app-store'
import { endWalkthrough, setWalkthroughStep, startTour, } from '@/stores/app-store'

function mountTarget(id: string, tag = 'div'): HTMLElement {
  const el = document.createElement(tag)
  el.id = id
  // jsdom lays nothing out, and the guide only spotlights what it can see.
  el.getBoundingClientRect = () =>
    ({
      top: 10,
      left: 20,
      width: 100,
      height: 40,
      right: 120,
      bottom: 50,
      x: 20,
      y: 10,
      toJSON: () => ({}),
    }) as DOMRect
  el.checkVisibility = () => true
  document.body.append(el)
  return el
}

function highlight(): HTMLElement {
  const el = document.querySelector<HTMLElement>(
    '[class*="walkthroughHighlight"]',
  )
  if (el === null) throw new Error('no spotlight rendered')
  return el
}

/** The Ascent, drawn only while the page is set to it. */
function ascentView(): { ascent: boolean; remove: () => void } {
  const page = { ascent: false, remove: (): void => undefined }
  page.remove = provideTourSetting('path.ascent', () => {
    if (page.ascent) return null
    page.ascent = true
    mountTarget('path-orbs')
    return () => {
      page.ascent = false
      document.getElementById('path-orbs')?.remove()
    }
  })
  return page
}

const ORBS: WalkthroughStep = {
  targetSelector: '#path-orbs',
  title: 'One orb, one week',
  description: 'On the Ascent only.',
  screen: ['path.ascent'],
}

describe('the page a step needs', () => {
  const removers: (() => void)[] = []

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    endWalkthrough()
    cleanup()
    for (const remove of removers.splice(0)) remove()
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  it('sets the view for the step and puts it back once the tour ends', async () => {
    const page = ascentView()
    removers.push(page.remove)
    render(() => <Walkthrough />)

    startTour([ORBS], 'path')
    await vi.advanceTimersByTimeAsync(400)

    expect(page.ascent).toBe(true)
    expect(highlight().style.display).not.toBe('none')

    endWalkthrough()
    await vi.advanceTimersByTimeAsync(0)
    expect(page.ascent).toBe(false)
    expect(document.getElementById('path-orbs')).toBeNull()
  })

  it('sets a view whose page says how only after the step began', async () => {
    render(() => <Walkthrough />)
    startTour([ORBS], 'path')
    await vi.advanceTimersByTimeAsync(100)
    expect(document.getElementById('path-orbs')).toBeNull()

    // The page's code arrives, as Path's does after the tab switch.
    const page = ascentView()
    removers.push(page.remove)
    await vi.advanceTimersByTimeAsync(400)

    expect(page.ascent).toBe(true)
    expect(highlight().style.display).not.toBe('none')
  })

  it('shuts a group an earlier step opened when the next does not name it', async () => {
    const toggle = mountTarget('more-toggle', 'button')
    toggle.setAttribute('aria-expanded', 'false')
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true'
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true')
    })
    mountTarget('bpm')
    mountTarget('once')
    render(() => <Walkthrough />)

    startTour(
      [
        {
          targetSelector: '#bpm',
          title: 'BPM',
          description: 'In the more group.',
          reveal: '#more-toggle',
        },
        {
          targetSelector: '#once',
          title: 'Once',
          description: 'Not in it.',
        },
      ],
      'home',
    )
    await vi.advanceTimersByTimeAsync(600)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    setWalkthroughStep(1)
    await vi.advanceTimersByTimeAsync(600)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })
})
