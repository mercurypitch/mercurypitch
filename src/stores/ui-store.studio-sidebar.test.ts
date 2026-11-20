// Studio sidebar choice tests — collapsed on a first visit, the person's expand remembered across loads, storage that throws ignored, and a tour's hold never written down.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'sidebar-studio-rail-open'

/** A fresh load of the store, as a reload gives. */
async function load() {
  vi.resetModules()
  return import('./ui-store')
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('Studio sidebar choice', () => {
  it('starts collapsed on a first visit', async () => {
    const ui = await load()
    expect(ui.STUDIO_SIDEBAR_KEY).toBe(KEY)
    expect(ui.studioSidebarExpanded()).toBe(false)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('remembers the person expanding it across a reload, and collapsing it again', async () => {
    let ui = await load()
    ui.setStudioSidebarExpanded((expanded) => !expanded)
    expect(ui.studioSidebarExpanded()).toBe(true)
    expect(localStorage.getItem(KEY)).toBe('true')

    ui = await load()
    expect(ui.studioSidebarExpanded()).toBe(true)

    ui.setStudioSidebarExpanded(false)
    ui = await load()
    expect(ui.studioSidebarExpanded()).toBe(false)
  })

  it('reads anything but a stored true or false as collapsed', async () => {
    localStorage.setItem(KEY, '"open"')
    expect((await load()).studioSidebarExpanded()).toBe(false)
    localStorage.setItem(KEY, '')
    expect((await load()).studioSidebarExpanded()).toBe(false)
  })

  it('falls back to collapsed when storage throws, and still follows the person in this load', async () => {
    localStorage.setItem(KEY, 'true')
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const ui = await load()
    expect(ui.studioSidebarExpanded()).toBe(false)

    expect(() => ui.setStudioSidebarExpanded(true)).not.toThrow()
    expect(ui.studioSidebarExpanded()).toBe(true)
  })
})

describe('Studio sidebar under a tour', () => {
  it('opens a collapsed sidebar for the step without writing it down, and gives it back collapsed', async () => {
    const ui = await load()

    expect(ui.revealStudioSidebarForTour()).toBe(true)
    expect(ui.studioSidebarExpanded()).toBe(true)
    expect(localStorage.getItem(KEY)).toBeNull()

    ui.releaseStudioSidebarFromTour()
    expect(ui.studioSidebarExpanded()).toBe(false)
    expect((await load()).studioSidebarExpanded()).toBe(false)
  })

  it('leaves a sidebar the person opened open, during the tour and after it', async () => {
    const ui = await load()
    ui.setStudioSidebarExpanded(true)

    expect(ui.revealStudioSidebarForTour()).toBe(false)
    expect(ui.studioSidebarExpanded()).toBe(true)

    ui.releaseStudioSidebarFromTour()
    expect(ui.studioSidebarExpanded()).toBe(true)
    expect(localStorage.getItem(KEY)).toBe('true')
  })

  it('takes the person’s own toggle during a tour as their choice', async () => {
    const ui = await load()
    ui.revealStudioSidebarForTour()

    ui.setStudioSidebarExpanded((expanded) => !expanded)
    expect(ui.studioSidebarExpanded()).toBe(false)
    expect(localStorage.getItem(KEY)).toBe('false')

    ui.releaseStudioSidebarFromTour()
    expect(ui.studioSidebarExpanded()).toBe(false)
  })
})
