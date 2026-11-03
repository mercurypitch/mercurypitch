// Studio record settings tests — the input list names each input, picks one, says when the chosen one is gone, and holds still while a take runs.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioRecordSettings as Settings } from '@/lib/studio/record/record-settings'
import { DEFAULT_STUDIO_RECORD_SETTINGS } from '@/lib/studio/record/record-settings'
import { StudioRecordSettings } from './StudioRecordSettings'
import type { StudioRecorderHandle } from './useStudioRecorder'

afterEach(cleanup)

const input = (deviceId: string, label: string) =>
  ({ deviceId, label, kind: 'audioinput' }) as MediaDeviceInfo

function mount(
  devices: readonly MediaDeviceInfo[],
  start: Partial<Settings> = {},
) {
  const [settings, setSettings] = createSignal<Settings>({
    ...DEFAULT_STUDIO_RECORD_SETTINGS,
    ...start,
  })
  const [busy, setBusy] = createSignal(false)
  const chooseInput = vi.fn((id: string | null, label: string | null) =>
    setSettings((now) => ({ ...now, inputDeviceId: id, inputLabel: label })),
  )
  const recorder = {
    settings,
    setSettings,
    roundTrip: () => null,
    inputs: () => devices,
    inputMissing: () => false,
    chooseInput,
    busy,
  } as unknown as StudioRecorderHandle
  render(() => <StudioRecordSettings recorder={recorder} />)
  return { chooseInput, setBusy }
}

describe('Studio record input', () => {
  it('lists the default and each input by name, and records from the one picked', async () => {
    const { chooseInput } = mount([
      input('default', 'Default - Desk mic'),
      input('desk-mic', 'Desk mic'),
      input('interface-1', 'Interface In 1'),
    ])
    const picker = screen.getByRole('combobox', { name: 'Input' })
    expect(
      [...(picker as HTMLSelectElement).options].map((option) => option.text),
    ).toEqual(['Default input', 'Desk mic', 'Interface In 1'])
    expect(picker).toHaveValue('')
    await fireEvent.change(picker, { target: { value: 'interface-1' } })
    expect(chooseInput).toHaveBeenCalledWith('interface-1', 'Interface In 1')
    expect(picker).toHaveValue('interface-1')
    expect(screen.queryByText(/Arm a lane once/)).toBeNull()
  })

  it('names a chosen input that is gone and says the default records meanwhile', () => {
    mount([input('desk-mic', 'Desk mic')], {
      inputDeviceId: 'interface-1',
      inputLabel: 'Interface In 1',
    })
    expect(screen.getByRole('combobox', { name: 'Input' })).toHaveValue(
      'interface-1',
    )
    expect(
      screen.getByRole('option', { name: 'Interface In 1 (not connected)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Interface In 1 is not connected. Takes record from the default input until it is back.',
      ),
    ).toBeVisible()
  })

  it('asks for one arm before the browser names its inputs, and holds the input while a take runs', () => {
    const { setBusy } = mount([input('', '')])
    expect(
      screen.getByText(
        'Your inputs are listed by name once Studio may use the microphone. Arm a lane once to see them.',
      ),
    ).toBeVisible()
    setBusy(true)
    expect(screen.getByRole('combobox', { name: 'Input' })).toBeDisabled()
  })
})
