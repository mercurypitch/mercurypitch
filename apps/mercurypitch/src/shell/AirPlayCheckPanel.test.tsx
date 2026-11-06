// ============================================================
// The AirPlay sound check's section: one button a variant, one at a time
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CheckVariant } from './airplay-check'
import { AirPlayCheckPanel } from './AirPlayCheckPanel'

afterEach(() => {
  cleanup()
})

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
