// ============================================================
// NoticePill: one notice at a time, merged unlocks, tap and swipe
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UnlockItem } from '@/stores/notifications-store'
import { notifications, onUnlockShown, resetNotifications, setNotificationPresenter, showActionNotification, showNotification, } from '@/stores/notifications-store'
import { NoticePill } from './NoticePill'
import { renderShell } from './render-for-test'

const STEADY: UnlockItem = { kind: 'badge', name: 'Steady Hold', icon: 'leaf' }
const ECHO: UnlockItem = { kind: 'badge', name: 'Echo Ace', icon: 'star' }

function grant(item: UnlockItem): void {
  showNotification(`Badge unlocked: ${item.name}`, 'success', { unlock: item })
}

let unmount: (() => void) | null = null
let shown = 0
let stop: () => void = () => undefined

function mount(): HTMLElement {
  const rendered = renderShell(() => <NoticePill />)
  unmount = rendered.unmount
  return rendered.container
}

const pill = (): HTMLElement | null =>
  document.querySelector('[data-testid="notice-pill"]')
const body = (): HTMLElement =>
  document.querySelector<HTMLElement>('[data-testid="notice-pill-body"]')!

function pointer(type: string, clientY: number): PointerEvent {
  const event = new Event(type, { bubbles: true }) as PointerEvent
  Object.defineProperty(event, 'clientY', { value: clientY })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event
}

beforeEach(() => {
  vi.useFakeTimers()
  resetNotifications()
  setNotificationPresenter('pill')
  shown = 0
  stop = onUnlockShown(() => (shown += 1))
})

afterEach(() => {
  unmount?.()
  unmount = null
  stop()
  resetNotifications()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('NoticePill', () => {
  it('draws nothing while there is no notice, and keeps its status region', () => {
    const container = mount()
    expect(pill()).toBeNull()
    expect(container.querySelector('[role="status"]')).not.toBeNull()
  })

  it('shows one notice at a time, the next when it goes', () => {
    mount()
    showNotification('Saved to your library', 'success')
    showNotification('You are offline', 'warning')
    expect(pill()?.textContent).toBe('Saved to your library')

    body().click()
    vi.advanceTimersByTime(200)
    expect(pill()?.textContent).toBe('You are offline')
    expect(pill()?.getAttribute('data-notice-type')).toBe('warning')
  })

  it('merges unlocks from the same moment, names on a second line', () => {
    mount()
    grant(STEADY)
    grant(ECHO)
    expect(
      document.querySelectorAll('[data-testid="notice-pill"]'),
    ).toHaveLength(1)
    expect(pill()?.getAttribute('data-unlock')).toBe('on')
    const names = document.querySelector('[data-testid="notice-pill-names"]')
    expect(names?.textContent).toBe('Steady Hold, Echo Ace')
    expect(body().textContent).toBe('2 new badgesSteady Hold, Echo Ace')
    // The first unlock's medallion leads the pill.
    expect(pill()?.querySelector('img')?.getAttribute('src')).toBe(
      '/badges/leaf.webp',
    )
    // One tap you can feel for the pill, not one per unlock merged into it.
    expect(shown).toBe(1)
  })

  it('names a single unlock and gives it no second line', () => {
    mount()
    grant(STEADY)
    expect(body().textContent).toBe('New badge: Steady Hold')
    expect(
      document.querySelector('[data-testid="notice-pill-names"]'),
    ).toBeNull()
  })

  it('is dismissed by a tap', () => {
    mount()
    showNotification('Saved', 'success')
    body().click()
    expect(notifications()).toHaveLength(0)
    expect(pill()?.classList.contains('is-leaving')).toBe(true)
    vi.advanceTimersByTime(200)
    expect(pill()).toBeNull()
  })

  it('is dismissed by a swipe up, and a short drag springs back', () => {
    mount()
    showNotification('Saved', 'success')

    body().dispatchEvent(pointer('pointerdown', 100))
    body().dispatchEvent(pointer('pointermove', 90))
    body().dispatchEvent(pointer('pointerup', 90))
    expect(notifications()).toHaveLength(1)

    body().dispatchEvent(pointer('pointerdown', 100))
    body().dispatchEvent(pointer('pointermove', 60))
    body().dispatchEvent(pointer('pointerup', 60))
    expect(notifications()).toHaveLength(0)
  })

  it('a swipe does not also count as a tap on the next notice', () => {
    mount()
    showNotification('One', 'info')
    showNotification('Two', 'info')
    body().dispatchEvent(pointer('pointerdown', 100))
    body().dispatchEvent(pointer('pointermove', 50))
    body().dispatchEvent(pointer('pointerup', 50))
    // The click a browser sends after the drag lands on the pill's body.
    body().click()
    vi.advanceTimersByTime(200)
    expect(notifications().map((n) => n.message)).toEqual(['Two'])
  })

  it('keeps an action as a 44 px button that acts and dismisses', () => {
    mount()
    const onClick = vi.fn()
    showActionNotification('New to Piano?', 'info', {
      label: 'Start tour',
      onClick,
    })
    const action = document.querySelector<HTMLButtonElement>(
      '[data-testid="notice-pill-action"]',
    )!
    expect(action.textContent).toBe('Start tour')
    expect(action.classList.contains('mp-notice-pill__action')).toBe(true)
    action.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(notifications()).toHaveLength(0)
  })

  it('makes an error an alert, and anything else part of the status region', () => {
    mount()
    showNotification('Could not save', 'error')
    expect(pill()?.getAttribute('role')).toBe('alert')
    body().click()
    vi.advanceTimersByTime(200)
    showNotification('Saved', 'success')
    expect(pill()?.getAttribute('role')).toBeNull()
    expect(pill()?.closest('[role="status"]')).not.toBeNull()
  })
})
