// ============================================================
// Premium shelf — native disclosure, readable previews, authoritative access
// ============================================================
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { createSignal, untrack } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONTENT_PACK, findPullCharacter } from '@/content'
import { PREMIUM_PULL_OPTIONS } from '@/content/premium-pulls'
import { PremiumPullChoices } from './PremiumPullChoices'

describe('Premium Pull shelf', () => {
  it('reports each unlocked selection tap, including a repeated selected radio', async () => {
    const [selected, setSelected] = createSignal<string>()
    const select = vi.fn((id: string) => setSelected(id))
    render(() => (
      <PremiumPullChoices
        options={PREMIUM_PULL_OPTIONS}
        selectedId={selected()}
        isPro
        radioName="test-pull"
        artFor={(id) => findPullCharacter(DEFAULT_CONTENT_PACK, id)!.token}
        onSelect={select}
      />
    ))
    fireEvent.click(screen.getByText('Show Deluxe'))
    const tape = await screen.findByRole('radio', { name: 'Another quick fix' })
    fireEvent.click(tape)
    fireEvent.click(tape)
    expect(select.mock.calls).toEqual([['the-tape'], ['the-tape']])
    expect(tape).toBeChecked()
    fireEvent.keyDown(tape, { key: ' ' })
    fireEvent.keyDown(tape, { key: ' ', repeat: true })
    expect(select).toHaveBeenCalledTimes(3)
  })

  it('loads no previews until expanded, then shows all eight without permitting selection', async () => {
    const select = vi.fn()
    const view = render(() => (
      <PremiumPullChoices
        options={PREMIUM_PULL_OPTIONS}
        radioName="test-pull"
        artFor={(id) => findPullCharacter(DEFAULT_CONTENT_PACK, id)!.token}
        onSelect={select}
      />
    ))
    expect(view.container.querySelectorAll('img')).toHaveLength(0)
    fireEvent.click(screen.getByText('Show Deluxe'))
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(8))
    expect(screen.getAllByRole('img')).toHaveLength(8)
    expect(screen.getByText('The Tape')).toBeVisible()
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled()
      fireEvent.change(radio, { target: { checked: true } })
    }
    expect(select).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Hide Deluxe'))
    await waitFor(() =>
      expect(view.container.querySelectorAll('img')).toHaveLength(0),
    )
  })

  it('follows live entitlement changes and never leaves a revoked radio checked', async () => {
    const [isPro, setPro] = createSignal(false)
    const [selected, setSelected] = createSignal<string>()
    render(() => (
      <PremiumPullChoices
        options={PREMIUM_PULL_OPTIONS}
        selectedId={selected()}
        isPro={isPro()}
        radioName="test-pull"
        artFor={(id) => findPullCharacter(DEFAULT_CONTENT_PACK, id)!.token}
        onSelect={setSelected}
      />
    ))
    fireEvent.click(screen.getByText('Show Deluxe'))
    await waitFor(() =>
      expect(
        screen.getByRole('radio', { name: 'Another quick fix' }),
      ).toBeDisabled(),
    )
    setPro(true)
    const tape = screen.getByRole('radio', { name: 'Another quick fix' })
    expect(tape).toBeEnabled()
    fireEvent.click(tape)
    expect(tape).toBeChecked()
    expect(untrack(selected)).toBe('the-tape')
    setPro(false)
    expect(tape).toBeDisabled()
    expect(tape).not.toBeChecked()
  })
})
