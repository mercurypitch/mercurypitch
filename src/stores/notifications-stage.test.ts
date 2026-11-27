// ============================================================
// The notifications store on a drill's stage
// ============================================================
//
// While a drill's stage presents the notices (`presentNoticesOnStage`), the
// store shows one at a time and merges unlocks of one moment, as under the
// native pill; it puts a warning or an error before anything calmer, keeps
// the calmer ones back while the stage is quiet (a run, an example), and
// never lets a waiting notice run out its time unseen. While a take's
// question has Merc's bubble, every notice but an achievement is a toast at
// once, and achievements wait for the bubble. Released, it hands whatever
// is still waiting back to the toasts, in order.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UnlockItem } from '@/stores/notifications-store'
import { notificationPresenter, notifications, presentNoticesOnStage, removeNotification, resetNotifications, setNotificationPresenter, setStageQuiet, setStageTakeHolds, showActionNotification, showNotification, toastsBesideStage, } from '@/stores/notifications-store'

const viewport = vi.hoisted(() => ({
  setNarrow: (_narrow: boolean): void => undefined,
}))
vi.mock('@/lib/use-viewport', async () => {
  const { createSignal } = await import('solid-js')
  const [narrow, setNarrow] = createSignal(true)
  viewport.setNarrow = setNarrow
  // The store asks for a phone's layout (isPhoneStage) about its cap.
  return { isNarrow: narrow, isPhoneStage: narrow }
})

const FIRST_NOTE: UnlockItem = {
  kind: 'achievement',
  name: 'First Note',
  icon: 'leaf',
}
const DRILL_SERGEANT: UnlockItem = {
  kind: 'achievement',
  name: 'Drill Sergeant',
  icon: 'dumbbell',
}

/** What the grant engine does for one unlock. */
function grant(item: UnlockItem): void {
  showNotification(`Achievement unlocked: ${item.name}`, 'success', {
    unlock: item,
  })
}

const messages = (): string[] => notifications().map((n) => n.message)

let release: () => void = () => undefined

beforeEach(() => {
  vi.useFakeTimers()
  resetNotifications()
  viewport.setNarrow(true)
})

afterEach(() => {
  release()
  resetNotifications()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('a drill stage presenting the notices', () => {
  it('takes them from the toasts while it is on screen', () => {
    release = presentNoticesOnStage()
    expect(notificationPresenter()).toBe('stage')

    release()
    expect(notificationPresenter()).toBe('toast')
  })

  it('shows one at a time, whatever the width, and queues the rest', () => {
    viewport.setNarrow(false)
    release = presentNoticesOnStage()
    showNotification('Saved', 'success')
    showNotification('Synced', 'info')

    expect(messages()).toEqual(['Saved'])
    vi.advanceTimersByTime(6000)
    expect(messages()).toEqual(['Synced'])
  })

  it("merges the unlocks of one moment into one notice that names them, as the pill's", () => {
    release = presentNoticesOnStage()
    grant(FIRST_NOTE)
    grant(DRILL_SERGEANT)

    expect(notifications()).toHaveLength(1)
    expect(notifications()[0]!.message).toBe('2 new achievements')
    expect(notifications()[0]!.unlocks).toEqual([FIRST_NOTE, DRILL_SERGEANT])
  })

  it('puts a warning before a calmer notice on screen, which then has what was left of its time', () => {
    release = presentNoticesOnStage()
    showNotification('Level up! This drill is now Lv 4', 'success')
    vi.advanceTimersByTime(2000)

    showNotification('Microphone is quiet.', 'warning')
    expect(messages()).toEqual(['Microphone is quiet.'])

    vi.advanceTimersByTime(9000)
    expect(messages()).toEqual(['Level up! This drill is now Lv 4'])
    vi.advanceTimersByTime(3999)
    expect(messages()).toEqual(['Level up! This drill is now Lv 4'])
    vi.advanceTimersByTime(1)
    expect(messages()).toEqual([])
  })

  it('takes a waiting error before an earlier calmer notice', () => {
    release = presentNoticesOnStage()
    showNotification('Saved', 'success')
    showNotification('Synced', 'info')
    showNotification('Could not save the run.', 'error')

    expect(messages()).toEqual(['Could not save the run.'])
    removeNotification(notifications()[0]!.id)
    expect(messages()).toEqual(['Saved'])
    removeNotification(notifications()[0]!.id)
    expect(messages()).toEqual(['Synced'])
  })
})

describe('a quiet stage', () => {
  it('shows a warning or an error during a run, and holds the others back', () => {
    release = presentNoticesOnStage()
    setStageQuiet(true)
    grant(FIRST_NOTE)
    showActionNotification(
      'Background noise is triggering false notes.',
      'warning',
      { label: 'Open mic settings', onClick: () => undefined },
    )

    expect(messages()).toEqual(['Background noise is triggering false notes.'])
    removeNotification(notifications()[0]!.id)
    expect(messages()).toEqual([])
  })

  it('does not let a held notice run out its time unseen', () => {
    release = presentNoticesOnStage()
    setStageQuiet(true)
    showNotification('Level up! This drill is now Lv 4', 'success')
    vi.advanceTimersByTime(60_000)
    expect(messages()).toEqual([])

    setStageQuiet(false)
    expect(messages()).toEqual(['Level up! This drill is now Lv 4'])
    vi.advanceTimersByTime(5999)
    expect(messages()).toEqual(['Level up! This drill is now Lv 4'])
    vi.advanceTimersByTime(1)
    expect(messages()).toEqual([])
  })

  it('puts a calmer notice on screen back to wait, and brings it back after', () => {
    release = presentNoticesOnStage()
    showNotification('Synced', 'info')
    vi.advanceTimersByTime(4000)

    setStageQuiet(true)
    expect(messages()).toEqual([])
    vi.advanceTimersByTime(30_000)

    setStageQuiet(false)
    expect(messages()).toEqual(['Synced'])
    vi.advanceTimersByTime(2499)
    expect(messages()).toEqual(['Synced'])
    vi.advanceTimersByTime(1)
    expect(messages()).toEqual([])
  })

  it('leaves a warning on screen when it falls quiet', () => {
    release = presentNoticesOnStage()
    showNotification('Microphone is quiet.', 'warning')

    setStageQuiet(true)

    expect(messages()).toEqual(['Microphone is quiet.'])
  })
})

describe('leaving the stage', () => {
  it('hands every waiting notice back to the toasts, in order', () => {
    release = presentNoticesOnStage()
    setStageQuiet(true)
    showNotification('One', 'info')
    showNotification('Two', 'info')
    showNotification('Three', 'info')
    expect(messages()).toEqual([])

    release()

    // A phone shows two toasts at once; the third waits its turn.
    expect(notificationPresenter()).toBe('toast')
    expect(messages()).toEqual(['One', 'Two'])
    removeNotification(notifications()[0]!.id)
    expect(messages()).toEqual(['Two', 'Three'])
  })

  it('stops being quiet, so the toasts are not held back', () => {
    release = presentNoticesOnStage()
    setStageQuiet(true)
    release()

    showNotification('Saved', 'success')

    expect(messages()).toEqual(['Saved'])
  })

  it('lasts while another stage still holds it', () => {
    const first = presentNoticesOnStage()
    release = presentNoticesOnStage()

    first()
    first()

    expect(notificationPresenter()).toBe('stage')
  })
})

describe("while a take's question has Merc's bubble", () => {
  it('shows every notice but an achievement at once, as a toast, a warning too', () => {
    release = presentNoticesOnStage()
    setStageTakeHolds(true)

    showNotification('Synced', 'info')
    showNotification('Microphone disconnected.', 'warning')

    expect(notificationPresenter()).toBe('toast')
    expect(messages()).toEqual(['Synced', 'Microphone disconnected.'])
  })

  it('shows a notice at once even while a calmer one waits for a run', () => {
    release = presentNoticesOnStage()
    setStageQuiet(true)
    showNotification('Synced', 'info')
    expect(messages()).toEqual([])

    setStageQuiet(false)
    setStageTakeHolds(true)

    expect(messages()).toEqual(['Synced'])
  })

  it('holds the achievements back, merged, with their time not running, and puts them in the bubble once it lets go', () => {
    release = presentNoticesOnStage()
    setStageTakeHolds(true)
    grant(FIRST_NOTE)
    grant(DRILL_SERGEANT)
    showNotification('Synced', 'info')
    expect(messages()).toEqual(['Synced'])

    vi.advanceTimersByTime(60_000)
    setStageTakeHolds(false)

    expect(notificationPresenter()).toBe('stage')
    expect(messages()).toEqual(['2 new achievements'])
    expect(notifications()[0]!.unlocks).toEqual([FIRST_NOTE, DRILL_SERGEANT])
  })

  it('keeps a toast it let through a toast until its time is up, and gives the bubble to the achievements at once', () => {
    release = presentNoticesOnStage()
    setStageTakeHolds(true)
    grant(FIRST_NOTE)
    showNotification('Synced', 'info', { durationMs: 8000 })

    vi.advanceTimersByTime(3000)
    setStageTakeHolds(false)

    expect(messages()).toEqual(['New achievement: First Note'])
    expect(toastsBesideStage().map((n) => n.message)).toEqual(['Synced'])

    vi.advanceTimersByTime(5000)
    expect(toastsBesideStage()).toEqual([])
    expect(messages()).toEqual(['New achievement: First Note'])
  })

  it('hands a toast beside the bubble back to the toasts when the drill is left', () => {
    release = presentNoticesOnStage()
    setStageTakeHolds(true)
    showNotification('Synced', 'info')
    setStageTakeHolds(false)

    release()

    expect(toastsBesideStage()).toEqual([])
    expect(messages()).toEqual(['Synced'])
  })

  it('sends an achievement on screen back to wait, and brings it back after', () => {
    release = presentNoticesOnStage()
    grant(FIRST_NOTE)
    expect(messages()).toEqual(['New achievement: First Note'])

    setStageTakeHolds(true)
    expect(messages()).toEqual([])

    setStageTakeHolds(false)
    expect(messages()).toEqual(['New achievement: First Note'])
  })

  it('hands a held achievement to the toasts when the drill is left', () => {
    release = presentNoticesOnStage()
    setStageTakeHolds(true)
    grant(FIRST_NOTE)

    release()

    expect(notificationPresenter()).toBe('toast')
    expect(messages()).toHaveLength(1)
    expect(notifications()[0]!.unlocks).toEqual([FIRST_NOTE])
  })
})

describe('under the native pill', () => {
  it('leaves the pill in place: the native app has its own place for notices', () => {
    setNotificationPresenter('pill')
    release = presentNoticesOnStage()
    setStageQuiet(true)
    showNotification('Saved', 'success')

    expect(notificationPresenter()).toBe('pill')
    expect(messages()).toEqual(['Saved'])
  })
})
