// ============================================================
// RhythmDrum: one bar draws four lamps, a pattern that crosses the
// barline draws eight and a solid barline; a score writes real
// notation — heads, stems, beams and rests — before anything is
// tapped, the take runs a line across it, and the reveal marks the
// onsets that were missed.
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { RhythmDrum } from './RhythmDrum'

afterEach(cleanup)

const drum = () => screen.getByRole('img', { name: /Rhythm drum/ })
const parts = (part: string) => drum().querySelectorAll(`[data-part="${part}"]`)

describe('RhythmDrum', () => {
  it('draws a lamp per beat of the bar', () => {
    render(() => <RhythmDrum bar={null} beat={0} reveal={null} />)
    expect(parts('beat-lamp')).toHaveLength(4)
    expect(drum().getAttribute('aria-label')).toContain('one bar')
  })

  it('stretches to two bars when the pattern crosses the barline', () => {
    render(() => <RhythmDrum bar={null} beat={0} beats={8} reveal={null} />)
    expect(parts('beat-lamp')).toHaveLength(8)
    expect(drum().getAttribute('aria-label')).toContain('two bars')
  })

  it('shows no progress rail until the bar has been started', () => {
    render(() => <RhythmDrum bar="response" beat={0} waiting reveal={null} />)
    expect(drum().querySelector('[data-part="progress-fill"]')).toBeNull()
    expect(drum().querySelector('[data-part="playhead"]')).toBeNull()
    expect(drum().textContent).toContain('tap to start')
    expect(
      drum().querySelectorAll('[data-part="beat-lamp"][data-passed="true"]'),
    ).toHaveLength(0)
  })

  it('runs the rail from the anchor and fills the lamps it has passed', () => {
    render(() => (
      <RhythmDrum
        bar="response"
        beat={2}
        run={{ from: 0.25, durationMs: 1800 }}
        reveal={null}
      />
    ))
    // Beats one and two have sounded; three and four are still ahead.
    expect(
      drum().querySelectorAll('[data-part="beat-lamp"][data-passed="true"]'),
    ).toHaveLength(2)
    // The fill spans the whole bar and is animated down to the anchor's
    // place, so the sweep needs no per-frame work from us.
    const fill = drum().querySelector<SVGElement>('[data-part="progress-fill"]')
    const track = drum().querySelector('[data-part="progress-track"]')
    const trackSpan =
      Number(track?.getAttribute('x2')) - Number(track?.getAttribute('x1'))
    expect(Number(fill?.getAttribute('width'))).toBe(trackSpan)
    expect(fill?.style.getPropertyValue('--fill-from')).toBe('0.25')
    expect(fill?.style.getPropertyValue('--fill-run')).toBe('1800ms')
  })

  it('sweeps a line down the paper on the take’s own clock', () => {
    render(() => (
      <RhythmDrum
        bar="response"
        beat={1}
        run={{ from: 0, durationMs: 2400 }}
        score={[0, 1, 2]}
        reveal={null}
      />
    ))
    const head = drum().querySelector<SVGElement>('[data-part="playhead"]')
    expect(head?.style.getPropertyValue('--head-from')).toBe('0')
    expect(head?.style.getPropertyValue('--fill-run')).toBe('2400ms')
    // and it travels the width of the bar, not of the paper
    expect(head?.style.getPropertyValue('--head-span')).toBe('304px')
  })

  it('lights each written note as the line reaches it', () => {
    render(() => (
      <RhythmDrum
        bar="response"
        beat={1}
        run={{ from: 0, durationMs: 2400 }}
        score={[0, 1, 2]}
        reveal={null}
      />
    ))
    const delays = [...parts('score-onset')].map((note) =>
      (note as SVGElement).style.getPropertyValue('--note-at'),
    )
    // A four-beat bar run in 2400 ms: beat one at once, then 600 ms
    // apart. The delay is what the browser waits before lighting it.
    expect(delays).toEqual(['0ms', '600ms', '1200ms'])
  })

  it('writes a score as notation before the take', () => {
    render(() => (
      <RhythmDrum
        bar="count"
        beat={1}
        score={[0, 1.5, 2]}
        upperWord="the chart"
        reveal={null}
      />
    ))
    expect(parts('score-onset')).toHaveLength(3)
    expect(parts('note-head')).toHaveLength(3)
    expect(parts('stem')).toHaveLength(3)
    // 0 → 1.5 is a dotted quarter, so one dot and no rests
    expect(parts('dot')).toHaveLength(1)
    expect(parts('rest')).toHaveLength(0)
    expect(drum().textContent).toContain('the chart')
  })

  it('beams a gallop and stubs its sixteenth back at the dotted eighth', () => {
    render(() => (
      <RhythmDrum bar="count" beat={1} score={[0, 0.75, 1, 2]} reveal={null} />
    ))
    const beams = [...parts('beam')]
    expect(beams).toHaveLength(2)
    expect(beams.map((beam) => beam.getAttribute('data-level'))).toEqual([
      '1',
      '2',
    ])
    expect(beams[1].getAttribute('data-stub')).toBe('left')
    // and the beamed pair keeps its flags off the stems
    expect(parts('flag')).toHaveLength(0)
  })

  it('writes a triplet under its numeral', () => {
    render(() => (
      <RhythmDrum
        bar="count"
        beat={1}
        score={[0, 1 / 3, 2 / 3, 1]}
        reveal={null}
      />
    ))
    expect(parts('tuplet')).toHaveLength(1)
    expect(parts('tuplet')[0].textContent).toBe('3')
    // beamed, so the numeral needs no bracket of its own
    expect(parts('tuplet-bracket')).toHaveLength(0)
  })

  it('opens a pattern that starts off the beat with a rest', () => {
    render(() => (
      <RhythmDrum bar="count" beat={1} score={[0.5, 1, 2.5, 3]} reveal={null} />
    ))
    expect(parts('rest')).toHaveLength(1)
    expect(parts('score-onset')).toHaveLength(4)
  })

  it('draws the grid the pattern sits on, and nothing when unasked', () => {
    render(() => (
      <RhythmDrum
        bar="count"
        beat={1}
        score={[0, 0.75, 1, 2]}
        grid="sixteenths"
        reveal={null}
      />
    ))
    // three marks inside each of four beats
    expect(parts('grid-mark')).toHaveLength(12)
    cleanup()
    render(() => (
      <RhythmDrum bar="count" beat={1} score={[0, 0.75, 1, 2]} reveal={null} />
    ))
    expect(parts('grid-mark')).toHaveLength(0)
  })

  it('lands the player’s taps under the score as they happen', () => {
    render(() => (
      <RhythmDrum
        bar="response"
        beat={2}
        run={{ from: 0, durationMs: 2400 }}
        liveTaps={[0, 1, 1.5]}
        reveal={null}
      />
    ))
    expect(parts('live-tap')).toHaveLength(3)
    expect(drum().textContent).toContain('yours')
  })

  it('writes the call as notation at the reveal and marks the misses', () => {
    render(() => (
      <RhythmDrum
        bar={null}
        beat={0}
        liveTaps={[0, 2]}
        reveal={{
          onsets: [0, 1, 2],
          met: [true, false, true],
          taps: [0, 2],
          extras: [2.6],
          correct: false,
        }}
      />
    ))
    expect(parts('onset')).toHaveLength(3)
    expect(
      drum().querySelectorAll('[data-part="onset"][data-met="false"]'),
    ).toHaveLength(1)
    expect(parts('tap')).toHaveLength(2)
    expect(parts('extra')).toHaveLength(1)
    // the take is judged, so the live row is gone and nothing is lit
    expect(parts('live-tap')).toHaveLength(0)
    // and the verdict is garnet with the misses, not the signal green
    // a clean take earns
    expect(drum().textContent).toContain('Not quite')
    expect(parts('verdict')[0].getAttribute('class')).toMatch(/Garnet/)
  })
})
