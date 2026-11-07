// ============================================================
// The AirPlay sound check's section: one button a variant, one at a time
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { notePageAudioContext, resetAirPlaySuspicionForTests, } from '@/stores/airplay-suspicion'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import { checkOutput, followOutputChecks, resetOutputCheckForTests, } from '@/stores/output-check'
import type { CheckVariant } from './airplay-check'
import { AirPlayCheckPanel } from './AirPlayCheckPanel'

afterEach(() => {
  cleanup()
  resetOutputCheckForTests()
  resetAirPlaySuspicionForTests()
  setAudioRouteForTests(null)
  vi.restoreAllMocks()
})

/** The readout's rows, label and value, as the tester reads them. */
const readout = (): string[] =>
  [...screen.getByTestId('dev-airplay-readout').querySelectorAll('div')].map(
    (row) =>
      `${row.querySelector('dt')?.textContent ?? ''}: ${row.querySelector('dd')?.textContent ?? ''}`,
  )

describe('AirPlayCheckPanel', () => {
  it('offers the seven ways, each named by its beeps', () => {
    render(() => <AirPlayCheckPanel run={vi.fn(async () => undefined)} />)

    const titles = screen
      .getAllByRole('button')
      .map((button) => button.querySelector('.mp-dev__row-title')?.textContent)
    expect(titles).toEqual([
      '1 beep: Media element',
      '2 beeps: Media element kept local',
      '3 beeps: Web Audio alone',
      '4 beeps: Web Audio beside a silent element',
      '5 beeps: Web Audio with the mic open',
      '6 beeps: Media element through Web Audio',
      '7 beeps: Web Audio after a paused element',
    ])
  })

  it('reads the guess, the last check and what may play beside, and follows a check', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    setAudioRouteForTests('speaker', 'Speaker', 48000)
    notePageAudioContext({ sampleRate: 48000 })
    const at = new Date(2026, 10, 7, 21, 31, 5).getTime()
    const stop = followOutputChecks({
      host: {
        makeProbe: () => ({
          sampleRate: 44100,
          close: async () => Promise.resolve(),
        }),
        inGesture: () => false,
        now: () => at,
        say: () => undefined,
      },
    })
    render(() => <AirPlayCheckPanel run={vi.fn(async () => undefined)} />)
    expect(readout()).toEqual([
      "The guess: Not AirPlay alone: the page at 48000 Hz, the phone's session at 48000 Hz on speaker",
      'Last check: None yet',
      "Beside the sound: The lock screen's carrier and the unlock clip, where a start's check says the sound stays here",
    ])

    checkOutput('app')

    expect(readout()).toEqual([
      "The guess: AirPlay alone, likely: the page at 44100 Hz, the phone's session at 48000 Hz on speaker",
      'Last check: 44100 Hz at 21:31:05, on the app in front, outside a gesture: AirPlay alone',
      "Beside the sound: Nothing: the lock screen's carrier and the unlock clip stand aside",
    ])
    stop()
  })

  it('plays the one tapped, and waits for it before another', async () => {
    let done: () => void = () => undefined
    const run = vi.fn(
      async (_n: CheckVariant) =>
        new Promise<void>((resolve) => {
          done = resolve
        }),
    )
    render(() => <AirPlayCheckPanel run={run} />)

    fireEvent.click(screen.getByTestId('dev-airplay-check-3'))
    fireEvent.click(screen.getByTestId('dev-airplay-check-4'))

    const button = (n: number): HTMLButtonElement =>
      screen.getByTestId(`dev-airplay-check-${String(n)}`) as HTMLButtonElement
    expect(run.mock.calls).toEqual([[3]])
    expect(button(4).disabled).toBe(true)
    expect(button(3).textContent).toContain('Playing')
    done()
    await vi.waitFor(() => {
      expect(button(4).disabled).toBe(false)
    })
  })
})
