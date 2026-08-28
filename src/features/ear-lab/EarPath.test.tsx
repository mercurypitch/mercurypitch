// The going train lights from the store, its Next line opens the
// instrument the first dark orb points at, and nothing is locked.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { completeCalibrationRun, recordThresholdReading, resetEarLabStore, } from '@/stores/ear-lab-store'
import { EarPath } from './EarPath'

describe('EarPath', () => {
  beforeEach(() => {
    localStorage.clear()
    resetEarLabStore()
  })
  afterEach(cleanup)

  it('starts dark, counts honestly and points at Hairline', () => {
    const onNavigate = vi.fn()
    const { container } = render(() => <EarPath onNavigate={onNavigate} />)
    expect(container.querySelectorAll('li')).toHaveLength(11)
    expect(container.querySelectorAll('li[data-lit]')).toHaveLength(0)
    expect(screen.getByTestId('ear-path-count').textContent).toBe('0 of 11 lit')
    expect(container.textContent).not.toMatch(/\d%/)
    const current = container.querySelector('[aria-current="step"]')
    expect(current?.getAttribute('aria-label')).toBe('First reading — dark')
    fireEvent.click(screen.getByTestId('ear-path-go'))
    expect(onNavigate).toHaveBeenCalledWith('hairline')
  })

  it('lights orbs as readings and seals land, and moves Next on', () => {
    const onNavigate = vi.fn()
    const { container } = render(() => <EarPath onNavigate={onNavigate} />)
    recordThresholdReading({
      drillId: 'stack',
      value: 4,
      spread: 1,
      tracks: 3,
      source: 'practice',
    })
    expect(container.querySelectorAll('li[data-lit]')).toHaveLength(1)
    expect(screen.getByTestId('ear-path-go').textContent).toBe(
      'Run Calibration',
    )
    fireEvent.click(screen.getByTestId('ear-path-go'))
    expect(onNavigate).toHaveBeenLastCalledWith('calibration')

    completeCalibrationRun([{ drillId: 'hairline', value: 8, spread: 1 }])
    const lit = [...container.querySelectorAll('li[data-lit]')].map((li) =>
      li.getAttribute('data-milestone'),
    )
    expect(lit).toEqual(['first-reading', 'first-seal', 'sealed-resolution'])
    expect(screen.getByTestId('ear-path-count').textContent).toBe('3 of 11 lit')
    // Function has no seal yet, so the train points at Home — an open
    // door, not a lock.
    expect(screen.getByTestId('ear-path-go').textContent).toBe('Open Home')
  })

  it('never locks: a dark orb further down the train opens its instrument', () => {
    const onNavigate = vi.fn()
    render(() => <EarPath onNavigate={onNavigate} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'First desk reading — dark' }),
    )
    expect(onNavigate).toHaveBeenCalledWith('desk')
  })
})
