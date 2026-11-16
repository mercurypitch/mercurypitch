// ============================================================
// StageNotice: the banner over Merc's bubble, with each kind of notice
// ============================================================
//
// The take's own notice is pinned through the shell in
// ExerciseShell.notice.test.tsx; these pin the banner as the app's notices
// use it: what it carries, how a screen reader hears it, how it is
// dismissed, and how one notice gives way to the next.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Notification } from '@/stores/notifications-store'
import type { StageNoticeModel } from './stage-notice'
import { noticeFromNotification, noticeFromTake } from './stage-notice'
import { STAGE_NOTICE_EXIT_MS, StageNotice, SWIPE_DISMISS_PX, } from './StageNotice'
import { takeNotice } from './take-notice'

function pointer(type: string, clientY: number): PointerEvent {
  const event = new Event(type, { bubbles: true }) as PointerEvent
  Object.defineProperty(event, 'clientY', { value: clientY })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event
}

/** A banner showing whatever `set` puts in it; `removed` hears dismissals. */
function banner(first: Partial<Notification> | null) {
  const removed = vi.fn()
  const model = (fields: Partial<Notification>): StageNoticeModel =>
    noticeFromNotification(
      { id: 1, message: 'Saved', type: 'info', ...fields },
      removed,
    )
  const [notice, setNotice] = createSignal<StageNoticeModel | null>(
    first === null ? null : model(first),
  )
  const view = render(() => <StageNotice notice={notice} />)
  return {
    ...view,
    removed,
    set: (fields: Partial<Notification> | null) =>
      setNotice(fields === null ? null : model(fields)),
    setModel: setNotice,
    shown: () =>
      view.container.querySelectorAll<HTMLElement>(
        '[data-testid="exercise-stage-notice"]',
      ),
    words: () => view.container.querySelector<HTMLElement>('p')!,
  }
}

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('the banner with an app notice', () => {
  it("carries the type's mark, the subject, the message and a close", () => {
    const view = banner({
      type: 'warning',
      title: 'Microphone',
      message: 'Microphone is quiet.',
    })

    const [notice] = view.shown()
    expect(notice?.dataset.tone).toBe('warning')
    expect(notice?.querySelector('svg')).not.toBeNull()
    expect(notice?.querySelector('strong')?.textContent?.trim()).toBe(
      'Microphone',
    )
    expect(view.words().textContent).toBe('Microphone Microphone is quiet.')
    expect(
      view.getByRole('button', { name: 'Dismiss notification' }),
    ).toBeTruthy()
  })

  it("carries an unlock's medallion, its heading and the names", () => {
    const view = banner({
      type: 'success',
      message: '2 new achievements',
      unlocks: [
        { kind: 'achievement', name: 'First Note', icon: 'leaf' },
        { kind: 'achievement', name: 'Drill Sergeant', icon: 'dumbbell' },
      ],
    })

    const [notice] = view.shown()
    expect(notice?.dataset.tone).toBe('unlock')
    expect(notice?.querySelector('img')?.getAttribute('src')).toBe(
      '/badges/leaf.webp',
    )
    expect(view.words().textContent).toBe(
      '2 new achievementsFirst Note, Drill Sergeant',
    )
  })

  it('offers two actions as capsules, the first filled and the second quiet', () => {
    const onKeep = vi.fn()
    const view = banner({
      action: { label: 'Keep take', onClick: onKeep },
      secondaryAction: { label: 'Don’t ask again', onClick: () => undefined },
    })

    const keep = view.getByRole('button', { name: 'Keep take' })
    const quiet = view.getByRole('button', { name: 'Don’t ask again' })
    expect(keep.className).not.toBe(quiet.className)
    fireEvent.click(keep)

    expect(onKeep).toHaveBeenCalledOnce()
    expect(view.removed).toHaveBeenCalledWith(1)
  })

  it('is heard politely, in a region there for the whole visit', () => {
    const view = banner({ type: 'success', message: 'Level up!' })

    const region = view.shown()[0]!.closest('[aria-live="polite"]')
    expect(region?.getAttribute('role')).toBe('status')
    expect(view.shown()[0]!.getAttribute('role')).toBeNull()
  })

  it('is an alert as an error, outside the polite region', () => {
    const view = banner({ type: 'error', message: 'Could not save.' })

    const [notice] = view.shown()
    expect(notice?.getAttribute('role')).toBe('alert')
    expect(notice?.closest('[aria-live="polite"]')).toBeNull()
  })

  it('never takes the focus', () => {
    const view = banner(null)
    const before = document.activeElement

    view.set({
      type: 'error',
      message: 'Could not save.',
      action: { label: 'Retry', onClick: () => undefined },
    })

    expect(view.shown()).toHaveLength(1)
    expect(document.activeElement).toBe(before)
  })
})

describe('dismissing it', () => {
  it('takes a tap on its words', () => {
    const view = banner({ message: 'Level up!' })

    fireEvent.click(view.words())

    expect(view.removed).toHaveBeenCalledWith(1)
  })

  it('takes an upward swipe, and lets a short drag spring back', () => {
    const view = banner({ message: 'Level up!' })
    const words = view.words()

    words.dispatchEvent(pointer('pointerdown', 100))
    words.dispatchEvent(pointer('pointermove', 100 - SWIPE_DISMISS_PX + 4))
    words.dispatchEvent(pointer('pointerup', 100 - SWIPE_DISMISS_PX + 4))
    // The click a browser sends after a drag is not a tap.
    words.click()
    expect(view.removed).not.toHaveBeenCalled()
    expect(view.shown()[0]!.style.getPropertyValue('--notice-drag')).toBe('0px')

    words.dispatchEvent(pointer('pointerdown', 100))
    words.dispatchEvent(pointer('pointermove', 100 - SWIPE_DISMISS_PX - 6))
    words.dispatchEvent(pointer('pointerup', 100 - SWIPE_DISMISS_PX - 6))
    expect(view.removed).toHaveBeenCalledOnce()
  })

  it("leaves the take's words alone: its close is what throws a take away", () => {
    const keep = vi.fn()
    const close = vi.fn()
    const take = noticeFromTake(
      takeNotice({
        keep: 'idle',
        capture: 'ready',
        storageFull: false,
        keptSeen: false,
      })!,
      { keep, close },
    )
    const view = render(() => <StageNotice notice={() => take} />)
    const words = view.container.querySelector<HTMLElement>('p')!

    fireEvent.click(words)
    words.dispatchEvent(pointer('pointerdown', 100))
    words.dispatchEvent(pointer('pointermove', 40))
    words.dispatchEvent(pointer('pointerup', 40))

    expect(close).not.toHaveBeenCalled()
    expect(keep).not.toHaveBeenCalled()
  })
})

describe('one notice after another', () => {
  it('pops the next in over the last as that one leaves', () => {
    vi.useFakeTimers()
    const view = banner({ id: 1, message: 'Saved' })

    view.set({ id: 2, message: 'Synced' })

    const shown = view.shown()
    expect(shown).toHaveLength(2)
    expect(shown[0]!.textContent).toContain('Saved')
    expect(shown[0]!.className).toMatch(/leaving/)
    expect(shown[1]!.textContent).toContain('Synced')
    vi.advanceTimersByTime(STAGE_NOTICE_EXIT_MS)
    expect(view.shown()).toHaveLength(1)
    expect(view.shown()[0]!.textContent).toContain('Synced')
  })

  it('changes the same notice in place, as a merged set of unlocks grows', () => {
    const view = banner({
      id: 4,
      type: 'success',
      unlocks: [{ kind: 'achievement', name: 'First Note' }],
    })
    const first = view.shown()[0]

    view.set({
      id: 4,
      type: 'success',
      unlocks: [
        { kind: 'achievement', name: 'First Note' },
        { kind: 'achievement', name: 'Drill Sergeant' },
      ],
    })

    expect(view.shown()).toHaveLength(1)
    expect(view.shown()[0]).toBe(first)
    expect(first?.textContent).toContain('First Note, Drill Sergeant')
  })

  it('leaves, and is gone once its exit has played', () => {
    vi.useFakeTimers()
    const view = banner({ message: 'Saved' })

    view.set(null)
    expect(view.shown()[0]!.className).toMatch(/leaving/)
    vi.advanceTimersByTime(STAGE_NOTICE_EXIT_MS)

    expect(view.shown()).toHaveLength(0)
  })
})
