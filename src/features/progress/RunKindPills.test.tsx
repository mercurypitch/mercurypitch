// Run-kind pills — the row that answers "where did my work go".
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProgressRun } from './run-kinds'
import { RunKindChip, RunKindPills } from './RunKindPills'

function run(kind: ProgressRun['kind'], score = 70): ProgressRun {
  return { kind, score, completedAt: 1_700_000_000_000, hasNoteDetail: true }
}

afterEach(cleanup)

describe('RunKindPills', () => {
  it('counts each kind separately', () => {
    render(() => (
      <RunKindPills runs={[run('exercise'), run('exercise'), run('weekly')]} />
    ))

    expect(
      screen.getByText('Exercise').previousElementSibling,
    ).toHaveTextContent('2')
    expect(screen.getByText('Weekly').previousElementSibling).toHaveTextContent(
      '1',
    )
  })

  it('keeps a kind nobody has run, rather than hiding the zero', () => {
    // The row exists to answer "where did my work go". A kind that vanishes
    // at zero cannot answer that — the reader is left assuming it counted.
    render(() => <RunKindPills runs={[run('exercise')]} />)

    expect(
      screen.getByText('Practice').previousElementSibling,
    ).toHaveTextContent('0')
    expect(screen.getByText('Challenge')).toBeInTheDocument()
  })

  it('shows every kind at zero when nothing has been run at all', () => {
    render(() => <RunKindPills runs={[]} />)
    for (const label of ['Practice', 'Exercise', 'Challenge', 'Weekly']) {
      expect(screen.getByText(label).previousElementSibling).toHaveTextContent(
        '0',
      )
    }
  })

  it('says the count is the whole account when it is', () => {
    render(() => <RunKindPills runs={[run('practice')]} scope="account" />)
    expect(
      screen.getByText(/across your account, on every device/i),
    ).toBeInTheDocument()
  })

  it('says the count is this device only when nobody is signed in', () => {
    // The distinction that would have answered the original report outright:
    // a zero on dev.mercurypitch.com says nothing about a prod account.
    render(() => <RunKindPills runs={[]} scope="device" />)
    expect(
      screen.getByText(/on this device only\. Sign in to count them/i),
    ).toBeInTheDocument()
  })

  it('says nothing about scope when the surface did not claim one', () => {
    render(() => <RunKindPills runs={[run('practice')]} />)
    expect(screen.queryByText(/on this device only/i)).toBeNull()
    expect(screen.queryByText(/across your account/i)).toBeNull()
  })

  it('offers the explanation where the surface can open one', () => {
    const onExplain = vi.fn()
    render(() => <RunKindPills runs={[]} onExplain={onExplain} />)

    fireEvent.click(screen.getByRole('button', { name: /what counts here/i }))
    expect(onExplain).toHaveBeenCalledTimes(1)
  })

  it('offers no explanation button where there is nowhere to open one', () => {
    render(() => <RunKindPills runs={[]} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('RunKindChip', () => {
  it('names the kind', () => {
    render(() => <RunKindChip kind="challenge" />)
    expect(screen.getByText('Challenge')).toBeInTheDocument()
  })

  it('carries the same tone class the pill for that kind carries', () => {
    // The whole point of a shared component: a colour learned on the
    // Progress card has to be the same colour in the share picker.
    const { container: chip } = render(() => <RunKindChip kind="weekly" />)
    const { container: pills } = render(() => (
      <RunKindPills runs={[run('weekly')]} />
    ))

    const toneClass = [...(chip.firstElementChild?.classList ?? [])].find(
      (name) => name.startsWith('_toneWeekly'),
    )
    expect(toneClass).toBeDefined()
    expect(
      pills.querySelector(`.${CSS.escape(toneClass as string)}`),
    ).not.toBeNull()
  })

  it('falls back to the first kind rather than rendering nothing', () => {
    // A row written before a kind was renamed still has to render a label.
    render(() => <RunKindChip kind={'nonsense' as never} />)
    expect(screen.getByText('Practice')).toBeInTheDocument()
  })
})
