// ============================================================
// UnlockChip: one badge, many, during a take and after the result
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal, Show } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { UnlockItem } from '@/stores/notifications-store'
import { notifications, onUnlockShown, resetNotifications, setNotificationPresenter, showNotification, } from '@/stores/notifications-store'
import { UnlockChip } from './UnlockChip'

const STEADY: UnlockItem = { kind: 'badge', name: 'Steady Hold', icon: 'leaf' }
const ECHO: UnlockItem = { kind: 'badge', name: 'Echo Ace', icon: 'no-art' }
const WEEK: UnlockItem = { kind: 'achievement', name: 'First Week' }

/** The grant engine's call, as it is made. */
function grant(item: UnlockItem): void {
  const word = item.kind === 'badge' ? 'Badge' : 'Achievement'
  showNotification(`${word} unlocked: ${item.name}`, 'success', {
    unlock: item,
  })
}

/** A room: its result comes and goes, and it can be left. */
function mountRoom(atResult = false) {
  const [result, setResult] = createSignal(atResult)
  const [inRoom, setInRoom] = createSignal(true)
  render(() => (
    <Show when={inRoom()}>
      <UnlockChip atResult={result()} testId="room-unlock" />
    </Show>
  ))
  return { setResult, leave: () => setInRoom(false) }
}

const chip = (): HTMLElement | null => screen.queryByTestId('room-unlock-chip')

let shown = 0
let stopListening: () => void = () => undefined

beforeEach(() => {
  resetNotifications()
  setNotificationPresenter('pill')
  shown = 0
  stopListening = onUnlockShown(() => (shown += 1))
})

afterEach(() => {
  cleanup()
  stopListening()
  resetNotifications()
})

describe('UnlockChip', () => {
  it('names one badge, with its medallion, and raises no notice', () => {
    mountRoom(true)
    grant(STEADY)
    expect(chip()?.textContent).toBe('New badge: Steady Hold')
    expect(chip()?.tagName).toBe('SPAN')
    expect(chip()?.querySelector('img')?.getAttribute('src')).toBe(
      '/badges/leaf.webp',
    )
    expect(notifications()).toHaveLength(0)
    expect(shown).toBe(1)
  })

  it('counts two or more, and a tap lists them with their names', () => {
    mountRoom(true)
    grant(STEADY)
    grant(ECHO)
    const button = chip()!
    expect(button.tagName).toBe('BUTTON')
    expect(button.textContent).toBe('2 new badges')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('room-unlock-list')).toBeNull()

    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const rows = screen.getByTestId('room-unlock-list').querySelectorAll('li')
    expect([...rows].map((row) => row.textContent)).toEqual([
      'Steady Hold',
      'Echo Ace',
    ])
    // A badge with no drawn medallion gets the plain disc instead.
    expect(rows[1]!.querySelector('img')).toBeNull()
    expect(notifications()).toHaveLength(0)
  })

  it('words a mixed set', () => {
    mountRoom(true)
    grant(STEADY)
    grant(WEEK)
    expect(chip()?.textContent).toBe('1 new badge and 1 achievement')
  })

  it('holds an unlock earned during a take until the result', () => {
    const room = mountRoom(false)
    grant(STEADY)
    expect(chip()).toBeNull()
    expect(notifications()).toHaveLength(0)
    expect(shown).toBe(0)

    room.setResult(true)
    expect(chip()?.textContent).toBe('New badge: Steady Hold')
    expect(shown).toBe(1)
  })

  it('adds one that arrives after the result to the chip already up', () => {
    const room = mountRoom(false)
    grant(STEADY)
    room.setResult(true)
    grant(WEEK)
    expect(chip()?.textContent).toBe('1 new badge and 1 achievement')
    expect(shown).toBe(2)
  })

  it('clears the chip when the next take starts', () => {
    const room = mountRoom(true)
    grant(STEADY)
    room.setResult(false)
    expect(chip()).toBeNull()
    room.setResult(true)
    expect(chip()).toBeNull()
  })

  it('leaving the room sends what it never showed to the pill', () => {
    const room = mountRoom(false)
    grant(STEADY)
    room.leave()
    expect(notifications().map((n) => n.message)).toEqual([
      'New badge: Steady Hold',
    ])
  })

  it('after leaving, an unlock still in flight falls back to the pill', () => {
    const room = mountRoom(true)
    room.leave()
    grant(ECHO)
    expect(notifications().map((n) => n.message)).toEqual([
      'New badge: Echo Ace',
    ])
  })

  it('does not re-announce what the chip already showed', () => {
    const room = mountRoom(true)
    grant(STEADY)
    room.leave()
    expect(notifications()).toHaveLength(0)
  })

  it('is a status region, always in the tree', () => {
    mountRoom(false)
    const region = screen.getByTestId('room-unlock')
    expect(region.getAttribute('role')).toBe('status')
    expect(region.childElementCount).toBe(0)
  })
})
