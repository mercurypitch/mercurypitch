// ============================================================
// RhythmDrum: one bar draws four lamps, a pattern that crosses the
// barline draws eight and a solid barline; a score writes its onsets
// on the upper rule before anything is tapped.
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { RhythmDrum } from './RhythmDrum'

afterEach(cleanup)

const drum = () => screen.getByRole('img', { name: /Rhythm drum/ })

describe('RhythmDrum', () => {
  it('draws a lamp per beat of the bar', () => {
    render(() => <RhythmDrum bar={null} beat={0} reveal={null} />)
    expect(drum().querySelectorAll('[data-part="beat-lamp"]')).toHaveLength(4)
    expect(drum().getAttribute('aria-label')).toContain('one bar')
  })

  it('stretches to two bars when the pattern crosses the barline', () => {
    render(() => <RhythmDrum bar={null} beat={0} beats={8} reveal={null} />)
    expect(drum().querySelectorAll('[data-part="beat-lamp"]')).toHaveLength(8)
    expect(drum().getAttribute('aria-label')).toContain('two bars')
  })

  it('shows no progress rail until the bar has been started', () => {
    render(() => <RhythmDrum bar="response" beat={0} waiting reveal={null} />)
    expect(drum().querySelector('[data-part="progress-fill"]')).toBeNull()
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

  it('writes a score on the upper rule before the take', () => {
    render(() => (
      <RhythmDrum
        bar="count"
        beat={1}
        score={[0, 1.5, 2]}
        upperWord="the chart"
        reveal={null}
      />
    ))
    expect(drum().querySelectorAll('[data-part="score-onset"]')).toHaveLength(3)
    expect(drum().textContent).toContain('the chart')
  })
})
