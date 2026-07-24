import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { DestinationGallery, HOME_DESTINATIONS, } from '@/features/home/DestinationGallery'
import { TAB_ANALYSIS, TAB_EXERCISES, TAB_HOME, TAB_KARAOKE, TAB_SINGING, } from '@/features/tabs/constants'
import { activeTab, setActiveTab } from '@/stores/ui-store'

afterEach(() => {
  cleanup()
  setActiveTab(TAB_HOME)
})

describe('Home destination gallery', () => {
  it('maps the four covers to the canonical app destinations', () => {
    expect(HOME_DESTINATIONS.map((destination) => destination.tab)).toEqual([
      TAB_SINGING,
      TAB_KARAOKE,
      TAB_EXERCISES,
      TAB_ANALYSIS,
    ])
  })

  it('renders four accessible navigation covers and activates their tabs', () => {
    const { container } = render(() => <DestinationGallery />)
    const covers = [
      ...container.querySelectorAll<HTMLButtonElement>('[data-destination]'),
    ]

    expect(covers).toHaveLength(4)

    for (let index = 0; index < covers.length; index++) {
      const cover = covers[index]!
      expect(cover.getAttribute('aria-label')).toContain(
        HOME_DESTINATIONS[index]!.title,
      )
      fireEvent.click(cover)
      expect(activeTab()).toBe(HOME_DESTINATIONS[index]!.tab)
    }
  })
})
