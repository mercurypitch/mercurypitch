// ============================================================
// Every Stem Mixer transport control has an accessible name. The buttons are
// icon-only; a screen reader that lands on "button" nine times in a row has
// been told nothing (UX-32).
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StemMixerTransportProps } from '@/components/StemMixerTransport'
import { StemMixerTransport } from '@/components/StemMixerTransport'
import type { WorkspaceLayout } from '@/features/stem-mixer/useStemMixerLayoutController'

function props(
  overrides: Partial<StemMixerTransportProps> = {},
): StemMixerTransportProps {
  const [playing] = createSignal(false)
  const [layout, setLayout] = createSignal<WorkspaceLayout>('auto-1col')
  const [sidebarHidden, setSidebarHidden] = createSignal(false)
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
    workspaceLayout: layout,
    setWorkspaceLayout: setLayout,
    sidebarHidden,
    setSidebarHidden,
    onQueueRedraw: vi.fn(),
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
    onSetLoopA: vi.fn(),
    onSetLoopB: vi.fn(),
    onClearLoop: vi.fn(),
    onToggleLoop: vi.fn(),
    ...overrides,
  }
}

afterEach(cleanup)

describe('StemMixerTransport accessible names', () => {
  it.each([
    ['at rest', {}],
    ['in karaoke focus', { karaokeFocus: () => true, micActive: () => true }],
  ] as const)('names every button %s', (_label, overrides) => {
    render(() => <StemMixerTransport {...props(overrides)} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(5)
    for (const button of buttons) {
      const name =
        button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''
      expect(
        name,
        `button without a name: ${button.outerHTML.slice(0, 80)}`,
      ).not.toBe('')
    }
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('says Pause while playing', () => {
    render(() => <StemMixerTransport {...props({ playing: () => true })} />)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })
})
