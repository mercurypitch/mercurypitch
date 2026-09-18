// ============================================================
// The spotlight holds its place while the next step prepares
// ============================================================
//
// Advancing a tour blanked the spotlight for as long as the next step needed
// to get its target on screen — a tab switch, a revealed group, a scroll.
// The window-listener effect called `reposition()` inside a tracked scope, so
// every step change re-ran it synchronously, measured a target that was not
// there yet, hid the highlight and parked the tooltip in the middle of the
// screen. Preparation then found the target 50-300ms later and flew both back,
// which reads as a flicker on every Next.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Walkthrough } from '@/components/Walkthrough'
import type { WalkthroughStep } from '@/stores/app-store'
import { endWalkthrough, setWalkthroughStep, startTour, } from '@/stores/app-store'

const STEPS: WalkthroughStep[] = [
  {
    targetSelector: '#tour-here',
    title: 'Here',
    description: 'On screen already.',
  },
  {
    targetSelector: '#tour-later',
    title: 'Later',
    description: 'Arrives once the step prepares it.',
  },
]

function mountTarget(id: string): HTMLElement {
  const el = document.createElement('div')
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

describe('the spotlight while a step prepares', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    endWalkthrough()
    cleanup()
    vi.useRealTimers()
    document.querySelectorAll('#tour-here, #tour-later').forEach((el) => {
      el.remove()
    })
  })

  it('holds the last target while the next step is still being prepared', async () => {
    mountTarget('tour-here')
    startTour(STEPS)
    render(() => <Walkthrough />)
    await vi.advanceTimersByTimeAsync(200)
    expect(highlight().style.display).not.toBe('none')

    // Next, to a step whose target has not been rendered yet.
    setWalkthroughStep(1)

    // The spotlight must stay where it was rather than blink out and back.
    expect(highlight().style.display).not.toBe('none')

    mountTarget('tour-later')
    await vi.advanceTimersByTimeAsync(200)
    expect(highlight().style.display).not.toBe('none')
  })

  it('gives up and hides once preparation has run out of patience', async () => {
    mountTarget('tour-here')
    startTour(STEPS)
    render(() => <Walkthrough />)
    await vi.advanceTimersByTimeAsync(200)

    setWalkthroughStep(1)
    // The whole retry budget is twenty attempts at 50ms; nothing ever appears.
    await vi.advanceTimersByTimeAsync(1500)

    expect(highlight().style.display).toBe('none')
  })
})
