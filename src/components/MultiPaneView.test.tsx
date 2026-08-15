// ============================================================
// MultiPaneView interaction tests — menus, splitters, and canvas summaries
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MultiPaneView } from './MultiPaneView'

const paneStore = vi.hoisted(() => ({
  addPane: vi.fn(),
  removePane: vi.fn(),
  setPaneHeights: vi.fn(),
  togglePaneCollapse: vi.fn(),
  toggleSyncTime: vi.fn(),
}))

vi.mock('@/stores/pane-layout-store', () => ({
  addPane: paneStore.addPane,
  paneLayout: () => ({
    panes: [
      {
        id: 'spec',
        layerType: 'spectrogram',
        height: 60,
        collapsed: false,
      },
      {
        id: 'pitch',
        layerType: 'pitch-trace',
        height: 40,
        collapsed: false,
      },
    ],
    syncTime: true,
    syncZoom: true,
    activePaneId: 'spec',
  }),
  removePane: paneStore.removePane,
  setPaneHeights: paneStore.setPaneHeights,
  togglePaneCollapse: paneStore.togglePaneCollapse,
  toggleSyncTime: paneStore.toggleSyncTime,
}))

vi.mock('./panes/SpectrogramPane', () => ({
  SpectrogramPane: () => <canvas aria-hidden="true" />,
}))
vi.mock('./panes/PitchTracePane', () => ({
  PitchTracePane: () => <canvas aria-hidden="true" />,
}))
vi.mock('./panes/CentsDeviationPane', () => ({
  CentsDeviationPane: () => <canvas aria-hidden="true" />,
}))
vi.mock('./panes/SpectrumPane', () => ({
  SpectrumPane: () => <canvas aria-hidden="true" />,
}))
vi.mock('./panes/WaveformPane', () => ({
  WaveformPane: () => <canvas aria-hidden="true" />,
}))
vi.mock('./VibratoWaveformCanvas', () => ({
  VibratoWaveformCanvas: () => <canvas aria-hidden="true" />,
}))

function renderView() {
  return render(() => (
    <MultiPaneView
      audioDuration={60}
      playheadPosition={4}
      isPlaying={false}
      magnitudeSpectrum={new Float32Array(256)}
      pitchHistory={[
        { time: 1, midi: 69 },
        { time: 2, midi: 70 },
      ]}
      centsOffset={8}
      targetNote="A4"
      sampleRate={44100}
    />
  ))
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => cleanup())

describe('MultiPaneView', () => {
  it('opens a keyboard menu, closes on Escape, and returns focus', async () => {
    renderView()
    const trigger = screen.getByRole('button', { name: 'Add Pane' })

    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await Promise.resolve()

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: 'Pane types' })).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    await Promise.resolve()

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes the pane menu when focus moves to an outside pointer target', () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Add Pane' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('resizes adjacent panes from the keyboard without changing their total', () => {
    renderView()
    const separator = screen.getByRole('separator', {
      name: 'Resize Spectrogram and Pitch Trace panes',
    })

    expect(separator).toHaveAttribute('tabindex', '0')
    expect(separator).toHaveAttribute('aria-valuemin', '8')
    expect(separator).toHaveAttribute('aria-valuemax', '92')
    expect(separator).toHaveAttribute('aria-valuenow', '60')

    fireEvent.keyDown(separator, { key: 'ArrowDown' })

    expect(paneStore.setPaneHeights).toHaveBeenCalledTimes(1)
    const heights = paneStore.setPaneHeights.mock.calls[0][0] as Map<
      string,
      number
    >
    expect(heights.get('spec')).toBe(62)
    expect(heights.get('pitch')).toBe(38)
  })

  it('provides text equivalents for canvas-only readings', () => {
    renderView()

    const pitchPane = screen.getByRole('group', {
      name: 'Pitch Trace visualisation',
    })
    const summaryId = pitchPane.getAttribute('aria-describedby')

    expect(summaryId).not.toBeNull()
    expect(document.getElementById(summaryId!)).toHaveTextContent(
      'Pitch trace contains 2 measured points.',
    )
  })
})
