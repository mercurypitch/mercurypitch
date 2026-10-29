// "Remind me tomorrow at 8:30": what is laid out, and when nothing is.
// The phone is a fake behind the bridge (NativeDeviceApi.reminders),
// which is all the Ear Lab ever reaches; the plugin's own wrappers are
// tested in packages/mobile-runtime (platform.test.ts).

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NativeDeviceApi, NativeReminder, NativeReminderPermission, NativeReminders, } from '@/stores/native-shell-store'
import { registerNativeDevice } from '@/stores/native-shell-store'
import { REMINDER } from './merc-lines'
import { REMINDER_DAYS, REMINDER_IDS, REMINDER_KEY, reminderId, reminderNote, remindersOffered, remindersOn, reminderTimes, renewReminders, resetRemindersForTests, turnRemindersOff, turnRemindersOn, } from './reminder'

interface FakePhone extends NativeReminders {
  permission: ReturnType<typeof vi.fn<() => Promise<NativeReminderPermission>>>
  ask: ReturnType<typeof vi.fn<() => Promise<NativeReminderPermission>>>
  schedule: ReturnType<
    typeof vi.fn<(reminders: readonly NativeReminder[]) => Promise<boolean>>
  >
  cancel: ReturnType<typeof vi.fn<(ids: readonly number[]) => Promise<boolean>>>
}

function fakePhone(answer: NativeReminderPermission = 'granted'): FakePhone {
  return {
    permission: vi.fn(async () => answer),
    ask: vi.fn(async () => answer),
    schedule: vi.fn(async (_reminders: readonly NativeReminder[]) => true),
    cancel: vi.fn(async (_ids: readonly number[]) => true),
  }
}

let unregister: () => void = () => undefined

function onThePhone(phone: FakePhone): FakePhone {
  unregister = registerNativeDevice({
    reminders: phone,
  } as unknown as NativeDeviceApi)
  return phone
}

/** A Thursday morning, local time, before its 8:30. */
const EARLY = new Date(2026, 9, 29, 7, 15)
/** The same Thursday, after it. */
const LATE = new Date(2026, 9, 29, 21, 40)
const at = (date: Date) => () => date

/** What the phone was given, as local "day hh:mm". */
function laidOut(phone: FakePhone, call = 0): string[] {
  const reminders = phone.schedule.mock.calls[call]?.[0] ?? []
  return reminders.map(
    (reminder) =>
      `${reminder.at.getDate()}/${reminder.at.getMonth() + 1} ${reminder.at.getHours()}:${String(reminder.at.getMinutes()).padStart(2, '0')}`,
  )
}

afterEach(async () => {
  await turnRemindersOff()
  resetRemindersForTests()
  unregister()
  localStorage.clear()
})

describe('the mornings it lays out', () => {
  it('starts tomorrow once today is done, at 8:30 for four weeks', () => {
    const times = reminderTimes(EARLY, true)

    expect(times).toHaveLength(REMINDER_DAYS)
    expect(times[0]).toEqual(new Date(2026, 9, 30, 8, 30))
    expect(times.at(-1)).toEqual(new Date(2026, 10, 26, 8, 30))
    expect(
      times.every((time) => time.getHours() === 8 && time.getMinutes() === 30),
    ).toBe(true)
  })

  it('keeps today while today is still to do and its 8:30 ahead', () => {
    expect(reminderTimes(EARLY, false)[0]).toEqual(new Date(2026, 9, 29, 8, 30))
    expect(reminderTimes(LATE, false)[0]).toEqual(new Date(2026, 9, 30, 8, 30))
  })

  it('never lays one out for a moment already gone, or nearly', () => {
    // iOS shows at once a reminder whose time has passed by the time it
    // arrives, so the minute before 8:30 starts from tomorrow as well.
    const almost = new Date(2026, 9, 29, 8, 29, 30)

    expect(reminderTimes(almost, false)[0]).toEqual(
      new Date(2026, 9, 30, 8, 30),
    )
  })

  it('gives each date its own id, from a ring the switch can cancel whole', () => {
    const ids = reminderTimes(EARLY, false).map(reminderId)

    expect(new Set(ids).size).toBe(REMINDER_DAYS)
    expect(ids.every((id) => REMINDER_IDS.includes(id))).toBe(true)
    // The same date, whatever the hour, is the same reminder.
    expect(reminderId(LATE)).toBe(reminderId(EARLY))
  })
})

describe('turning it on', () => {
  it('asks the phone, then lays out the mornings from tomorrow', async () => {
    const phone = onThePhone(fakePhone('granted'))

    await expect(turnRemindersOn(at(EARLY))).resolves.toBe('on')

    expect(phone.ask).toHaveBeenCalledTimes(1)
    expect(remindersOn()).toBe(true)
    expect(localStorage.getItem(REMINDER_KEY)).toBe('true')
    // Today's is about a day that is done: gone first, shown or not.
    expect(phone.cancel.mock.calls).toEqual([[[reminderId(EARLY)]]])
    expect(laidOut(phone)).toHaveLength(REMINDER_DAYS)
    expect(laidOut(phone)[0]).toBe('30/10 8:30')
    expect(phone.schedule.mock.calls[0]?.[0][0]).toEqual({
      id: reminderId(new Date(2026, 9, 30)),
      title: REMINDER.title,
      body: "Today's three are waiting in the Ear Lab.",
      at: new Date(2026, 9, 30, 8, 30),
    })
  })

  it.each([
    ['denied', 'refused'],
    ['prompt', 'refused'],
    ['unavailable', 'unavailable'],
  ] as const)(
    'goes back off where the phone answers %s, and says so',
    async (answer, note) => {
      const phone = onThePhone(fakePhone(answer))

      await expect(turnRemindersOn(at(EARLY))).resolves.toBe(note)

      expect(remindersOn()).toBe(false)
      expect(localStorage.getItem(REMINDER_KEY)).toBe('false')
      expect(reminderNote()).toBe(note)
      expect(phone.schedule).not.toHaveBeenCalled()
    },
  )

  it('lays nothing out when the switch was turned off while the phone asked', async () => {
    const phone = onThePhone(fakePhone())
    let answer: (state: NativeReminderPermission) => void = () => undefined
    phone.ask.mockImplementationOnce(
      async () =>
        new Promise<NativeReminderPermission>((resolve) => {
          answer = resolve
        }),
    )

    const asking = turnRemindersOn(at(EARLY))
    await turnRemindersOff()
    answer('granted')

    await expect(asking).resolves.toBeNull()
    expect(remindersOn()).toBe(false)
    expect(phone.schedule).not.toHaveBeenCalled()
  })
})

describe('turning it off', () => {
  it('takes away every reminder it could have set, shown or to come', async () => {
    const phone = onThePhone(fakePhone())
    await turnRemindersOn(at(EARLY))
    phone.cancel.mockClear()

    await turnRemindersOff()

    expect(remindersOn()).toBe(false)
    expect(localStorage.getItem(REMINDER_KEY)).toBe('false')
    expect(phone.cancel.mock.calls).toEqual([[REMINDER_IDS]])
    expect(REMINDER_IDS).toHaveLength(32)
  })
})

describe('as the Ear Lab opens', () => {
  it('touches nothing on the phone while it was never asked for', async () => {
    const phone = onThePhone(fakePhone())

    await renewReminders(false, at(EARLY))
    await renewReminders(true, at(EARLY))

    expect(phone.permission).not.toHaveBeenCalled()
    expect(phone.schedule).not.toHaveBeenCalled()
    expect(phone.cancel).not.toHaveBeenCalled()
  })

  it('lays the mornings out again, today kept while it is still to do', async () => {
    const phone = onThePhone(fakePhone())
    await turnRemindersOn(at(LATE))
    phone.schedule.mockClear()
    phone.cancel.mockClear()
    resetRemindersForTests()

    // The next morning, at 7:15, with the day's three still to do.
    const nextMorning = new Date(2026, 9, 30, 7, 15)
    await renewReminders(false, at(nextMorning))

    expect(phone.permission).toHaveBeenCalledTimes(1)
    expect(phone.cancel).not.toHaveBeenCalled()
    expect(laidOut(phone)[0]).toBe('30/10 8:30')
    expect(laidOut(phone)).toHaveLength(REMINDER_DAYS)
  })

  it("takes today's away once the day's three are done", async () => {
    const phone = onThePhone(fakePhone())
    await turnRemindersOn(at(LATE))
    resetRemindersForTests()
    const nextMorning = new Date(2026, 9, 30, 7, 15)
    await renewReminders(false, at(nextMorning))
    phone.schedule.mockClear()
    phone.cancel.mockClear()

    await renewReminders(true, at(nextMorning))

    expect(phone.cancel.mock.calls).toEqual([[[reminderId(nextMorning)]]])
    expect(laidOut(phone)[0]).toBe('31/10 8:30')
  })

  it('lays them out once a day, however often it opens', async () => {
    const phone = onThePhone(fakePhone())
    await turnRemindersOn(at(EARLY))
    phone.schedule.mockClear()

    await renewReminders(true, at(EARLY))
    await renewReminders(true, at(LATE))

    expect(phone.permission).not.toHaveBeenCalled()
    expect(phone.schedule).not.toHaveBeenCalled()
  })

  it('turns itself off where the phone has stopped allowing them', async () => {
    const phone = onThePhone(fakePhone())
    await turnRemindersOn(at(EARLY))
    resetRemindersForTests()
    phone.permission.mockResolvedValueOnce('denied')
    phone.schedule.mockClear()
    phone.cancel.mockClear()

    await renewReminders(false, at(new Date(2026, 9, 30, 7, 15)))

    expect(remindersOn()).toBe(false)
    expect(reminderNote()).toBe('refused')
    expect(phone.cancel.mock.calls).toEqual([[REMINDER_IDS]])
    expect(phone.schedule).not.toHaveBeenCalled()
  })

  it('is offered only on a phone that can set one', () => {
    expect(remindersOffered()).toBe(false)
    onThePhone(fakePhone())
    expect(remindersOffered()).toBe(true)
  })
})
