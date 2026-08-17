// The loop control has to read as one span, not as scattered furniture.
// ============================================================
//
// The phone report was that "the loop icon and then a bit bulky A/B buttons"
// read oddly. Both rooms already title the section and say what A and B do,
// so what was on screen was a decorative icon, two loose boxes, and a caption
// repeating the heading above it. These pin the reorganised shape: A and B
// live in one segmented group, and the row says something only when it has
// something to say.

import { cleanup, render, screen, within } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { GuitarNightLoopControls } from './GuitarNightLoopControls'

afterEach(cleanup)

function renderControls(
  overrides: Partial<{
    span: LoopSpan | null
    pending: boolean
    hasStart: boolean
    hasEnd: boolean
  }> = {},
) {
  const onClear = vi.fn()
  render(() => (
    <GuitarNightLoopControls
      span={overrides.span ?? null}
      pending={overrides.pending ?? false}
      hasStart={overrides.hasStart ?? false}
      hasEnd={overrides.hasEnd ?? false}
      format={(position) => `${position.toFixed(1)}s`}
      onMarkStart={() => undefined}
      onMarkEnd={() => undefined}
      onClear={onClear}
    />
  ))
  return { onClear }
}

describe('GuitarNightLoopControls', () => {
  it('keeps A and B together as one control', () => {
    renderControls()

    const group = screen.getByRole('group', { name: 'Section loop' })
    const marks = within(group).getAllByRole('button')
    expect(marks.map((button) => button.textContent)).toEqual(['A', 'B'])
    // One parent, so the pair can be drawn as a segment rather than two boxes.
    expect(marks[0]?.parentElement).toBe(marks[1]?.parentElement)
    expect(marks[0]?.parentElement).not.toBe(group)
  })

  it('says nothing while no mark is set', () => {
    renderControls()

    // The heading above already reads "Set A and B at the current song
    // position" — repeating it under the buttons was the redundancy.
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('asks for the other end once one mark is down', () => {
    renderControls({ pending: true, hasStart: true })

    expect(screen.getByRole('status')).toHaveTextContent('Mark the other end')
  })

  it('shows the span, and only then the repeat icon', () => {
    renderControls({
      span: { start: 12, end: 20 },
      hasStart: true,
      hasEnd: true,
    })

    const output = screen.getByRole('status')
    expect(output).toHaveTextContent('12.0s – 20.0s')
    // The icon earns its place by labelling a real span instead of sitting in
    // front of the buttons as decoration.
    expect(output.querySelector('svg')).not.toBeNull()
  })

  it('offers Clear only once a mark exists', () => {
    renderControls()
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()

    cleanup()
    const { onClear } = renderControls({ hasEnd: true })
    const clear = screen.getByRole('button', { name: 'Clear' })
    clear.click()
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('reports each mark as pressed or not', () => {
    renderControls({ hasStart: true })

    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'B' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
