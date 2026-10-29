// "Remind me tomorrow at 8:30" on the day's close: a switch, off until
// asked, that goes back off when the phone refuses and says where to
// turn notifications back on. The phone is a fake behind the bridge.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import type { NativeDeviceApi, NativeReminder, NativeReminderPermission, NativeShellApi, } from '@/stores/native-shell-store'
import { registerNativeDevice, registerShellApi, } from '@/stores/native-shell-store'
import { REMINDER } from './merc-lines'
import { REMINDER_IDS, REMINDER_KEY, resetRemindersForTests, turnRemindersOff, } from './reminder'
import { ReminderRow } from './ReminderRow'
import { TodayDone } from './TodayDone'

// jsdom has no WebGL: Merc is his still.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

function fakePhone(answer: NativeReminderPermission = 'granted') {
  return {
    permission: vi.fn(async () => answer),
    ask: vi.fn(async () => answer),
    schedule: vi.fn(async (_reminders: readonly NativeReminder[]) => true),
    cancel: vi.fn(async (_ids: readonly number[]) => true),
  }
}

const releases: (() => void)[] = []

function onThePhone(phone: ReturnType<typeof fakePhone>) {
  releases.push(
    registerNativeDevice({ reminders: phone } as unknown as NativeDeviceApi),
  )
  return phone
}

const theSwitch = (): HTMLElement =>
  screen.getByRole('switch', { name: 'Remind me tomorrow at 8:30' })

afterEach(async () => {
  cleanup()
  await turnRemindersOff()
  resetRemindersForTests()
  for (const release of releases.splice(0)) release()
  localStorage.clear()
})

describe("the day's close's reminder switch", () => {
  it('is a switch named for its time, off until asked', () => {
    const phone = onThePhone(fakePhone())
    render(() => <ReminderRow />)

    expect(theSwitch().getAttribute('aria-checked')).toBe('false')
    expect(theSwitch().textContent).toBe(REMINDER.label)
    expect(phone.ask).not.toHaveBeenCalled()
    expect(phone.permission).not.toHaveBeenCalled()
  })

  it('moves under the finger while the phone asks, and stays on when allowed', async () => {
    const phone = onThePhone(fakePhone())
    let answer: (state: NativeReminderPermission) => void = () => undefined
    phone.ask.mockImplementationOnce(
      async () =>
        new Promise<NativeReminderPermission>((resolve) => {
          answer = resolve
        }),
    )
    render(() => <ReminderRow />)

    fireEvent.click(theSwitch())
    expect(theSwitch().getAttribute('aria-checked')).toBe('true')
    expect(phone.ask).toHaveBeenCalledTimes(1)

    answer('granted')
    await waitFor(() => expect(phone.schedule).toHaveBeenCalledTimes(1))
    expect(theSwitch().getAttribute('aria-checked')).toBe('true')
    expect(localStorage.getItem(REMINDER_KEY)).toBe('true')
    expect(screen.getByTestId('merc-reminder-note').textContent).toBe('')
  })

  it('goes back off when refused, and says where notifications are turned on', async () => {
    onThePhone(fakePhone('denied'))
    const openAppSettings = vi.fn(async () => true)
    releases.push(
      registerShellApi({
        pushSettings: () => undefined,
        openAppSettings,
      } as unknown as NativeShellApi),
    )
    render(() => <ReminderRow />)

    fireEvent.click(theSwitch())

    await waitFor(() =>
      expect(screen.getByTestId('merc-reminder-note').textContent).toBe(
        'Notifications are off for Mercury Pitch in Settings.',
      ),
    )
    expect(theSwitch().getAttribute('aria-checked')).toBe('false')
    expect(localStorage.getItem(REMINDER_KEY)).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }))
    expect(openAppSettings).toHaveBeenCalledTimes(1)
  })

  it('turns off with a second tap, and takes every reminder away', async () => {
    const phone = onThePhone(fakePhone())
    render(() => <ReminderRow />)
    fireEvent.click(theSwitch())
    await waitFor(() => expect(phone.schedule).toHaveBeenCalledTimes(1))
    phone.cancel.mockClear()

    fireEvent.click(theSwitch())

    await waitFor(() =>
      expect(theSwitch().getAttribute('aria-checked')).toBe('false'),
    )
    expect(phone.cancel.mock.calls).toEqual([[REMINDER_IDS]])
    expect(localStorage.getItem(REMINDER_KEY)).toBe('false')
  })
})

describe("the day's close", () => {
  const close = () => (
    <TodayDone
      milestones={[]}
      litAtOpen={[]}
      onReport={() => undefined}
      onClose={() => undefined}
    />
  )

  it('carries the switch on a phone that can set a reminder, off, just above Done', () => {
    onThePhone(fakePhone())
    render(close)

    expect(theSwitch().getAttribute('aria-checked')).toBe('false')
    const after = theSwitch().compareDocumentPosition(
      screen.getByTestId('merc-day-done'),
    )
    expect(after & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('carries no switch where no reminder can be set', () => {
    render(close)

    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(screen.getByTestId('merc-day-done').textContent).toBe('Done')
  })
})
