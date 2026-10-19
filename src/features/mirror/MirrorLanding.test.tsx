// ============================================================
// Voice Mirror start screen: what every door opens on
// ============================================================
//
// Rendered through the whole app from each door's address, the way main.tsx
// picks the door. Every door shows its own H1 and promise, one primary action
// (the pill), and the side door to Break Glass at the foot of the page rather
// than beside the pill.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mirrorEntryIntent } from './entry-intent'
import { trackFunnel } from './funnel'
import { MirrorApp } from './MirrorApp'

vi.mock('./funnel', () => ({ trackFunnel: vi.fn() }))
// The overview's demos draw on a canvas, which jsdom does not have.
vi.mock('./TaskDemo', () => ({ TaskDemo: () => null }))

const trackFunnelMock = vi.mocked(trackFunnel)

afterEach(cleanup)

beforeEach(() => {
  trackFunnelMock.mockClear()
})

const TWIN_LEDE =
  'Sing a couple of short tasks. We find your range, name a legend of your voice type, then map your voice as a voiceprint you can share.'

/** What each address promises (src/seo/entry-pages.ts sends the ads and the
 *  search pages here), and the one thing its start screen asks for. */
const DOORS = [
  {
    path: '/mirror',
    h1: 'Meet your voice twin.',
    lede: TWIN_LEDE,
    cta: 'Find my voice twin',
    howItWorks: 'How it works',
  },
  {
    path: '/vocal-range-test',
    h1: 'Find your vocal range.',
    lede: 'Glide from your lowest comfortable note to your highest comfortable note. Your result leads with both notes, your span in semitones and a broad voice-type guide; two short follow-ups add accuracy and steadiness.',
    cta: 'Test my vocal range',
    howItWorks: 'How the test works',
  },
  {
    path: '/voice-type-test',
    h1: 'Meet your voice twin.',
    lede: TWIN_LEDE,
    cta: 'Find my voice twin',
    howItWorks: 'How it works',
  },
  {
    path: '/which-singer-has-my-vocal-range',
    h1: 'Meet your voice twin.',
    lede: TWIN_LEDE,
    cta: 'Find my voice twin',
    howItWorks: 'How it works',
  },
  {
    path: '/free-sing',
    h1: 'Just sing.',
    lede: 'Forty seconds of anything you like. Your shower song counts. No targets and no score: we measure the range you actually use, the note you keep coming back to, and how long your phrases run.',
    cta: 'Just sing · 40 s',
    howItWorks: 'How it works',
  },
] as const

function renderDoor(path: string) {
  return render(() => <MirrorApp entryIntent={mirrorEntryIntent(path)} />)
}

/** A button's accessible name: its label, or else its words. */
function buttonName(button: HTMLElement): string {
  return button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''
}

describe('Voice Mirror start screen', () => {
  it.each(DOORS)(
    '$path opens on its own H1, its promise and one primary action',
    ({ path, h1, lede, cta, howItWorks }) => {
      const { container } = renderDoor(path)

      expect(
        screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent),
      ).toEqual([h1])
      expect(
        Array.from(container.querySelectorAll('.mirror-lede'), (p) =>
          p.textContent?.trim(),
        ),
      ).toEqual([lede])

      // One pill on the page, and it is the door's own action.
      const pills = container.querySelectorAll('.mirror-pill')
      expect(Array.from(pills, (pill) => pill.textContent?.trim())).toEqual([
        cta,
      ])

      // Beside it only the privacy "i" and the quiet "How it works".
      const landing = container.querySelector<HTMLElement>('.mirror-landing')
      expect(landing).not.toBeNull()
      expect(
        within(landing as HTMLElement)
          .getAllByRole('button')
          .map(buttonName),
      ).toEqual(['Privacy: how your audio is handled', cta, howItWorks])

      // The page view still lands on mount, and nothing else does.
      expect(trackFunnelMock.mock.calls.map(([event]) => event)).toEqual([
        'mirror_view',
      ])
    },
  )

  it('keeps Break Glass as a side door at the foot, above the legal row', () => {
    const { container } = renderDoor('/vocal-range-test')

    const link = screen.getByRole('link', {
      name: 'Break glass with your voice',
    })
    expect(link.getAttribute('href')).toBe('/glass')
    // Not in the screen's own column, where it competed with the pill.
    expect(link.closest('.mirror-landing')).toBeNull()

    // The shell's order: the screen, the side door, then the legal row.
    const shell = container.querySelector('.mirror-shell')
    const sideDoor = link.closest('.mirror-sidedoor')
    const legal = screen.getByRole('navigation', { name: 'Legal' })
    expect(shell?.lastElementChild).toBe(legal)
    expect(legal.previousElementSibling).toBe(sideDoor)
    expect(sideDoor?.previousElementSibling).toBe(
      container.querySelector('.mirror-landing'),
    )

    // Its click is still counted. (jsdom cannot navigate, so the visit to
    // /glass is cancelled here; the counting runs either way.)
    link.addEventListener('click', (event) => event.preventDefault())
    fireEvent.click(link)
    expect(trackFunnelMock.mock.calls.map(([event]) => event)).toEqual([
      'mirror_view',
      'cta_glass_click',
    ])
  })

  it("puts Merc's sky behind the start screen and the plain sky behind the overview", () => {
    const { container } = renderDoor('/vocal-range-test')

    const shell = container.querySelector('.mirror-shell')
    const plate = (): string | null | undefined =>
      document.querySelector('.mirror-plate')?.getAttribute('data-plate')

    expect(shell?.getAttribute('data-screen')).toBe('landing')
    expect(plate()).toBe('sky')

    fireEvent.click(screen.getByRole('button', { name: 'How the test works' }))

    expect(shell?.getAttribute('data-screen')).toBe('flow')
    expect(plate()).toBe('plain')
    expect(container.querySelector('.mirror-landing')).toBeNull()
    expect(trackFunnelMock.mock.calls.map(([event]) => event)).toEqual([
      'mirror_view',
      'howto_view',
    ])
  })

  it('keeps the picture out of the accessibility tree', () => {
    renderDoor('/mirror')

    expect(
      document.querySelector('.mirror-backdrop')?.getAttribute('aria-hidden'),
    ).toBe('true')
  })
})
