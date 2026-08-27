// ============================================================
// The bench renders honestly on a fresh store, and keeps every hook
// the page tour and the phone audit rely on.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import { earClickVoice, setEarClickVoice } from './ear-sound'
import type { EarLabView } from './EarLabDashboard'
import { EarLabDashboard } from './EarLabDashboard'
import { EarRoomShell } from './EarRoomShell'

/** Enough engine for the room: it trims tones to the stage volume
 *  and previews a click from the rack. */
const engine = {
  init: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  getAudioContext: () => null,
  getVolume: () => 0.8,
  setToneTrim: vi.fn(),
}

/** The bench inside its room, the way EarLabPage composes them. */
function Bench(props: { onNavigate?: (view: EarLabView) => void }) {
  const go = (view: EarLabView) => props.onNavigate?.(view)
  return (
    <EngineContext.Provider
      value={{
        audioEngine: engine as unknown as AudioEngine,
        playbackRuntime: {} as PlaybackRuntime,
        practiceEngine: {} as PracticeEngine,
        ready: () => true,
      }}
    >
      <EarRoomShell onNavigate={go}>
        <EarLabDashboard onNavigate={go} />
      </EarRoomShell>
    </EngineContext.Provider>
  )
}

const TOUR_HOOKS = [
  'ear.column',
  'ear.index',
  'ear.faculties',
  'ear.sprint',
  'ear.actions',
  'ear.drills',
  'ear.latency',
  'ear.rulers',
] as const

describe('EarLabDashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    resetEarLabStore()
    // Play pads prime the audio session through a silent <audio>; jsdom
    // has no media playback and would log "Not implemented" per click.
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.resolve(),
    )
  })

  afterEach(() => {
    cleanup()
    setEarClickVoice('wood')
    engine.setToneTrim.mockClear()
    engine.init.mockClear()
  })

  it('keeps the panel id and every tour hook on a fresh store', () => {
    const { container } = render(() => <Bench />)
    expect(container.querySelector('#ear-lab-panel')).not.toBeNull()
    for (const hook of TOUR_HOOKS) {
      expect(
        container.querySelector(`[data-tour="${hook}"]`),
        `missing data-tour="${hook}"`,
      ).not.toBeNull()
    }
  })

  it('says Unmeasured for every faculty and never shows a percent', () => {
    const { container } = render(() => <Bench />)
    const faculties = container.querySelector('[data-tour="ear.faculties"]')
    expect(faculties?.textContent).toContain('Unmeasured')
    expect(faculties?.querySelectorAll('li')).toHaveLength(6)
    expect(container.querySelector('#ear-lab-panel')?.textContent).not.toMatch(
      /\d%/,
    )
    expect(screen.getAllByText('Not yet marked').length).toBeGreaterThan(0)
  })

  it('routes the amber control to calibration and the strip to its drill', () => {
    const onNavigate = vi.fn()
    render(() => <Bench onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /Run Calibration/ }))
    expect(onNavigate).toHaveBeenCalledWith('calibration')
    fireEvent.click(screen.getByRole('listitem', { name: /^Hairline/ }))
    expect(onNavigate).toHaveBeenCalledWith('hairline')
  })

  it('opens the rack from the bridge and closes it on Escape', () => {
    render(() => <Bench />)
    const rack = screen.getByTestId('ear-rack')
    expect(rack.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Instruments' }))
    expect(rack.getAttribute('aria-hidden')).toBeNull()
    expect(screen.getByRole('dialog').textContent).toContain('The Grid')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(rack.getAttribute('aria-hidden')).toBe('true')
  })

  it('opens the rulers plate from the session bar', () => {
    render(() => <Bench />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Why there is no percent here' }),
    )
    expect(screen.getByRole('dialog').textContent).toContain(
      'frozen difficulty',
    )
  })

  it("opens today's regulation in the rack, and a drill from it", () => {
    const go = vi.fn()
    render(() => <Bench onNavigate={go} />)
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain("Today's regulation")
    // The bench keeps the tour hook; the rack's copy carries none.
    expect(document.querySelectorAll('[data-tour="ear.sprint"]')).toHaveLength(
      1,
    )
    const slot = dialog.querySelector('button[data-drill]')
    expect(slot).not.toBeNull()
    fireEvent.click(slot as HTMLButtonElement)
    expect(go).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('ear-rack').getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('carries the stage volume to the engine and offers three click voices', () => {
    render(() => <Bench />)
    expect(engine.setToneTrim).toHaveBeenLastCalledWith(0.7)
    fireEvent.click(screen.getByTestId('ear-room-chip'))
    const slider = screen.getByTestId('ear-room-volume') as HTMLInputElement
    fireEvent.input(slider, { target: { value: '0.4' } })
    expect(engine.setToneTrim).toHaveBeenLastCalledWith(0.4)
    expect(localStorage.getItem('pitchperfect_ear_volume')).toBe('0.4')

    const voices = screen.getAllByRole('radio')
    expect(voices.map((voice) => voice.textContent)).toEqual([
      expect.stringContaining('Wood'),
      expect.stringContaining('Tick'),
      expect.stringContaining('Soft'),
    ])
    expect(voices[0].getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByTestId('ear-click-soft'))
    expect(earClickVoice()).toBe('soft')
    expect(voices[2].getAttribute('aria-checked')).toBe('true')
    // Choosing a click plays it once — the engine is woken for it.
    expect(engine.init).toHaveBeenCalled()
  })
})
