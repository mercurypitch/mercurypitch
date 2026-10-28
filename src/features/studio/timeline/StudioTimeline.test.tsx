// Studio timeline controls tests — visible state, native edits, silent seeking and phone scope.
import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { createSignal, untrack } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reserveStudioMemory, studioWorkingBytes, } from '@/lib/studio/memory-budget'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { applyStudioCommand } from '@/lib/studio/model/commands'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import { StudioTimeline } from './StudioTimeline'
import { StudioTrackControls } from './StudioTrackControls'

afterEach(cleanup)

describe('Studio track controls', () => {
  it('exposes mute and solo as named pressed controls and commits a native fader only on completion', () => {
    const [track, setTrack] = createSignal(
      createStudioTrack({ id: 'voice', name: 'Lead vocal', order: 0 }),
    )
    const commands = vi.fn((command: StudioCommand) => {
      const song = {
        ...createStudioProject({ id: 'song' }),
        tracks: [untrack(track)],
      }
      setTrack(applyStudioCommand(song, command, { assets: [] }).tracks[0])
      return true
    })
    render(() => (
      <StudioTrackControls
        track={track()}
        writable={true}
        onCommand={commands}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Mute Lead vocal' }))
    expect(
      screen.getByRole('button', { name: 'Unmute Lead vocal' }),
    ).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Solo Lead vocal' }))
    expect(
      screen.getByRole('button', { name: 'Solo Lead vocal' }),
    ).toHaveAttribute('aria-pressed', 'true')
    commands.mockClear()
    const volume = screen.getByRole('slider', { name: 'Lead vocal volume' })
    fireEvent.input(volume, { target: { value: '-12' } })
    expect(screen.getByText('-12.0 dB')).toBeInTheDocument()
    expect(commands).not.toHaveBeenCalled()
    fireEvent.change(volume, { target: { value: '-12' } })
    expect(commands).toHaveBeenCalledTimes(1)
    expect(untrack(track).gainDb).toBe(-12)
    fireEvent.input(volume, { target: { value: '-20' } })
    fireEvent.keyDown(volume, { key: 'Escape' })
    expect(volume).toHaveValue('-12')
    expect(commands).toHaveBeenCalledTimes(1)
  })

  it('keeps all mix controls read only without losing their saved values', () => {
    render(() => (
      <StudioTrackControls
        track={{
          ...createStudioTrack({ id: 'piano', name: 'Piano', order: 0 }),
          gainDb: -4.5,
          pan: -0.2,
        }}
        writable={false}
        onCommand={vi.fn()}
      />
    ))
    expect(screen.getByRole('button', { name: 'Mute Piano' })).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Piano volume' })).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Piano pan' })).toHaveAttribute(
      'aria-valuetext',
      '20 percent left',
    )
    expect(screen.getByText('-4.5 dB')).toBeInTheDocument()
  })
})

describe('Studio timeline', () => {
  const project = {
    ...createStudioProject({ id: 'song' }),
    tracks: [createStudioTrack({ id: 'voice', name: 'Lead vocal', order: 0 })],
    clips: [
      {
        id: 'clip',
        trackId: 'voice',
        assetId: 'missing',
        startFrame: 48000,
        sourceInFrame: 0,
        sourceOutFrame: 96000,
        gainDb: 0,
        fades: { curve: 'linear-amplitude' as const },
      },
    ],
  }
  const base = {
    project,
    assets: [],
    selectedClipId: null,
    playheadFrame: 0,
    pixelsPerSecond: 20,
    writable: true,
    phone: false,
    onSelectClip: vi.fn(),
    onSeek: vi.fn(),
    onCommand: vi.fn(() => true),
    onClipDetails: vi.fn(),
    onTrackDetails: vi.fn(),
    readCanonicalAsset: vi.fn(() => Promise.reject(new Error('Missing'))),
  }

  it('keeps a missing-audio clip visible/selectable and seeks without starting playback', async () => {
    const seek = vi.fn()
    const selected = vi.fn()
    render(() => (
      <StudioTimeline {...base} onSeek={seek} onSelectClip={selected} />
    ))
    await waitFor(() =>
      expect(screen.getByText('Audio missing')).toBeInTheDocument(),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Lead vocal, Lead vocal, 0:01.000/ }),
    )
    expect(selected).toHaveBeenCalledWith('clip')
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Song playhead' }), {
      key: 'ArrowRight',
    })
    expect(seek).toHaveBeenCalledWith(48000)
    expect(base.readCanonicalAsset).not.toHaveBeenCalled()
  })

  it('shows only an overview on phone and gives the editing scope when a clip is selected', () => {
    const select = vi.fn()
    const command = vi.fn(() => true)
    render(() => (
      <StudioTimeline
        {...base}
        phone={true}
        selectedClipId="clip"
        onSelectClip={select}
        onCommand={command}
      />
    ))
    expect(
      screen.queryByRole('button', { name: 'Mute Lead vocal' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(
      screen.getByText('Edit clips on a tablet or computer.'),
    ).toBeInTheDocument()
    const clip = screen.getByRole('button', {
      name: /Lead vocal, Lead vocal, 0:01.000/,
    })
    expect(clip).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(clip)
    expect(select).toHaveBeenCalledWith('clip')
    expect(command).not.toHaveBeenCalled()
  })

  it('does not label valid project audio missing when waveform memory is busy', async () => {
    const { project: song, asset } = studioFixture()
    const release = reserveStudioMemory(studioWorkingBytes())
    const read = vi.fn(() => Promise.reject(new Error('Must not read')))
    try {
      render(() => (
        <StudioTimeline
          {...base}
          project={song}
          assets={[asset]}
          readCanonicalAsset={read}
        />
      ))
      await waitFor(() =>
        expect(screen.getByText('Waveform unavailable')).toBeInTheDocument(),
      )
      expect(screen.queryByText('Audio missing')).not.toBeInTheDocument()
      expect(read).not.toHaveBeenCalled()
    } finally {
      cleanup()
      release()
    }
  })

  it('draws a waveform refused for memory once the room comes back', async () => {
    const { project: song, asset } = studioFixture()
    let release = reserveStudioMemory(studioWorkingBytes())
    const read = vi.fn(() => Promise.reject(new Error('Unreadable')))
    try {
      render(() => (
        <StudioTimeline
          {...base}
          project={song}
          assets={[asset]}
          readCanonicalAsset={read}
        />
      ))
      await waitFor(() =>
        expect(screen.getByText('Waveform unavailable')).toBeInTheDocument(),
      )
      release()
      release = () => undefined
      await waitFor(() => expect(read).toHaveBeenCalled(), { timeout: 4000 })
    } finally {
      cleanup()
      release()
    }
  })

  it('only enables splitting when the playhead lies strictly inside the selected clip', () => {
    const [playhead, setPlayhead] = createSignal(48000)
    render(() => (
      <StudioTimeline
        {...base}
        selectedClipId="clip"
        playheadFrame={playhead()}
      />
    ))
    expect(screen.getByRole('button', { name: 'Split' })).toBeDisabled()
    setPlayhead(96000)
    expect(screen.getByRole('button', { name: 'Split' })).toBeEnabled()
    setPlayhead(144000)
    expect(screen.getByRole('button', { name: 'Split' })).toBeDisabled()
  })
  // jsdom has no PointerEvent; without one the events lose button and clientX.
  if (typeof window.PointerEvent === 'undefined')
    window.PointerEvent = class extends MouseEvent {
      readonly pointerId: number
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
      }
    } as unknown as typeof PointerEvent

  function scrubbable(): HTMLElement {
    const ruler = screen.getByRole('slider', { name: 'Song playhead' })
    let captured = false
    ruler.getBoundingClientRect = () => ({ left: 0 }) as DOMRect
    ruler.setPointerCapture = () => {
      captured = true
    }
    ruler.hasPointerCapture = () => captured
    return ruler
  }

  it('scrubs a stopped song under the pointer along the ruler', () => {
    const seek = vi.fn()
    render(() => <StudioTimeline {...base} onSeek={seek} />)
    const ruler = scrubbable()
    fireEvent.pointerDown(ruler, { button: 0, pointerId: 1, clientX: 40 })
    expect(seek).toHaveBeenLastCalledWith(96000)
    fireEvent.pointerMove(ruler, { pointerId: 1, clientX: 60 })
    expect(seek).toHaveBeenLastCalledWith(144000)
    fireEvent.pointerUp(ruler, { pointerId: 1, clientX: 60 })
    expect(seek).toHaveBeenLastCalledWith(144000)
  })

  it('jumps a playing song where the press lands, at once, and not again while the hand stays put', () => {
    const seek = vi.fn()
    render(() => <StudioTimeline {...base} playing={true} onSeek={seek} />)
    const ruler = scrubbable()
    fireEvent.pointerDown(ruler, { button: 0, pointerId: 1, clientX: 40 })
    expect(seek).toHaveBeenCalledExactlyOnceWith(96000)
    fireEvent.pointerMove(ruler, { pointerId: 1, clientX: 42 })
    fireEvent.pointerUp(ruler, { pointerId: 1, clientX: 42 })
    expect(seek).toHaveBeenCalledOnce()
  })

  it('moves a playing song only once more for a drag, when it ends', () => {
    const seek = vi.fn()
    render(() => <StudioTimeline {...base} playing={true} onSeek={seek} />)
    const ruler = scrubbable()
    fireEvent.pointerDown(ruler, { button: 0, pointerId: 1, clientX: 40 })
    fireEvent.pointerMove(ruler, { pointerId: 1, clientX: 50 })
    fireEvent.pointerMove(ruler, { pointerId: 1, clientX: 60 })
    expect(seek).toHaveBeenCalledExactlyOnceWith(96000)
    fireEvent.pointerUp(ruler, { pointerId: 1, clientX: 60 })
    expect(seek).toHaveBeenCalledTimes(2)
    expect(seek).toHaveBeenLastCalledWith(144000)
  })

  it('makes a new lane from its button or a double tap under the headers', () => {
    const add = vi.fn()
    const { container } = render(() => (
      <StudioTimeline {...base} onNewLane={add} />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'New lane' }))
    expect(add).toHaveBeenCalledOnce()
    const area = container.querySelector('[data-studio-new-lane-area]')!
    fireEvent.pointerUp(area, { button: 0 })
    expect(add).toHaveBeenCalledOnce()
    fireEvent.pointerUp(area, { button: 0 })
    expect(add).toHaveBeenCalledTimes(2)
  })

  it('selects a lane from its empty space and marks it', () => {
    const select = vi.fn()
    const { container } = render(() => (
      <StudioTimeline
        {...base}
        selectedTrackId="voice"
        onSelectTrack={select}
      />
    ))
    const lane = container.querySelector('[data-studio-track="voice"]')!
    expect(lane).toHaveAttribute('data-selected')
    fireEvent.click(lane.querySelector('[data-studio-lane-audio]')!)
    expect(select).toHaveBeenCalledWith('voice')
  })

  it('fits a song longer than the widest zoom stop allows', () => {
    const zoom = vi.fn()
    const long = {
      ...project,
      clips: [{ ...project.clips[0], sourceOutFrame: 400 * 48000 }],
    }
    render(() => <StudioTimeline {...base} project={long} onZoom={zoom} />)
    fireEvent.click(screen.getByRole('button', { name: 'Fit song to width' }))
    const [fit] = zoom.mock.calls[0] as [number]
    expect(fit).toBeLessThan(10)
    expect(fit).toBeGreaterThanOrEqual(1)
  })

  it('fits a song to the width to a tenth of a pixel per second, filling a narrow window', () => {
    const zoom = vi.fn()
    // 141 s of song plus a second of room, across 536 px of lane: 3.77 px/s.
    const song = {
      ...project,
      clips: [{ ...project.clips[0], sourceOutFrame: 140 * 48000 }],
    }
    render(() => <StudioTimeline {...base} project={song} onZoom={zoom} />)

    fireEvent.click(screen.getByRole('button', { name: 'Fit song to width' }))

    expect(zoom).toHaveBeenCalledWith(3.7)
  })

  it('moves zoom and the selected clip commands into a dock beside the lanes while the desk is open', () => {
    const [deskOpen, setDeskOpen] = createSignal(false)
    const { container } = render(() => (
      <StudioTimeline {...base} selectedClipId="clip" deskOpen={deskOpen()} />
    ))
    expect(container.querySelector('[data-studio-dock]')).toBeNull()

    setDeskOpen(true)
    const dock = container.querySelector('[data-studio-dock]')!
    const bar = screen.getByRole('toolbar', { name: 'Selected clip' })

    expect(dock).toContainElement(bar)
    expect(dock).toContainElement(
      screen.getByRole('group', { name: 'Timeline zoom' }),
    )
    expect(bar).toHaveAttribute('aria-orientation', 'vertical')
    for (const name of ['Split', 'Duplicate', 'Delete', 'Details'])
      expect(within(bar).getByRole('button', { name })).toBeInTheDocument()
    setDeskOpen(false)
    expect(container.querySelector('[data-studio-dock]')).toBeNull()
    expect(
      screen.getByRole('toolbar', { name: 'Selected clip' }),
    ).not.toHaveAttribute('aria-orientation')
  })

  it('says a notice in the status pill, and says it again when it comes again', () => {
    const missed = 'No room on Harmony at 0:05. Added on a new lane.'
    const [notice, setNotice] = createSignal<{ text: string } | null>(null)
    const { container } = render(() => (
      <StudioTimeline {...base} notice={notice()} />
    ))
    const status = container.querySelector('p[role="status"]')!
    expect(status).toHaveTextContent('')
    setNotice({ text: missed })
    expect(status).toHaveTextContent(missed)
    setNotice(null)
    expect(status).toHaveTextContent(missed)
    setNotice({ text: 'No room on Bass at 1:00. Added on a new lane.' })
    expect(status).toHaveTextContent('No room on Bass at 1:00.')
  })
})
