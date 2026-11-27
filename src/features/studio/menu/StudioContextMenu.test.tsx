// Studio context menu tests — it takes the focus on its first item, the arrows skip what cannot be chosen, Enter chooses and closes, Escape closes, and the focus goes back where the menu was asked from.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { StudioMenuRequest } from './StudioContextMenu'
import { StudioContextMenu } from './StudioContextMenu'

function mount() {
  const origin = document.createElement('button')
  document.body.append(origin)
  const chosen = vi.fn()
  const [request, setRequest] = createSignal<StudioMenuRequest | null>({
    x: 20,
    y: 30,
    label: 'Vocal',
    returnFocus: origin,
    items: [
      {
        key: 'hear',
        label: 'Hear yourself on every lane',
        checked: false,
        select: () => chosen('hear'),
      },
      {
        key: 'arm',
        label: 'Arm for recording',
        checked: false,
        disabled: true,
        select: () => chosen('arm'),
      },
      {
        key: 'mute',
        label: 'Mute',
        shortcut: 'M',
        checked: true,
        select: () => chosen('mute'),
      },
    ],
  })
  render(() => (
    <StudioContextMenu request={request()} onClose={() => setRequest(null)} />
  ))
  return { origin, chosen, request }
}

describe('Studio context menu', () => {
  it('names itself and its items, their state and their keys', () => {
    mount()
    const menu = screen.getByRole('menu', { name: 'Vocal' })
    const items = screen.getAllByRole('menuitemcheckbox')
    expect(menu).toBeTruthy()
    expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
    ])
    expect(items[2].getAttribute('aria-keyshortcuts')).toBe('M')
    expect(items[2].textContent).toContain('M')
  })

  it('moves with the arrows past an item it cannot choose, and Enter chooses', async () => {
    const { chosen, origin, request } = mount()
    const items = screen.getAllByRole('menuitemcheckbox')
    await Promise.resolve()
    expect(document.activeElement).toBe(items[0])

    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[2])
    fireEvent.keyDown(items[2], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(items[0], { key: 'End' })
    fireEvent.click(document.activeElement!)

    expect(chosen).toHaveBeenCalledWith('mute')
    expect(request()).toBeNull()
    expect(document.activeElement).toBe(origin)
  })

  it('closes on Escape and gives the focus back', () => {
    const { chosen, origin, request } = mount()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(request()).toBeNull()
    expect(document.activeElement).toBe(origin)
    expect(chosen).not.toHaveBeenCalled()
  })
})
