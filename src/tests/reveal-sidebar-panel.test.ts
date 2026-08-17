// ============================================================
// Advice points at the control, instead of navigating away from it
// ============================================================
//
// The noisy-room toast worked, but taking its advice meant leaving the screen:
// "not sure if we could link it to sidebar setting given user is on a page
// where that settings would be seen in sidebar, that way he doesn't have to go
// out of the view, especially on mobile."

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PANEL_FLASH_CLASS, PANEL_FLASH_MS, revealSidebarPanel, } from '@/features/sidebar/reveal-panel'

function mountPanel(displayed: boolean): HTMLElement {
  const panel = document.createElement('div')
  panel.setAttribute('data-sidebar-panel', 'mic')
  panel.scrollIntoView = vi.fn()
  document.body.append(panel)
  panel.getBoundingClientRect = (() =>
    displayed
      ? { width: 240, height: 180 }
      : {
          width: 0,
          height: 0,
        }) as unknown as HTMLElement['getBoundingClientRect']
  return panel
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('revealing a sidebar panel', () => {
  it('scrolls to the panel and flashes it when it is already on screen', () => {
    const panel = mountPanel(true)
    const timers: Array<{ fn: () => void; ms: number }> = []

    const revealed = revealSidebarPanel('mic', {
      schedule: (fn, ms) => timers.push({ fn, ms }),
    })

    expect(revealed).toBe(true)
    expect(panel.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    })
    expect(panel.classList.contains(PANEL_FLASH_CLASS)).toBe(true)

    expect(timers[0]?.ms).toBe(PANEL_FLASH_MS)
    timers[0]?.fn()
    expect(panel.classList.contains(PANEL_FLASH_CLASS)).toBe(false)
  })

  it('opens the drawer first when the panel is there but not laid out', () => {
    // A phone: the panel exists in the DOM behind a closed drawer. That is
    // "closed", not "absent", and opening it is still cheaper than a tab change.
    const panel = mountPanel(false)
    const opened: boolean[] = []
    const frames: Array<() => void> = []

    const revealed = revealSidebarPanel('mic', {
      openSidebar: (open) => opened.push(open),
      nextFrame: (fn) => frames.push(fn),
      schedule: () => undefined,
    })

    expect(revealed).toBe(true)
    expect(opened).toEqual([true])
    // Nothing highlighted until the drawer has had a frame to lay out.
    expect(panel.scrollIntoView).not.toHaveBeenCalled()

    frames[0]?.()
    expect(panel.scrollIntoView).toHaveBeenCalled()
    expect(panel.classList.contains(PANEL_FLASH_CLASS)).toBe(true)
  })

  it('reports failure when the panel is not on the page at all', () => {
    // The caller's signal to fall back to the full Settings page.
    expect(revealSidebarPanel('mic', { schedule: () => undefined })).toBe(false)
  })
})
