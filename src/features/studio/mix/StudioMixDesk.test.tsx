// Studio mixing desk tests — lane strips and the master send the same commands as the lane headers and the Sound panel.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal, Show } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioMeterSnapshot } from '@/lib/studio/metering/stream-meter'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { applyStudioCommand } from '@/lib/studio/model/commands'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
import type { StudioProject } from '@/lib/studio/model/types'
import { StudioMixDesk } from './StudioMixDesk'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function song(): StudioProject {
  return {
    ...createStudioProject({ id: 'song', title: 'Desk song' }),
    // Stored out of order: the desk follows `order`, like the lanes.
    tracks: [
      createStudioTrack({ id: 'drums', name: 'Drums', order: 2 }),
      createStudioTrack({ id: 'voice', name: 'Lead vocal', order: 0 }),
      createStudioTrack({ id: 'piano', name: 'Piano', order: 1 }),
    ],
  }
}

function mount(options: { writable?: boolean; open?: boolean } = {}) {
  const [project, setProject] = createSignal(song())
  const [open, setOpen] = createSignal(options.open ?? true)
  const [meter, setMeter] = createSignal<StudioMeterSnapshot | null>(null)
  const command = vi.fn((edit: StudioCommand) => {
    setProject((current) => applyStudioCommand(current, edit, { assets: [] }))
    return true
  })
  const close = vi.fn(() => setOpen(false))
  const resetPeakHold = vi.fn()
  render(() => (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Mix
      </button>
      <Show when={open()}>
        <StudioMixDesk
          project={project()}
          writable={options.writable ?? true}
          meter={{
            meter,
            meterReady: () => meter() !== null,
            peakL: () => 0,
            peakR: () => 0,
            resetPeakHold,
          }}
          onCommand={command}
          onClose={close}
        />
      </Show>
    </>
  ))
  return { project, command, close, open, setMeter }
}

// jsdom has no PointerEvent: a MouseEvent under a pointer event's name keeps
// clientY and the button, as in src/tests/helpers/pill-drag.ts.
function pointer(element: HTMLElement, type: string, clientY: number): void {
  element.setPointerCapture ??= () => undefined
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientY,
  })
  Object.defineProperty(event, 'pointerId', { value: 7 })
  element.dispatchEvent(event)
}

const desk = () => screen.getByRole('region', { name: 'Mix' })
const track = (project: StudioProject, id: string) =>
  project.tracks.find((item) => item.id === id)!

describe('Studio mixing desk', () => {
  it('gives each lane a strip in lane order, and its fader, pan, Mute and Solo send update-track', () => {
    const ui = mount()
    const volumes = screen
      .getAllByRole('slider', { name: / volume$/ })
      .map((slider) => slider.getAttribute('aria-label'))
    expect(volumes).toEqual([
      'Lead vocal volume',
      'Piano volume',
      'Drums volume',
    ])

    const fader = screen.getByRole('slider', { name: 'Piano volume' })
    fireEvent.input(fader, { target: { value: '-9' } })
    expect(ui.command).not.toHaveBeenCalled()
    fireEvent.change(fader, { target: { value: '-9' } })
    expect(ui.command).toHaveBeenLastCalledWith({
      type: 'update-track',
      trackId: 'piano',
      changes: { gainDb: -9 },
    })
    expect(track(ui.project(), 'piano').gainDb).toBe(-9)

    const pan = screen.getByRole('slider', { name: 'Lead vocal pan' })
    fireEvent.input(pan, { target: { value: '-0.3' } })
    fireEvent.change(pan, { target: { value: '-0.3' } })
    expect(ui.command).toHaveBeenLastCalledWith({
      type: 'update-track',
      trackId: 'voice',
      changes: { pan: -0.3 },
    })
    expect(pan).toHaveAttribute('aria-valuetext', '30 percent left')

    fireEvent.click(screen.getByRole('button', { name: 'Mute Drums' }))
    expect(track(ui.project(), 'drums').mute).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Solo Piano' }))
    expect(ui.command).toHaveBeenLastCalledWith({
      type: 'update-track',
      trackId: 'piano',
      changes: { solo: true },
    })
    // A lane the listener cannot hear dims its strip's colour bar.
    const silent = [...desk().querySelectorAll('[data-studio-mix-strip]')]
      .filter((strip) => strip.hasAttribute('data-silent'))
      .map((strip) => strip.getAttribute('data-studio-mix-strip'))
    expect(silent).toEqual(['voice', 'drums'])
    expect(ui.command).toHaveBeenCalledTimes(4)
  })

  it('turns a master dial with a run of keys into one set-sound-macros, the Sound panel’s command', () => {
    vi.useFakeTimers()
    const ui = mount()
    const space = screen.getByRole('slider', { name: 'Space' })
    expect(space).toHaveAttribute('aria-valuetext', 'Centre')
    for (const value of ['5', '10']) {
      fireEvent.keyDown(space, { key: 'ArrowUp' })
      fireEvent.input(space, { target: { value } })
      fireEvent.change(space)
      fireEvent.keyUp(space, { key: 'ArrowUp' })
      vi.advanceTimersByTime(200)
    }
    expect(ui.command).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    vi.useRealTimers()
    expect(ui.command).toHaveBeenCalledTimes(1)
    expect(ui.command).toHaveBeenCalledWith({
      type: 'set-sound-macros',
      macros: { ...song().mix.macros, space: 10 },
    })
    expect(ui.project().mix.macros.space).toBe(10)
    expect(space).toHaveAttribute('aria-valuetext', '10 toward Big')
  })

  it('drags a dial up as one edit and double-click returns it to the centre', () => {
    const ui = mount()
    const face = screen.getByTitle(
      'Tone: drag up or down. Double-click for the centre.',
    )
    pointer(face, 'pointerdown', 200)
    pointer(face, 'pointermove', 160)
    expect(screen.getByRole('slider', { name: 'Tone' })).toHaveAttribute(
      'aria-valuetext',
      '50 toward Bright',
    )
    pointer(face, 'pointermove', 120)
    expect(ui.command).not.toHaveBeenCalled()
    expect(screen.getByRole('slider', { name: 'Tone' })).toHaveAttribute(
      'aria-valuetext',
      '100 toward Bright',
    )
    pointer(face, 'pointerup', 120)
    expect(ui.command).toHaveBeenCalledTimes(1)
    expect(ui.project().mix.macros.tone).toBe(100)

    fireEvent.dblClick(face)
    expect(ui.command).toHaveBeenCalledTimes(2)
    expect(ui.project().mix.macros.tone).toBe(0)
  })

  it('picks a flavour and resets the sound from the master side', () => {
    const ui = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Warm' }))
    expect(ui.command).toHaveBeenLastCalledWith({
      type: 'set-sound-flavour',
      flavourId: 'warm',
    })
    expect(screen.getByRole('button', { name: 'Warm' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reset sound' }))
    expect(ui.project().mix.flavourId).toBe('natural')
  })

  it('shows the transport’s output peak and short-term loudness', () => {
    const ui = mount()
    const meter = screen.getByRole('meter', { name: 'Output sample peak' })
    expect(meter).toHaveAttribute('aria-valuetext', 'Silent')
    ui.setMeter({
      frames: 48_000,
      momentaryLufs: -12.5,
      shortTermLufs: -14.2,
      peakL: 0.5,
      peakR: 0.25,
      holdL: 0.5,
      holdR: 0.25,
      clipL: false,
      clipR: false,
    })
    expect(meter).toHaveAttribute('aria-valuetext', '-6.0 dBFS')
    expect(
      screen.getByTitle('Short-term loudness, 3 seconds'),
    ).toHaveTextContent('Short-term-14.2LUFS')
  })

  it('closes on Escape and hands focus back to the button that opened it', async () => {
    const ui = mount({ open: false })
    const opener = screen.getByRole('button', { name: 'Mix' })
    opener.focus()
    fireEvent.click(opener)
    await Promise.resolve()
    expect(document.activeElement).toBe(desk())
    const fader = screen.getByRole('slider', { name: 'Drums volume' })
    fader.focus()
    fireEvent.keyDown(fader, { key: 'Escape' })
    expect(ui.close).toHaveBeenCalledTimes(1)
    expect(ui.open()).toBe(false)
    expect(document.activeElement).toBe(opener)
  })

  it('lets Escape cancel a fader mid-edit without closing the desk', () => {
    const ui = mount()
    const fader = screen.getByRole('slider', { name: 'Lead vocal volume' })
    fireEvent.input(fader, { target: { value: '-20' } })
    fireEvent.keyDown(fader, { key: 'Escape' })
    expect(fader).toHaveValue('0')
    expect(ui.close).not.toHaveBeenCalled()
    expect(ui.command).not.toHaveBeenCalled()
    fireEvent.keyDown(fader, { key: 'Escape' })
    expect(ui.close).toHaveBeenCalledTimes(1)
  })

  it('keeps every control read only on a song that cannot be edited', () => {
    const ui = mount({ writable: false })
    expect(screen.getByRole('slider', { name: 'Piano volume' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Solo Drums' })).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Width' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Lo-fi' })).toBeDisabled()
    const face = screen.getByTitle(
      'Width: drag up or down. Double-click for the centre.',
    )
    pointer(face, 'pointerdown', 200)
    pointer(face, 'pointermove', 100)
    pointer(face, 'pointerup', 100)
    expect(ui.command).not.toHaveBeenCalled()
    expect(ui.project().mix.macros.width).toBe(0)
  })
})
