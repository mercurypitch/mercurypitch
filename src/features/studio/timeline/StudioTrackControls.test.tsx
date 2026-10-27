// Studio track controls tests — a fader drags from where it is, a click moves nothing, and a moving control is heard and seen everywhere before it saves once.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStudioLiveMix, StudioLiveMixContext, } from '@/features/studio/mix/live-mix'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { applyStudioCommand } from '@/lib/studio/model/commands'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
import type { StudioProject } from '@/lib/studio/model/types'
import { StudioTrackControls } from './StudioTrackControls'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** The lane header's controls and the desk strip's, sharing one live mix as in the workspace. */
function mount(gainDb = 0) {
  const log: string[] = []
  const [project, setProject] = createSignal<StudioProject>({
    ...createStudioProject({ id: 'song', title: 'Fader song' }),
    tracks: [
      { ...createStudioTrack({ id: 'keys', name: 'Keys', order: 0 }), gainDb },
    ],
  })
  const command = vi.fn((edit: StudioCommand) => {
    log.push(`command ${JSON.stringify(edit)}`)
    setProject((current) => applyStudioCommand(current, edit, { assets: [] }))
    return true
  })
  const live = createStudioLiveMix({
    previewLane: (trackId, draft) =>
      log.push(`preview ${trackId} ${JSON.stringify(draft)}`),
    previewMacro: () => undefined,
  })
  render(() => (
    <StudioLiveMixContext.Provider value={live}>
      <StudioTrackControls
        track={project().tracks[0]}
        writable
        identity={<span>Keys</span>}
        onCommand={command}
      />
      <StudioTrackControls
        strip
        track={project().tracks[0]}
        writable
        identity={<span>Keys</span>}
        onCommand={command}
      />
    </StudioLiveMixContext.Provider>
  ))
  const [header, strip] = screen.getAllByRole('slider', { name: 'Keys volume' })
  return { project, command, log, header, strip }
}

// jsdom has no PointerEvent: a MouseEvent under a pointer event's name keeps
// the coordinates and the button, as in src/tests/helpers/pill-drag.ts.
function pointer(element: HTMLElement, type: string, clientY: number): void {
  element.setPointerCapture ??= () => undefined
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: 20,
    clientY,
  })
  Object.defineProperty(event, 'pointerId', { value: 7 })
  element.dispatchEvent(event)
}

const readout = (slider: HTMLElement) => slider.getAttribute('aria-valuetext')

describe('Studio track controls', () => {
  it('ignores a click on the fader and drags it from where it was, heard and shown in the header and the desk before it saves', () => {
    const ui = mount()
    // jsdom lays nothing out, so the fader's travel is its 40 px floor:
    // 72 dB over 40 px, 1.8 dB a pixel.
    const zone = ui.strip.parentElement!
    pointer(zone, 'pointerdown', 10)
    pointer(zone, 'pointerup', 10)
    expect(ui.log).toEqual([])
    expect(readout(ui.strip)).toBe('0.0 dB')

    pointer(zone, 'pointerdown', 100)
    pointer(zone, 'pointermove', 102)
    expect(ui.log).toEqual([])
    pointer(zone, 'pointermove', 110)
    expect(readout(ui.strip)).toBe('-18.0 dB')
    expect(readout(ui.header)).toBe('-18.0 dB')
    expect(ui.command).not.toHaveBeenCalled()
    pointer(zone, 'pointerup', 110)
    expect(ui.command).toHaveBeenCalledTimes(1)
    expect(ui.project().tracks[0].gainDb).toBe(-18)
    // Saved first, then the preview ends: the song never hears the old value.
    expect(ui.log).toEqual([
      'preview keys {"gainDb":-18}',
      `command ${JSON.stringify({
        type: 'update-track',
        trackId: 'keys',
        changes: { gainDb: -18 },
      })}`,
      'preview keys null',
    ])
  })

  it('puts the fader back to 0 dB on a double-click, as one edit', () => {
    const ui = mount(-12)
    fireEvent.dblClick(ui.header.parentElement!)
    expect(ui.command).toHaveBeenCalledTimes(1)
    expect(ui.project().tracks[0].gainDb).toBe(0)
  })

  it('stops at +12 dB: a louder saved lane shows its cap at the top, its true value, and drags down from the top', () => {
    const ui = mount(18)
    expect(ui.strip).toHaveAttribute('max', '12')
    expect(ui.strip).toHaveValue('12')
    expect(readout(ui.strip)).toBe('18.0 dB')
    const zone = ui.strip.parentElement!
    pointer(zone, 'pointerdown', 100)
    pointer(zone, 'pointermove', 105)
    expect(readout(ui.strip)).toBe('3.0 dB')
    pointer(zone, 'pointercancel', 105)
    expect(readout(ui.strip)).toBe('18.0 dB')
    expect(ui.command).not.toHaveBeenCalled()
  })

  it('saves a run of arrow keys as one edit once they go quiet, and at once when another key goes down', () => {
    vi.useFakeTimers()
    const ui = mount()
    for (let press = 1; press <= 6; press++) {
      fireEvent.keyDown(ui.header, { key: 'ArrowUp' })
      fireEvent.input(ui.header, { target: { value: String(press / 2) } })
      fireEvent.change(ui.header)
      fireEvent.keyUp(ui.header, { key: 'ArrowUp' })
      vi.advanceTimersByTime(100)
    }
    expect(readout(ui.strip)).toBe('3.0 dB')
    expect(ui.command).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(ui.command).toHaveBeenCalledTimes(1)
    expect(ui.project().tracks[0].gainDb).toBe(3)

    const [pan] = screen.getAllByRole('slider', { name: 'Keys pan' })
    fireEvent.keyDown(pan, { key: 'ArrowRight' })
    fireEvent.input(pan, { target: { value: '0.01' } })
    fireEvent.change(pan)
    fireEvent.keyDown(pan, { key: 'ArrowRight' })
    fireEvent.input(pan, { target: { value: '0.02' } })
    fireEvent.change(pan)
    // Ctrl+Z starts with its Control key: the run saves before the undo.
    fireEvent.keyDown(pan, { key: 'Control' })
    expect(ui.command).toHaveBeenCalledTimes(2)
    expect(ui.project().tracks[0].pan).toBe(0.02)
  })
})
