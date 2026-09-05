// ============================================================
// Home pressing — accessible sides without changing the plan
// ============================================================
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { HomePressing } from './HomePressing'

describe('Home pressing', () => {
  it('flips the displayed side while preserving copyable user text', () => {
    render(() => (
      <HomePressing
        sideA="My own Pull"
        sideB="My own next step"
        paused={false}
      />
    ))
    expect(screen.getByText('My own Pull')).toHaveAttribute(
      'data-selection',
      'text',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Side B · My choice' }))
    expect(screen.getByText('My own next step')).toHaveAttribute('dir', 'auto')
    expect(
      screen.getByRole('button', { name: 'Side B · My choice' }),
    ).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Side A · The Pull' }))
    expect(screen.getByText('My own Pull')).toBeVisible()
  })
})
