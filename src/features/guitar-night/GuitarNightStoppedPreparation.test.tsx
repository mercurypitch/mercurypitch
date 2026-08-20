import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StoppedPreparationActions } from './GuitarNightStoppedPreparation'

afterEach(cleanup)

describe('StoppedPreparationActions', () => {
  it('always offers to put the file down', () => {
    const onDiscard = vi.fn()
    render(() => <StoppedPreparationActions onDiscard={onDiscard} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove this file' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it('offers the tab that the stopped file was blocking', () => {
    const onRehearseTab = vi.fn()
    render(() => (
      <StoppedPreparationActions
        onDiscard={vi.fn()}
        onRehearseTab={onRehearseTab}
      />
    ))
    fireEvent.click(screen.getByRole('button', { name: 'Rehearse the tab' }))
    expect(onRehearseTab).toHaveBeenCalledTimes(1)
  })

  it('offers no tab when none is attached, because it would go nowhere', () => {
    render(() => <StoppedPreparationActions onDiscard={vi.fn()} />)
    expect(
      screen.queryByRole('button', { name: 'Rehearse the tab' }),
    ).toBeNull()
  })
})
