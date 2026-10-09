// ============================================================
// Scrubber: the loop's A and B, drawn on the phone's seek bar
// ============================================================
//
// The phone stage's More sheet sets A and B; the bar the singer watches has
// to show where they are, as the desktop timeline does. Drawn only: the
// marks take no taps, so a seek near A is still a seek.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { Scrubber } from '@/components/mobile/Scrubber'

afterEach(cleanup)

interface Loop {
  start: number | null
  end: number | null
  on: boolean
}

function mountWith(initial: Loop | undefined, duration = 40) {
  const [loop, setLoop] = createSignal<Loop | undefined>(initial)
  render(() => (
    <Scrubber value={0} duration={duration} onSeek={() => {}} loop={loop()} />
  ))
  return { setLoop }
}

/** Where each mark sits along the bar, as its CSS says. */
const drawn = () =>
  ['scrubber-loop-a', 'scrubber-loop-b', 'scrubber-loop-span'].map((id) => {
    const element = screen.queryByTestId(id)
    if (element === null) return null
    return {
      left: element.style.left,
      width: element.style.width || undefined,
    }
  })

describe('the loop on the seek bar', () => {
  it('draws A, B and the span between them where they are in the song', () => {
    mountWith({ start: 10, end: 20, on: true })

    expect(drawn()).toEqual([
      { left: '25%', width: undefined },
      { left: '50%', width: undefined },
      { left: '25%', width: '25%' },
    ])
  })

  it('draws A alone until B is set, and follows a new B', () => {
    const { setLoop } = mountWith({ start: 8, end: null, on: false })
    const aAlone = drawn()

    setLoop({ start: 8, end: 30, on: true })

    expect([aAlone, drawn()]).toEqual([
      [{ left: '20%', width: undefined }, null, null],
      [
        { left: '20%', width: undefined },
        { left: '75%', width: undefined },
        { left: '20%', width: '55%' },
      ],
    ])
  })

  it('draws nothing with no loop set, and nothing before the song has a length', () => {
    mountWith({ start: null, end: null, on: false })
    const unset = drawn()
    cleanup()
    mountWith({ start: 10, end: 20, on: true }, 0)

    expect([unset, drawn()]).toEqual([
      [null, null, null],
      [null, null, null],
    ])
  })

  it('tells a loop that is off from one that is on', () => {
    const { setLoop } = mountWith({ start: 10, end: 20, on: false })
    const state = () =>
      screen.getByTestId('scrubber-loop-span').getAttribute('data-on')
    const off = state()

    setLoop({ start: 10, end: 20, on: true })

    expect([off, state()]).toEqual(['false', 'true'])
  })
})
