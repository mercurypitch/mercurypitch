import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { DestinationGallery, HOME_DESTINATIONS, } from '@/features/home/DestinationGallery'
import { TAB_ANALYSIS, TAB_EXERCISES, TAB_HOME, TAB_SINGING, } from '@/features/tabs/constants'
import { activeTab, setActiveTab } from '@/stores/ui-store'

afterEach(() => {
  cleanup()
  setActiveTab(TAB_HOME)
})

describe('Home destination gallery', () => {
  it('maps the four covers to the canonical app destinations', () => {
    expect(HOME_DESTINATIONS.map((destination) => destination.target)).toEqual([
      { kind: 'tab', tab: TAB_SINGING },
      { kind: 'page', href: '/karaoke' },
      { kind: 'tab', tab: TAB_EXERCISES },
      { kind: 'tab', tab: TAB_ANALYSIS },
    ])
  })

  it('renders accessible covers with the standalone Karaoke destination', () => {
    const { container } = render(() => <DestinationGallery />)
    const covers = [
      ...container.querySelectorAll<HTMLElement>('[data-destination]'),
    ]

    expect(covers).toHaveLength(4)

    for (let index = 0; index < covers.length; index++) {
      const cover = covers[index]!
      expect(cover.getAttribute('aria-label')).toContain(
        HOME_DESTINATIONS[index]!.title,
      )

      const target = HOME_DESTINATIONS[index]!.target
      if (target.kind === 'page') {
        expect(cover.tagName).toBe('A')
        expect(cover.getAttribute('href')).toBe('/karaoke')
      } else {
        expect(cover.tagName).toBe('BUTTON')
        fireEvent.click(cover)
        expect(activeTab()).toBe(target.tab)
      }
    }
  })
})
