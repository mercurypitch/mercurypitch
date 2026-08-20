import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { DestinationGallery, HOME_DESTINATIONS, } from '@/features/home/DestinationGallery'
import { TAB_ANALYSIS, TAB_EXERCISES, TAB_HOME, TAB_JAM, TAB_SINGING, } from '@/features/tabs/constants'
import { BACKGROUND_CATALOG } from '@/lib/backgrounds/background-catalog'
import { activeTab, setActiveTab } from '@/stores/ui-store'

/**
 * Every picture the app already gives away: the free half of the background
 * catalogue, which now includes the Guitar Night rooms that used to live in
 * their own module. Derived rather than listed, so a cover that later points
 * at a supporter picture fails here instead of shipping one.
 */
const FREE_IMAGE_SOURCES = new Set<string>([
  ...BACKGROUND_CATALOG.filter(
    (background) =>
      background.access.kind === 'free' &&
      background.assetSource.kind === 'public',
  ).flatMap((background) =>
    background.assetSource.kind === 'public'
      ? [
          background.assetSource.landscape,
          background.assetSource.landscape2x,
          background.assetSource.portrait,
          background.assetSource.portrait2x,
        ].filter((source): source is string => source !== undefined)
      : [],
  ),
])

afterEach(() => {
  cleanup()
  setActiveTab(TAB_HOME)
})

describe('Home destination gallery', () => {
  it('maps the covers to the canonical app destinations', () => {
    expect(HOME_DESTINATIONS.map((destination) => destination.target)).toEqual([
      { kind: 'tab', tab: TAB_SINGING },
      { kind: 'page', href: '/karaoke' },
      { kind: 'page', href: '/piano-night' },
      { kind: 'page', href: '/guitar-night' },
      { kind: 'page', href: '/drum-night' },
      { kind: 'tab', tab: TAB_EXERCISES },
      { kind: 'tab', tab: TAB_ANALYSIS },
      { kind: 'tab', tab: TAB_JAM },
    ])
  })

  it('keeps photographic night-room covers on free catalogue assets', () => {
    const { container } = render(() => <DestinationGallery />)
    const sources = [...container.querySelectorAll('img')].map(
      (image) => image.getAttribute('src') ?? '',
    )

    // Piano and Guitar ship these as free backdrops inside their own rooms.
    // Drum Night deliberately uses code-native art until `drum` becomes a
    // first-class background-catalog surface.
    expect(sources).toContain('/piano-night/afterglow-studio-landscape.webp')
    expect(sources).toContain('/guitar-night/velvet-rehearsal.webp')
    for (const source of sources) {
      expect([...FREE_IMAGE_SOURCES]).toContain(source)
    }
    expect(
      container.querySelector('[data-destination="drumNight"] svg'),
    ).not.toBeNull()
  })

  it('labels Drum Night as a visual pilot until its real runtime is connected', () => {
    const drumNight = HOME_DESTINATIONS.find(
      (destination) => destination.visual === 'drumNight',
    )

    expect(drumNight).toMatchObject({
      eyebrow: 'Visual pilot',
      action: 'Preview Drum Night',
    })
    expect(drumNight?.description).toContain('still being built')
  })

  it('admits the tap while a room is still opening', () => {
    const { container } = render(() => <DestinationGallery />)
    const cover = container.querySelector<HTMLElement>(
      '[data-destination="guitarNight"]',
    )!

    expect(cover.getAttribute('aria-busy')).toBeNull()
    fireEvent.click(cover)

    // A separate document: several seconds on a slow connection during which
    // the page it was tapped from does not change at all.
    expect(cover.getAttribute('aria-busy')).toBe('true')
    expect(cover.querySelector('[data-testid="spinner"]')).not.toBeNull()
  })

  it('renders accessible covers, each pointing where its label says', () => {
    const { container } = render(() => <DestinationGallery />)
    const covers = [
      ...container.querySelectorAll<HTMLElement>('[data-destination]'),
    ]

    // Every navigable destination plus the veiled coming-soon teaser.
    expect(covers).toHaveLength(HOME_DESTINATIONS.length + 1)

    for (let index = 0; index < HOME_DESTINATIONS.length; index++) {
      const cover = covers[index]!
      expect(cover.getAttribute('aria-label')).toContain(
        HOME_DESTINATIONS[index]!.title,
      )

      const target = HOME_DESTINATIONS[index]!.target
      if (target.kind === 'page') {
        expect(cover.tagName).toBe('A')
        expect(cover.getAttribute('href')).toBe(target.href)
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
