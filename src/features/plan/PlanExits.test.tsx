// ============================================================
// PlanExits — the way back and the way out, tapped as a person taps them
// ============================================================
//
// The two buttons are found by the name a screen reader gives them. Where
// they sit on screen is CSS, and jsdom applies none, so that is for the
// browser check; what is pinned here is which buttons exist, what they are
// called, and which handler each one runs.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlanExits } from './PlanExits'

afterEach(() => {
  cleanup()
})

const tap = (name: string): void => {
  fireEvent.click(screen.getByRole('button', { name }))
}

describe('the exits', () => {
  it('offers Not now alone when no way back is given', () => {
    render(() => <PlanExits onNotNow={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Not now' })).toHaveTextContent(
      'Not now',
    )
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('offers Back before Not now when a way back is given', () => {
    render(() => <PlanExits onBack={vi.fn()} onNotNow={vi.fn()} />)

    const names = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent)

    expect(names).toEqual(['Back', 'Not now'])
  })

  it('runs each handler once, on its own button only', () => {
    const onBack = vi.fn()
    const onNotNow = vi.fn()
    render(() => <PlanExits onBack={onBack} onNotNow={onNotNow} />)

    tap('Back')
    expect(onBack).toHaveBeenCalledOnce()
    expect(onNotNow).not.toHaveBeenCalled()

    tap('Not now')
    expect(onNotNow).toHaveBeenCalledOnce()
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('follows a way back that comes and goes', () => {
    const first = vi.fn()
    const [back, setBack] = createSignal<(() => void) | undefined>(undefined)
    render(() => <PlanExits onBack={back()} onNotNow={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()

    setBack(() => first)
    tap('Back')
    expect(first).toHaveBeenCalledOnce()

    setBack(undefined)
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
