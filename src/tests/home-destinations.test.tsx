import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { DestinationGallery, HOME_DESTINATIONS, } from '@/features/home/DestinationGallery'
import { TAB_ANALYSIS, TAB_EXERCISES, TAB_HOME, TAB_JAM, TAB_SINGING, } from '@/features/tabs/constants'
import { activeTab, setActiveTab } from '@/stores/ui-store'

afterEach(() => {
  cleanup()
  setActiveTab(TAB_HOME)
})

describe('Home destination gallery', () => {
  it('maps the five covers to the canonical app destinations', () => {
    expect(HOME_DESTINATIONS.map((destination) => destination.target)).toEqual([
      { kind: 'tab', tab: TAB_SINGING },
      { kind: 'page', href: '/karaoke' },
      { kind: 'tab', tab: TAB_EXERCISES },
      { kind: 'tab', tab: TAB_ANALYSIS },
      { kind: 'tab', tab: TAB_JAM },
    ])
  })

  it('renders accessible covers with the standalone Karaoke destination', () => {
    const { container } = render(() => <DestinationGallery />)
    const covers = [
      ...container.querySelectorAll<HTMLElement>('[data-destination]'),
    ]

    // Five navigable destinations plus the veiled coming-soon teaser.
    expect(covers).toHaveLength(HOME_DESTINATIONS.length + 1)

    for (let index = 0; index < HOME_DESTINATIONS.length; index++) {
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

  it('keeps the teaser un-navigable and toggles its reveal on tap', () => {
    const { container } = render(() => <DestinationGallery />)
    const teaser = container.querySelector<HTMLElement>(
      '[data-destination="mystery"]',
    )!

    expect(teaser.tagName).toBe('BUTTON')
    expect(teaser.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(teaser)
    expect(teaser.getAttribute('aria-expanded')).toBe('true')
    expect(activeTab()).toBe(TAB_HOME)

    fireEvent.click(teaser)
    expect(teaser.getAttribute('aria-expanded')).toBe('false')
  })
})
