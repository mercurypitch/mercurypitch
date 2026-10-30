// Pulse's and The Chart's lane: Pulse's call line stays blank while the
// call plays, The Chart's bar is written from the start, taps land on the
// player's line, and the reveal links each met onset to its tap.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { LitRhythm } from './LitRhythm'

afterEach(cleanup)

const parts = (part: string): Element[] => [
  ...document.querySelectorAll(`[data-part="${part}"]`),
]
const word = (): string | null | undefined =>
  document.querySelector('[data-part="lane-word"]')?.textContent

describe("Pulse's and The Chart's lane", () => {
  it("keeps Pulse's call line blank while the call plays", () => {
    render(() => <LitRhythm bar="call" beat={2} reveal={null} />)
    expect(parts('score-onset')).toHaveLength(0)
    expect(parts('onset')).toHaveLength(0)
    expect(word()).toBe('The call')
    expect(parts('beat-lamp')).toHaveLength(4)
  })

  it("writes The Chart's bar from the start, the count-in counting", () => {
    render(() => (
      <LitRhythm
        bar="count"
        beat={1}
        reveal={null}
        score={[0, 1, 2, 3]}
        upperWord="the chart"
      />
    ))
    expect(parts('score-onset')).toHaveLength(4)
    expect(word()).toBe('Count-in')
    expect(document.body.textContent).toContain('Chart')
  })

  it("lands the player's taps on their line while the bar runs", () => {
    render(() => (
      <LitRhythm
        bar="response"
        beat={2}
        reveal={null}
        liveTaps={[0, 1.02]}
        run={{ from: 0, durationMs: 2000 }}
      />
    ))
    expect(parts('live-tap')).toHaveLength(2)
    expect(parts('playhead')).toHaveLength(1)
    expect(word()).toBe('Yours')
  })

  it('links each met onset to its tap at the reveal and rings the one missed', () => {
    render(() => (
      <LitRhythm
        bar={null}
        beat={0}
        upperWord="the chart"
        reveal={{
          onsets: [0, 1, 2, 3],
          met: [true, true, false, true],
          taps: [0.02, 1.01, 2.98],
          extras: [3.5],
          correct: false,
        }}
      />
    ))
    expect(parts('onset')).toHaveLength(4)
    expect(document.querySelectorAll('[data-met="false"]')).toHaveLength(1)
    expect(parts('link')).toHaveLength(3)
    expect(parts('tap')).toHaveLength(3)
    expect(parts('extra')).toHaveLength(1)
    expect(parts('playhead')).toHaveLength(0)
    expect(word()).toBe('Your bar against the chart')
  })
})
