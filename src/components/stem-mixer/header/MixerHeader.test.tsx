// The mixer header: every control named and in tab order, the view controls
// folding into one View menu as it narrows, the Stage popover with the
// stage's transparency, the Layout menu the tour opens, and Open in Karaoke
// Night: a link to the song at the playhead, or a wait that says why.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MixerLayout, MixerViewControlsProps, } from '@/components/stem-mixer/MixerViewControls'
import type { BackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { KN_SEPARATING } from './karaoke-night'
import type { MixerHeaderKaraokeNight, MixerHeaderPlaylist, MixerHeaderProps, } from './MixerHeader'
import { MixerHeader } from './MixerHeader'

const viewport = vi.hoisted(() => ({ coarse: false }))

vi.mock('@/lib/use-viewport', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isCoarsePointer: () => viewport.coarse,
}))

type Resize = (entries: { contentRect: { width: number } }[]) => void

/** The header's ResizeObserver, driven by hand: jsdom has no layout. */
function stubResizeObserver(): { resize: (width: number) => void } {
  const callbacks: Resize[] = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: Resize) {
        callbacks.push(callback)
      }
      observe() {}
      disconnect() {}
    },
  )
  return {
    resize: (width) => {
      for (const callback of callbacks) callback([{ contentRect: { width } }])
    },
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  viewport.coarse = false
})

function background(): BackgroundSurfaceController {
  return {
    surface: 'karaoke',
    requestedId: () => 'karaoke-theatre',
    resolved: () => ({
      id: 'karaoke-theatre',
      url: '/karaoke-night-stage.webp',
      focalPoint: { x: 0.5, y: 0.5 },
      treatment: 'dark',
      source: 'public',
      version: null,
      variant: null,
    }),
    resolvedStyle: () => ({
      '--mp-stage-image': 'url("/karaoke-night-stage.webp")',
      '--mp-stage-position-x': '50%',
      '--mp-stage-position-y': '50%',
      '--mp-stage-position': '50% 50%',
    }),
    options: () => [
      {
        id: 'karaoke-theatre',
        surface: 'karaoke',
        label: 'Mercury Theatre',
        description: 'Included stage',
        edition: 'core',
        focalPoint: { x: 0.5, y: 0.5 },
        treatment: 'dark',
        access: 'free',
        publicUrl: '/karaoke-night-stage.webp',
        premiumAsset: null,
      },
    ],
    loading: () => false,
    error: () => null,
    select: vi.fn(() => true),
    refresh: async () => undefined,
    invalidateAccess: vi.fn(),
    retain: () => vi.fn(),
    dispose: vi.fn(),
  }
}

function viewState(initial: MixerLayout) {
  const [layout, setLayout] = createSignal<MixerLayout>(initial)
  const [hidden, setHidden] = createSignal(false)
  const view: MixerViewControlsProps = {
    get layout() {
      return layout()
    },
    onLayoutChange: vi.fn(setLayout),
    get sidebarHidden() {
      return hidden()
    },
    onToggleSidebar: vi.fn(() => setHidden((was) => !was)),
  }
  return view
}

function mount(overrides: Partial<MixerHeaderProps> = {}) {
  const [reason, setReason] = createSignal<string | null>(null)
  const night: MixerHeaderKaraokeNight = {
    href: '/karaoke-night?session=song-b',
    hrefNow: vi.fn(() => '/karaoke-night?session=song-b&t=83.2'),
    get reason() {
      return reason()
    },
    onLeave: vi.fn(),
  }
  const onTransparency = vi.fn()
  const props: MixerHeaderProps = {
    title: 'Harbor Lights',
    onBack: vi.fn(),
    songsOpen: false,
    onToggleSongs: vi.fn(),
    pitchOpen: false,
    onTogglePitch: vi.fn(),
    stage: {
      background: background(),
      transparency: {
        value: 0.57,
        min: 0.2,
        max: 0.9,
        step: 0.01,
        fillPercent: 53,
        onInput: onTransparency,
      },
    },
    view: viewState('fixed-2col'),
    onZen: vi.fn(),
    onFocus: vi.fn(),
    karaokeNight: night,
    onTour: vi.fn(),
    ...overrides,
  }
  render(() => <MixerHeader {...props} />)
  return { props, night, setReason, onTransparency }
}

const names = () =>
  screen.getByTestId('mixer-header').querySelectorAll('button, a')
const nameOf = (el: Element) =>
  el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''

describe('MixerHeader', () => {
  it('names every control, in the order Tab reaches them', () => {
    mount()

    expect(Array.from(names()).map(nameOf)).toEqual([
      'Back to the song list',
      'Songs',
      'Pitch',
      'Stage',
      'Layout',
      'Mixer sidebar',
      'Zen',
      'Focus mode',
      'Open in Karaoke Night',
      'Tour',
    ])
    expect(screen.getByRole('heading', { name: 'Harbor Lights' })).toBeVisible()
  })

  it('says which panel is open on Songs and Pitch', () => {
    mount({ songsOpen: true })

    expect(screen.getByRole('button', { name: 'Songs' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Pitch' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('shows the sidebar toggle only in the layout that has a sidebar', () => {
    const view = viewState('fixed-2col')
    mount({ view })
    expect(
      screen.getByRole('button', { name: 'Mixer sidebar' }),
    ).toHaveAttribute('aria-pressed', 'true')

    view.onLayoutChange('auto-1col')

    expect(screen.queryByRole('button', { name: 'Mixer sidebar' })).toBeNull()
  })

  it('switches the layout from its menu, which the tour opens by its hook', () => {
    const view = viewState('auto-1col')
    mount({ view })
    const trigger = screen.getByRole('button', { name: 'Layout' })
    expect(trigger).toHaveAttribute('data-tour', 'mixer.layout')

    fireEvent.click(trigger)
    const fixed = screen.getByRole('menuitemradio', {
      name: 'Two columns fixed',
    })
    expect(fixed).toHaveAttribute('data-tour', 'mixer.layout-fixed')
    fireEvent.click(fixed)

    expect(view.onLayoutChange).toHaveBeenCalledWith('fixed-2col')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens the Stage popover with the backdrops and the transparency', () => {
    const { onTransparency } = mount()
    const stage = screen.getByRole('button', { name: 'Stage' })

    fireEvent.click(stage)

    const panel = screen.getByRole('dialog', { name: 'Stage' })
    expect(stage).toHaveAttribute('aria-expanded', 'true')
    expect(within(panel).getByText('Mercury Theatre')).toBeInTheDocument()
    const slider = within(panel).getByRole('slider', {
      name: 'Stage transparency',
    })
    fireEvent.input(slider, { target: { value: '0.7' } })
    expect(onTransparency).toHaveBeenCalledWith(0.7)

    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Stage' })).toBeNull()
    expect(stage).toHaveFocus()
  })

  it('leaves the transparency out where the stage has none', () => {
    mount({ stage: { background: background() } })

    fireEvent.click(screen.getByRole('button', { name: 'Stage' }))

    expect(
      within(screen.getByRole('dialog', { name: 'Stage' })).queryByRole(
        'slider',
      ),
    ).toBeNull()
  })

  it('has no Stage, Karaoke Night or Tour where the host leaves them out', () => {
    mount({ stage: undefined, karaokeNight: undefined, onTour: undefined })

    expect(screen.queryByRole('button', { name: 'Stage' })).toBeNull()
    expect(screen.queryByTestId('mixer-karaoke-night')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tour' })).toBeNull()
  })

  it('shows the playlist line, with its own previous, next and stop', () => {
    const playlist: MixerHeaderPlaylist = {
      singer: 'Maya',
      song: 'Harbor Lights',
      next: { song: 'Blue Hour', singer: 'Sam' },
      canGoBack: false,
      onPrevious: vi.fn(),
      onNext: vi.fn(),
      onStop: vi.fn(),
    }
    mount({ playlist })
    const line = screen.getByRole('group', { name: 'Playlist' })

    expect(line).toHaveTextContent('Maya')
    expect(line).toHaveTextContent('Next: Blue Hour (Sam)')
    expect(
      within(line).getByRole('button', { name: 'Previous song' }),
    ).toBeDisabled()
    fireEvent.click(
      within(line).getByRole('button', { name: 'Skip to next song' }),
    )
    fireEvent.click(within(line).getByRole('button', { name: 'Stop playlist' }))
    expect(playlist.onNext).toHaveBeenCalledTimes(1)
    expect(playlist.onStop).toHaveBeenCalledTimes(1)
  })
})

describe('Open in Karaoke Night', () => {
  const link = () => screen.getByTestId('mixer-karaoke-night')

  it('links to the song, and at a press to where the playhead is', () => {
    const { night } = mount()
    expect(link()).toHaveAttribute('href', '/karaoke-night?session=song-b')
    expect(link()).toHaveAttribute('data-tour', 'mixer.karaoke-night')

    // jsdom cannot navigate: the press is stopped once the header has had
    // it, and what the header did to it is read there.
    let preventedByHeader: boolean | null = null
    const stop = (event: Event) => {
      preventedByHeader = event.defaultPrevented
      event.preventDefault()
    }
    document.addEventListener('click', stop)
    fireEvent.click(link())
    document.removeEventListener('click', stop)

    expect(night.hrefNow).toHaveBeenCalledTimes(1)
    expect(link().getAttribute('href')).toBe(
      '/karaoke-night?session=song-b&t=83.2',
    )
    expect(night.onLeave).toHaveBeenCalledTimes(1)
    expect(preventedByHeader).toBe(false)
  })

  it('waits while leaving would stop something, and says what', () => {
    const { night, setReason } = mount()
    setReason(KN_SEPARATING)

    expect(link()).toHaveAttribute('aria-disabled', 'true')
    expect(link()).not.toHaveAttribute('href')
    expect(link()).toHaveAttribute('role', 'link')
    expect(link()).toHaveAccessibleDescription(KN_SEPARATING)
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    link().dispatchEvent(click)

    expect(click.defaultPrevented).toBe(true)
    expect(night.onLeave).not.toHaveBeenCalled()
    expect(link().parentElement).toHaveAttribute('data-hint', 'on')

    setReason(null)
    expect(link()).toHaveAttribute('href', '/karaoke-night?session=song-b')
    expect(link()).not.toHaveAttribute('aria-disabled')
  })

  it('says why from the keyboard too', () => {
    const { setReason } = mount()
    setReason(KN_SEPARATING)
    link().focus()

    expect(link().parentElement).toHaveAttribute('data-hint', 'on')
    fireEvent.keyDown(link(), { key: 'Enter' })
    expect(link().parentElement).toHaveAttribute('data-hint', 'on')
  })
})

describe('MixerHeader, short of room', () => {
  const foldedAway = ['Stage', 'Layout', 'Mixer sidebar', 'Tour']

  it('folds Stage, Layout, the sidebar and Tour into View under 600 px', () => {
    const { resize } = stubResizeObserver()
    mount()
    resize(640)
    for (const name of foldedAway)
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View' })).toBeNull()

    resize(590)

    for (const name of foldedAway)
      expect(screen.queryByRole('button', { name })).toBeNull()
    expect(screen.getByTestId('mixer-header')).toHaveAttribute(
      'data-folded',
      'true',
    )
    const viewMenu = screen.getByRole('button', { name: 'View' })
    expect(viewMenu).toHaveAttribute('data-tour', 'mixer.layout')
    expect(link()).toBeInTheDocument()
    fireEvent.click(viewMenu)
    expect(
      Array.from(
        screen.getByRole('menu').querySelectorAll('[role^="menuitem"]'),
      ).map((row) => row.textContent?.trim()),
    ).toEqual([
      'Stage backdrop and transparency',
      'Single column',
      'Two columns auto',
      'Two columns fixed',
      'Performance: big centered lyrics',
      'Mixer sidebar',
      'Take the mixer tour',
    ])
  })

  it('opens the Stage popover from the View menu', () => {
    const { resize } = stubResizeObserver()
    mount()
    resize(500)
    fireEvent.click(screen.getByRole('button', { name: 'View' }))

    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Stage backdrop and transparency' }),
    )

    expect(screen.getByRole('dialog', { name: 'Stage' })).toBeInTheDocument()
  })

  it('folds under 1000 px on a touch screen', () => {
    viewport.coarse = true
    const { resize } = stubResizeObserver()
    mount()

    resize(990)

    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument()
    resize(1000)
    expect(screen.queryByRole('button', { name: 'View' })).toBeNull()
  })

  function link() {
    return screen.getByTestId('mixer-karaoke-night')
  }
})
