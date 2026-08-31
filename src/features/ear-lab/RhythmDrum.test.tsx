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
