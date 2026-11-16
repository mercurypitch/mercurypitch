// ============================================================
// stage-notice: each kind of notice as Merc's bubble draws it, and the order
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { Notification } from '@/stores/notifications-store'
import type { StageNoticeModel } from './stage-notice'
import { bubbleNotice, DISMISS_NOTICE_LABEL, linesThatFit, noticeFromNotification, noticeFromTake, } from './stage-notice'
import { takeNotice } from './take-notice'

const notice = (fields: Partial<Notification>): Notification => ({
  id: 7,
  message: 'Saved',
  type: 'info',
  ...fields,
})

const appNotice = (fields: Partial<Notification>): StageNoticeModel =>
  noticeFromNotification(notice(fields), () => undefined)

describe("an app notice in Merc's bubble", () => {
  it.each(['info', 'success', 'warning'] as const)(
    'carries its type\'s mark and tone, and is polite, as a "%s"',
    (type) => {
      const drawn = appNotice({ type })

      expect(drawn.mark).toEqual({ kind: 'type', type })
      expect(drawn.tone).toBe(type)
      expect(drawn.alert).toBe(false)
    },
  )

  it('is an alert as an error', () => {
    const drawn = appNotice({ type: 'error', message: 'Could not save.' })

    expect(drawn.alert).toBe(true)
    expect(drawn.mark).toEqual({ kind: 'type', type: 'error' })
  })

  it('says its message, with its title as the subject at its head', () => {
    const drawn = appNotice({
      type: 'warning',
      title: 'Microphone',
      message: 'Background noise is triggering false notes.',
    })

    expect(drawn.title).toBeNull()
    expect(drawn.subject).toBe('Microphone')
    expect(drawn.line).toBe('Background noise is triggering false notes.')
  })

  it('says a message alone where it has no title', () => {
    const drawn = appNotice({ message: 'Level up! This drill is now Lv 4' })

    expect(drawn.subject).toBeNull()
    expect(drawn.line).toBe('Level up! This drill is now Lv 4')
  })

  it('names one unlock under a heading, with its medallion', () => {
    const drawn = appNotice({
      type: 'success',
      message: 'New achievement: First Note',
      unlocks: [{ kind: 'achievement', name: 'First Note', icon: 'leaf' }],
    })

    expect(drawn.title).toBe('New achievement')
    expect(drawn.line).toBe('First Note')
    expect(drawn.mark).toEqual({ kind: 'art', src: '/badges/leaf.webp' })
    expect(drawn.tone).toBe('unlock')
  })

  it('names every unlock of one moment, with the first one’s medallion', () => {
    const drawn = appNotice({
      type: 'success',
      message: '2 new achievements',
      unlocks: [
        { kind: 'achievement', name: 'First Note', icon: 'leaf' },
        { kind: 'achievement', name: 'Drill Sergeant', icon: 'dumbbell' },
      ],
    })

    expect(drawn.title).toBe('2 new achievements')
    expect(drawn.line).toBe('First Note, Drill Sergeant')
    expect(drawn.mark).toEqual({ kind: 'art', src: '/badges/leaf.webp' })
  })

  it("wears the type's mark for an unlock with no medallion drawn yet", () => {
    const drawn = appNotice({
      type: 'success',
      unlocks: [{ kind: 'badge', name: 'New Thing', icon: 'not-drawn' }],
    })

    expect(drawn.mark).toEqual({ kind: 'type', type: 'success' })
  })

  it('offers its actions as capsules that act and then take it away', () => {
    const remove = vi.fn()
    const primary = vi.fn()
    const secondary = vi.fn()
    const drawn = noticeFromNotification(
      notice({
        id: 12,
        action: { label: 'Keep take', onClick: primary },
        secondaryAction: { label: 'Don’t ask again', onClick: secondary },
      }),
      remove,
    )
    expect(drawn.actions.map((a) => a.label)).toEqual([
      'Keep take',
      'Don’t ask again',
    ])

    drawn.actions[1]!.press()

    expect(secondary).toHaveBeenCalledOnce()
    expect(primary).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith(12)
  })

  it('is dismissed by its close and by its words, both taking it away', () => {
    const remove = vi.fn()
    const drawn = noticeFromNotification(notice({ id: 3 }), remove)

    drawn.close?.press()
    drawn.dismiss?.()

    expect(drawn.close?.label).toBe(DISMISS_NOTICE_LABEL)
    expect(remove.mock.calls).toEqual([[3], [3]])
  })

  it('is a new notice for each notification, by its id', () => {
    expect(appNotice({ id: 1 }).key).not.toBe(appNotice({ id: 2 }).key)
  })
})

describe("the take's notice in Merc's bubble", () => {
  const ready = takeNotice({
    keep: 'idle',
    capture: 'ready',
    storageFull: false,
    keptSeen: false,
  })!

  it('keeps its words, its Keep and its discarding close, and no dismissing words', () => {
    const keep = vi.fn()
    const close = vi.fn()
    const drawn = noticeFromTake(ready, { keep, close })
    drawn.actions[0]!.press()
    drawn.close?.press()

    expect(drawn).toMatchObject({
      key: 'take',
      source: 'take',
      testId: 'exercise-take-notice',
      title: 'Keep this take?',
      line: 'Not saved unless you keep it.',
      mark: null,
      dismiss: null,
      alert: false,
    })
    expect(drawn.close?.label).toBe('Discard take')
    expect(keep).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('is the same notice through every state of one keep', () => {
    const keeping = takeNotice({
      keep: 'saving',
      capture: 'ready',
      storageFull: false,
      keptSeen: false,
    })!
    const handlers = { keep: () => undefined, close: () => undefined }

    expect(noticeFromTake(keeping, handlers).key).toBe(
      noticeFromTake(ready, handlers).key,
    )
    expect(noticeFromTake(keeping, handlers).actions[0]?.busy).toBe(true)
  })
})

describe('what the bubble shows', () => {
  const take = noticeFromTake(
    takeNotice({
      keep: 'idle',
      capture: 'ready',
      storageFull: false,
      keptSeen: false,
    })!,
    { keep: () => undefined, close: () => undefined },
  )
  const warning = appNotice({ id: 1, type: 'warning' })
  const error = appNotice({ id: 2, type: 'error' })
  const unlock = appNotice({
    id: 3,
    type: 'success',
    unlocks: [{ kind: 'achievement', name: 'First Note' }],
  })

  it.each([
    [
      'a warning, over the example',
      { app: warning, example: true, take },
      warning,
    ],
    ['an error, over the example', { app: error, example: true, take }, error],
    [
      "the example's line, over another notice",
      { app: unlock, example: true, take },
      null,
    ],
    [
      "the example's line, over the take's",
      { app: null, example: true, take },
      null,
    ],
    [
      "another notice, over the take's",
      { app: unlock, example: false, take },
      unlock,
    ],
    [
      "the take's, when nothing else is said",
      { app: null, example: false, take },
      take,
    ],
    [
      'its own words, when nothing is said',
      { app: null, example: false, take: null },
      null,
    ],
  ] as const)('shows %s', (_name, input, shown) => {
    expect(bubbleNotice(input)).toBe(shown)
  })
})

describe('a notice over a control', () => {
  it('keeps its whole message where it ends above the control', () => {
    expect(
      linesThatFit({ height: 63, room: 78, lineHeight: 16, lines: 2 }),
    ).toBeNull()
  })

  it('keeps the lines that fit where its whole message would reach it', () => {
    expect(
      linesThatFit({ height: 110, room: 78, lineHeight: 16, lines: 4 }),
    ).toBe(2)
  })

  it('keeps one line, however little room there is', () => {
    expect(
      linesThatFit({ height: 140, room: 40, lineHeight: 16, lines: 3 }),
    ).toBe(1)
  })
})
