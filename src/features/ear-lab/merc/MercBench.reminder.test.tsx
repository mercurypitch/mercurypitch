// The bench lays the morning reminders out again as the Ear Lab opens,
// and takes today's away as the day's three close. Nothing at all on a
// phone where they were never asked for (reminder.test.ts holds what is
// laid out; this holds when).

import { cleanup, render, waitFor } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import { completeSprint } from '@/stores/ear-lab-store'
import type { NativeDeviceApi, NativeReminder, } from '@/stores/native-shell-store'
import { registerNativeDevice } from '@/stores/native-shell-store'
import { MercBench } from './MercBench'
import { reminderId, resetRemindersForTests, turnRemindersOff, turnRemindersOn, } from './reminder'

// jsdom has no WebGL: Merc is his still.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

const phone = {
  permission: vi.fn(async () => 'granted' as const),
  ask: vi.fn(async () => 'granted' as const),
  schedule: vi.fn(async (_reminders: readonly NativeReminder[]) => true),
  cancel: vi.fn(async (_ids: readonly number[]) => true),
}
const unregister = registerNativeDevice({
  reminders: phone,
} as unknown as NativeDeviceApi)

afterEach(async () => {
  cleanup()
  await turnRemindersOff()
  resetRemindersForTests()
  vi.clearAllMocks()
})

describe('the bench, for the morning reminders', () => {
  it('asks the phone nothing while they were never turned on', async () => {
    render(() => <MercBench onNavigate={() => undefined} />)
    await Promise.resolve()

    expect(phone.permission).not.toHaveBeenCalled()
    expect(phone.schedule).not.toHaveBeenCalled()
    expect(phone.cancel).not.toHaveBeenCalled()
  })

  it("lays them out as it opens, and takes today's away as the day closes", async () => {
    await turnRemindersOn()
    // A later opening of the app: nothing laid out in this run yet.
    resetRemindersForTests()
    vi.clearAllMocks()

    render(() => <MercBench onNavigate={() => undefined} />)
    await waitFor(() => expect(phone.schedule).toHaveBeenCalledTimes(1))
    expect(phone.permission).toHaveBeenCalledTimes(1)
    expect(phone.cancel).not.toHaveBeenCalled()

    completeSprint()

    await waitFor(() => expect(phone.schedule).toHaveBeenCalledTimes(2))
    expect(phone.cancel.mock.calls).toEqual([[[reminderId(new Date())]]])
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(phone.schedule.mock.calls[1]?.[0][0]?.at.getDate()).toBe(
      tomorrow.getDate(),
    )
    unregister()
  })
})
