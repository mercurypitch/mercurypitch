// ============================================================
// Every Stem Mixer transport control has an accessible name. The buttons are
// icon-only; a screen reader that lands on "button" nine times in a row has
// been told nothing (UX-32). The key chip sits right after the speed chip,
// and in karaoke focus the stage toggles live in More.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KeyShiftBinding } from '@/components/key-shift/KeyShiftControl'
import type { MixerLayout, MixerViewControlsProps, } from '@/components/stem-mixer/MixerViewControls'
import type { StemMixerTransportProps } from '@/components/StemMixerTransport'
import { StemMixerTransport } from '@/components/StemMixerTransport'

/** The header's view controls, live, as the layout controller hands them. */
function viewState(initial: MixerLayout) {
  const [layout, setLayout] = createSignal<MixerLayout>(initial)
  const [sidebarHidden, setSidebarHidden] = createSignal(false)
  const onLayoutChange = vi.fn(setLayout)
  const onToggleSidebar = vi.fn(() => setSidebarHidden((was) => !was))
  const controls: MixerViewControlsProps = {
    get layout() {
      return layout()
    },
    onLayoutChange,
    get sidebarHidden() {
      return sidebarHidden()
    },
    onToggleSidebar,
  }
  return { controls, onLayoutChange, onToggleSidebar }
}

function props(
  overrides: Partial<StemMixerTransportProps> = {},
): StemMixerTransportProps {
  const [playing] = createSignal(false)
  const [karaokeFocus, setKaraokeFocus] = createSignal(false)
  const [showWaveform, setShowWaveform] = createSignal(true)
  const [showPitch, setShowPitch] = createSignal(true)
  const [showLyrics, setShowLyrics] = createSignal(true)
  const [position, setPosition] = createSignal<
    'top' | 'bottom' | 'left' | 'right'
  >('top')
  return {
    playing,
    elapsed: () => 12,
    duration: () => 180,
    onStop: vi.fn(),
    onRestart: vi.fn(),
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onSeek: vi.fn(),
    view: viewState('auto-1col').controls,
    micActive: () => false,
    micError: () => '',
    onToggleMic: vi.fn(),
    micMonitorEnabled: () => false,
    onToggleMicMonitor: vi.fn(),
    formatTime: (t) =>
      `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`,
    speed: () => 1,
    onSpeedChange: vi.fn(),
    karaokeFocus,
    setKaraokeFocus,
    toolbarPosition: position,
    setToolbarPosition: setPosition,
    showWaveform,
    setShowWaveform,
    showPitch,
    setShowPitch,
    showLyrics,
    setShowLyrics,
    loopEnabled: () => true,
    loopStart: () => 10,
    loopEnd: () => 20,
    minimumLoopGap: 0.1,
    onSetLoopA: vi.fn(),
    onSetLoopB: vi.fn(),
    onMoveLoopPoint: vi.fn(),
    onClearLoop: vi.fn(),
    onToggleLoop: vi.fn(),
    ...overrides,
  }
}

afterEach(cleanup)

const nameOf = (el: Element): string =>
  el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''

describe('StemMixerTransport accessible names', () => {
  it.each([
    ['at rest', {}],
    ['in karaoke focus', { karaokeFocus: () => true, micActive: () => true }],
  ] as const)('names every button %s', (_label, overrides) => {
    render(() => <StemMixerTransport {...props(overrides)} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(5)
    for (const button of buttons) {
      expect(
        nameOf(button),
        `button without a name: ${button.outerHTML.slice(0, 80)}`,
      ).not.toBe('')
    }
    expect(buttons.map(nameOf).slice(0, 3)).toEqual([
      'Play',
      'Stop',
      'Play from the start',
    ])
  })

  it('says Pause while playing, in the place Play was', () => {
    const [playing, setPlaying] = createSignal(false)
    render(() => <StemMixerTransport {...props({ playing })} />)
    const first = () => nameOf(screen.getAllByRole('button')[0]!)
    expect(first()).toBe('Play')

    setPlaying(true)

    expect(first()).toBe('Pause')
  })

  it('reads the timeline as a position in the song', () => {
    render(() => <StemMixerTransport {...props()} />)

    expect(
      screen.getByRole('slider', { name: 'Song position' }),
    ).toHaveAttribute('aria-valuetext', '0:12 of 3:00')
  })
})

describe('StemMixerTransport key', () => {
  it('puts the key chip right after the speed chip, when the mixer binds one', () => {
    const [value, setValue] = createSignal(0)
    const binding: KeyShiftBinding = {
      value,
      heard: value,
      onChange: setValue,
      keyLabel: () => 'G major',
      suggestion: () => null,
      onFindKey: vi.fn(),
      disabledReason: () => undefined,
    }
    render(() => <StemMixerTransport {...props({ keyControl: binding })} />)

    const chip = screen.getByTestId('key-chip')
    expect(
      screen.getByTestId('speed-chip').parentElement?.nextElementSibling,
    ).toBe(chip)
    fireEvent.click(chip)
    fireEvent.click(screen.getByRole('button', { name: 'Raise the key' }))
    expect(screen.getByTestId('key-chip-value').textContent).toBe('+1')
    expect(screen.getByTestId('key-chip-name').textContent).toBe('G major')
    expect(chip).toHaveAccessibleName('Key +1')
  })

  it('has no key chip without a binding', () => {
    render(() => <StemMixerTransport {...props()} />)

    expect(screen.queryByTestId('key-chip')).toBeNull()
  })
})

describe('StemMixerTransport in karaoke focus', () => {
  const stageRows = () =>
    Array.from(
      screen.getByRole('menu').querySelectorAll('[role="menuitemcheckbox"]'),
    ).map((row) => [row.textContent?.trim(), row.getAttribute('aria-checked')])

  it('keeps the stage toggles in More, ticked while shown', () => {
    const [showLyrics, setLyrics] = createSignal(true)
    const setShowLyrics = vi.fn(setLyrics)
    render(() => (
      <StemMixerTransport
        {...props({
          karaokeFocus: () => true,
          showLyrics,
          setShowLyrics,
        })}
      />
    ))
    const more = screen.getByRole('button', { name: 'More playback options' })
    fireEvent.click(more)
    expect(stageRows()).toEqual([
      ['Waveform', 'true'],
      ['Pitch', 'true'],
      ['Lyrics', 'true'],
    ])

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Lyrics' }))

    expect(setShowLyrics).toHaveBeenCalledTimes(1)
    fireEvent.click(more)
    expect(stageRows()).toContainEqual(['Lyrics', 'false'])
  })

  it('offers only the waveform in the performance layout', () => {
    render(() => (
      <StemMixerTransport
        {...props({
          karaokeFocus: () => true,
          view: viewState('performance').controls,
        })}
      />
    ))
    fireEvent.click(
      screen.getByRole('button', { name: 'More playback options' }),
    )

    expect(stageRows()).toEqual([['Waveform', 'true']])
  })

  it('leaves the stage toggles out of More outside focus mode', () => {
    render(() => <StemMixerTransport {...props()} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'More playback options' }),
    )

    expect(stageRows()).toEqual([])
    expect(screen.getByRole('menuitem', { name: 'Clear loop' })).toBeEnabled()
  })

  // Focus mode hides the mixer header, so More carries its view settings.
  const openMore = () =>
    fireEvent.click(
      screen.getByRole('button', { name: 'More playback options' }),
    )
  /** More's rows whose key starts with `prefix`: [label, aria-checked]. */
  const rowsKeyed = (prefix: string) =>
    Array.from(
      screen
        .getByRole('menu')
        .querySelectorAll(`[data-testid^="overflow-${prefix}"]`),
    ).map((row) => [row.textContent?.trim(), row.getAttribute('aria-checked')])

  it('docks the controls from More, ticking the edge they are on', () => {
    const [position, setPosition] = createSignal<
      'top' | 'bottom' | 'left' | 'right'
    >('bottom')
    const setToolbarPosition = vi.fn(setPosition)
    render(() => (
      <StemMixerTransport
        {...props({
          karaokeFocus: () => true,
          toolbarPosition: position,
          setToolbarPosition,
        })}
      />
    ))
    openMore()
    expect(rowsKeyed('dock-')).toEqual([
      ['Controls at the top', 'false'],
      ['Controls at the bottom', 'true'],
      ['Controls on the left', 'false'],
      ['Controls on the right', 'false'],
    ])

    fireEvent.click(
      screen.getByRole('menuitemradio', { name: 'Controls on the left' }),
    )

    expect(setToolbarPosition).toHaveBeenCalledWith('left')
    openMore()
    expect(
      screen.getByRole('menuitemradio', { name: 'Controls on the left' }),
    ).toHaveAttribute('aria-checked', 'true')
  })

  it('switches the layout from More, as the header does', () => {
    const view = viewState('auto-1col')
    render(() => (
      <StemMixerTransport
        {...props({ karaokeFocus: () => true, view: view.controls })}
      />
    ))
    openMore()
    expect(rowsKeyed('layout-')).toEqual([
      ['Single column', 'true'],
      ['Two columns auto', 'false'],
      ['Two columns fixed', 'false'],
      ['Performance: big centered lyrics', 'false'],
    ])

    fireEvent.click(
      screen.getByRole('menuitemradio', { name: 'Two columns fixed' }),
    )

    expect(view.onLayoutChange).toHaveBeenCalledWith('fixed-2col')
    openMore()
    expect(
      screen.getByRole('menuitemradio', { name: 'Two columns fixed' }),
    ).toHaveAttribute('aria-checked', 'true')
  })

  it('shows and hides the mixer sidebar from More, in the layout that has one', () => {
    const view = viewState('fixed-2col')
    render(() => (
      <StemMixerTransport
        {...props({ karaokeFocus: () => true, view: view.controls })}
      />
    ))
    openMore()
    expect(rowsKeyed('sidebar')).toEqual([['Mixer sidebar', 'true']])

    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: 'Mixer sidebar' }),
    )

    expect(view.onToggleSidebar).toHaveBeenCalledTimes(1)
    openMore()
    expect(rowsKeyed('sidebar')).toEqual([['Mixer sidebar', 'false']])
    fireEvent.click(
      screen.getByRole('menuitemradio', { name: 'Two columns auto' }),
    )
    openMore()
    expect(rowsKeyed('sidebar')).toEqual([])
  })

  it('leaves the dock, the layout and the sidebar to the header outside focus mode', () => {
    render(() => (
      <StemMixerTransport
        {...props({ view: viewState('fixed-2col').controls })}
      />
    ))
    openMore()

    expect(rowsKeyed('dock-')).toEqual([])
    expect(rowsKeyed('layout-')).toEqual([])
    expect(rowsKeyed('sidebar')).toEqual([])
  })

  it('exits focus mode from its own button', () => {
    const [focus, setFocusSignal] = createSignal(true)
    const setFocus = vi.fn(setFocusSignal)
    render(() => (
      <StemMixerTransport
        {...props({ karaokeFocus: focus, setKaraokeFocus: setFocus })}
      />
    ))

    fireEvent.click(
      screen.getByRole('button', { name: 'Exit karaoke mode (Esc)' }),
    )

    expect(setFocus).toHaveBeenCalledWith(false)
    expect(
      screen.queryByRole('button', { name: 'Exit karaoke mode (Esc)' }),
    ).toBeNull()
  })
})
