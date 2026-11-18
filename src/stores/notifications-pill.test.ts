// ============================================================
// The notifications store under a room's pill, on the web
// ============================================================
//
// A room on the web (the Exercises tab's, or Merc's in the Ear Lab) holds
// the notices in the pill under its bar while it is up
// (`presentNoticesInPill`): one at a time, unlocks of one moment merged, no
// toast. A drill's stage holds them too (`presentNoticesOnStage`), and the
// Exercises page can show a stage and then a room, so the two holds are
// tested against each other: the room's outranks the stage's whichever came
// first, and the last one let go hands what still waits to whichever hold
// is left, or to the toasts, in order. The native shell's pill outranks
// both.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UnlockItem } from '@/stores/notifications-store'
import { noticePillCeiling, notificationPresenter, notifications, presentNoticesInPill, presentNoticesOnStage, removeNotification, resetNotifications, setNotificationPresenter, setStageQuiet, showActionNotification, showNotification, } from '@/stores/notifications-store'

vi.mock('@/lib/use-viewport', async () => {
  const { createSignal } = await import('solid-js')
  const [narrow] = createSignal(true)
  return { isNarrow: narrow }
})

const STEADY: UnlockItem = { kind: 'badge', name: 'Steady Hold', icon: 'leaf' }
const ECHO: UnlockItem = { kind: 'badge', name: 'Echo Ace', icon: 'star' }

/** What the grant engine does for one unlock. */
function grant(item: UnlockItem): void {
  showNotification(`Badge unlocked: ${item.name}`, 'success', { unlock: item })
}

const messages = (): string[] => notifications().map((n) => n.message)

/** A room's bar, and a second room's over it. */
const bar = document.createElement('div')
const otherBar = document.createElement('div')

/** Every hold a test took, let go after it if it did not let go itself. */
const holds: Array<() => void> = []

function hold(take: () => () => void): () => void {
  const release = take()
  holds.push(release)
  return release
}
const room = (under: Element = bar) =>
  hold(() => presentNoticesInPill(() => under))
const stage = () => hold(presentNoticesOnStage)

beforeEach(() => {
  vi.useFakeTimers()
  resetNotifications()
})

afterEach(() => {
  for (const release of holds.splice(0)) release()
  resetNotifications()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('a room holding the pill', () => {
  it('takes the notices from the toasts while it is up, under its bar', () => {
    const release = room()
    expect(notificationPresenter()).toBe('pill')
    expect(noticePillCeiling()).toBe(bar)

    release()
    expect(notificationPresenter()).toBe('toast')
    expect(noticePillCeiling()).toBeNull()
  })

  it('shows one at a time, two unlocks of one moment as one, an error after', () => {
    room()
    grant(STEADY)
    grant(ECHO)
    showActionNotification('Could not save the take', 'error', {
      label: 'Retry',
      onClick: () => undefined,
    })

    expect(messages()).toEqual(['2 new badges'])
    expect(notifications()[0]!.unlocks?.map((u) => u.name)).toEqual([
      'Steady Hold',
      'Echo Ace',
    ])
    removeNotification(notifications()[0]!.id)
    expect(messages()).toEqual(['Could not save the take'])
  })

  it('takes a toast already up into the pill, and queues the second', () => {
    showNotification('One', 'info')
    showNotification('Two', 'info')
    expect(messages()).toEqual(['One', 'Two'])

    room()

    expect(messages()).toEqual(['One'])
    removeNotification(notifications()[0]!.id)
    expect(messages()).toEqual(['Two'])
  })

  it('hands every waiting notice back to the toasts when it goes, in order', () => {
    const release = room()
    showNotification('One', 'info')
    showNotification('Two', 'info')
    showNotification('Three', 'info')
    expect(messages()).toEqual(['One'])

    release()

    // A phone shows two toasts at once; the third waits its turn.
    expect(notificationPresenter()).toBe('toast')
    expect(messages()).toEqual(['One', 'Two'])
    removeNotification(notifications()[0]!.id)
    expect(messages()).toEqual(['Two', 'Three'])
  })

  it('is let go once, however often its release is called', () => {
    const first = room()
    room(otherBar)

    first()
    first()

    expect(notificationPresenter()).toBe('pill')
  })
})

describe('two rooms, one over the other', () => {
  it('sits under the bar of the room on top, then of the one under it', () => {
    room(bar)
    const over = room(otherBar)
    expect(noticePillCeiling()).toBe(otherBar)

    over()

    expect(notificationPresenter()).toBe('pill')
    expect(noticePillCeiling()).toBe(bar)
  })

  it('keeps the room on top when the one under it goes first', () => {
    const under = room(bar)
    room(otherBar)

    under()

    expect(noticePillCeiling()).toBe(otherBar)
  })
})

describe("a room and a drill's stage", () => {
  it('a room opened over a stage takes the notices, and gives them back to it', () => {
    stage()
    showNotification('Calm', 'info')
    const leave = room()
    expect(notificationPresenter()).toBe('pill')
    // The stage is quiet under the room (a run); the pill does not hold
    // back what is calmer, since the stage is not what is seen.
    setStageQuiet(true)
    showNotification('Saved', 'success')
    showNotification('Microphone is quiet.', 'warning')
    expect(messages()).toEqual(['Calm'])

    leave()

    // The stage again, in its own order: during a run, a warning alone.
    expect(notificationPresenter()).toBe('stage')
    expect(messages()).toEqual(['Microphone is quiet.'])
    expect(noticePillCeiling()).toBeNull()
  })

  it('a stage that comes under an open room waits, and the room keeps them', () => {
    const leave = room()
    const drill = stage()
    expect(notificationPresenter()).toBe('pill')

    drill()
    expect(notificationPresenter()).toBe('pill')
    expect(noticePillCeiling()).toBe(bar)

    leave()
    expect(notificationPresenter()).toBe('toast')
  })

  it('a stage held and let go while a room is up changes nothing', () => {
    const leave = room()
    showNotification('One', 'info')
    showNotification('Two', 'info')
    const drill = stage()
    setStageQuiet(true)
    drill()

    expect(notificationPresenter()).toBe('pill')
    expect(messages()).toEqual(['One'])

    leave()
    // The stage's quiet went with it: the toasts hold nothing back.
    expect(messages()).toEqual(['One', 'Two'])
  })

  it('a room that goes while the stage is still up leaves it the notices', () => {
    const drill = stage()
    const leave = room()
    leave()
    expect(notificationPresenter()).toBe('stage')

    drill()
    expect(notificationPresenter()).toBe('toast')
  })
})

describe("under the native shell's pill", () => {
  it('changes nothing, and gives the pill no bar to sit under', () => {
    setNotificationPresenter('pill')
    const leave = room()
    expect(notificationPresenter()).toBe('pill')
    expect(noticePillCeiling()).toBeNull()

    leave()
    expect(notificationPresenter()).toBe('pill')
  })
})
