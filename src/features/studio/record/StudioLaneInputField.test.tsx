// Studio lane input field tests — the Studio's input comes first by its name, a pick keeps the lane on all of its new input, an interface's channels show once it has opened, a lane's input that is gone says the Studio's records, a take holds the field, and the lane header's chip brings the focus here.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioLaneInput } from '@/lib/studio/record/lane-inputs'
import { FOLLOW_STUDIO_INPUT } from '@/lib/studio/record/lane-inputs'
import type { StudioLaneInputRecorder } from './StudioLaneInputField'
import { StudioLaneInputField } from './StudioLaneInputField'

afterEach(cleanup)

const input = (deviceId: string, label: string) =>
  ({ deviceId, label, kind: 'audioinput' }) as MediaDeviceInfo

const listed = [
  input('desk', 'Desk mic'),
  input('scarlett', 'Scarlett 2i2 USB'),
]

/** The field on lane `lane-1`, with the recorder's lane inputs held in signals. */
function mount(
  options: {
    devices?: readonly MediaDeviceInfo[]
    lane?: StudioLaneInput
    channels?: number | null
    focus?: boolean
  } = {},
) {
  const [lanes, setLanes] = createSignal<ReadonlyMap<string, StudioLaneInput>>(
    new Map(options.lane === undefined ? [] : [['lane-1', options.lane]]),
  )
  const [busy, setBusy] = createSignal(false)
  const choose = vi.fn((trackId: string, next: StudioLaneInput) =>
    setLanes((now) => new Map(now).set(trackId, next)),
  )
  const onFocused = vi.fn()
  const recorder = {
    inputs: () => options.devices ?? listed,
    busy,
    laneInputs: {
      of: (trackId: string) => lanes().get(trackId) ?? FOLLOW_STUDIO_INPUT,
      choose,
      channels: () =>
        options.channels === undefined ? null : options.channels,
      studioInputName: () => 'Desk mic',
    },
  } as unknown as StudioLaneInputRecorder
  render(() => (
    <StudioLaneInputField
      trackId="lane-1"
      trackName="Guitar"
      recorder={recorder}
      focus={options.focus}
      onFocused={onFocused}
    />
  ))
  return { choose, setBusy, onFocused }
}

const optionTexts = (select: HTMLElement) =>
  [...(select as HTMLSelectElement).options].map((option) => option.text)

describe('Studio lane input field', () => {
  it("lists the Studio's input first, by its name, and a pick keeps the lane on all of its new input", async () => {
    // Arrange
    const { choose } = mount()
    const picker = screen.getByRole('combobox', { name: 'Input' })

    // Act
    await fireEvent.change(picker, { target: { value: 'scarlett' } })

    // Assert
    expect(optionTexts(picker)).toEqual([
      "Studio's input (Desk mic)",
      'Desk mic',
      'Scarlett 2i2 USB',
    ])
    expect(choose).toHaveBeenCalledExactlyOnceWith('lane-1', {
      deviceId: 'scarlett',
      label: 'Scarlett 2i2 USB',
      channel: null,
    })
    expect(picker).toHaveValue('scarlett')
  })

  it("offers an interface's channels once its input has opened, and keeps the one picked", async () => {
    // Arrange
    const { choose } = mount({
      lane: { deviceId: 'scarlett', label: 'Scarlett 2i2 USB', channel: null },
      channels: 2,
    })
    const channel = screen.getByRole('combobox', { name: 'Channel' })

    // Act
    await fireEvent.change(channel, { target: { value: '1' } })

    // Assert
    expect(optionTexts(channel)).toEqual([
      'All inputs, mixed',
      'Input 1',
      'Input 2',
    ])
    expect(choose).toHaveBeenCalledExactlyOnceWith('lane-1', {
      deviceId: 'scarlett',
      label: 'Scarlett 2i2 USB',
      channel: 1,
    })
  })

  it('asks for one arm before it shows the channels of an input not opened yet, and shows none for a mono input', () => {
    // Arrange, Act
    mount({ channels: null })

    // Assert
    expect(screen.queryByRole('combobox', { name: 'Channel' })).toBeNull()
    expect(
      screen.getByText("Arm this lane once to see this input's channels."),
    ).toBeVisible()
    cleanup()

    mount({ channels: 1 })
    expect(screen.queryByRole('combobox', { name: 'Channel' })).toBeNull()
    expect(screen.queryByText(/Arm this lane once/)).toBeNull()
  })

  it("names the lane's input that is gone, and says the Studio's records until it is back", () => {
    // Arrange, Act
    mount({ lane: { deviceId: 'gone', label: 'Old interface', channel: null } })

    // Assert
    const picker = screen.getByRole('combobox', { name: 'Input' })
    expect(picker).toHaveValue('gone')
    expect(optionTexts(picker).at(-1)).toBe('Old interface (not connected)')
    expect(screen.getByRole('status')).toHaveTextContent(
      "Old interface is not connected. Takes on Guitar record from the Studio's input until it is back.",
    )
  })

  it('holds the input and the channel while a take runs', () => {
    // Arrange
    const { setBusy } = mount({ channels: 2 })

    // Act
    setBusy(true)

    // Assert
    for (const name of ['Input', 'Channel']) {
      const select = screen.getByRole('combobox', { name })
      expect(select).toBeDisabled()
      expect(select).toHaveAttribute(
        'title',
        'Stop the take to change the input',
      )
    }
  })

  it("takes the focus when its lane's header chip opened the details", async () => {
    // Arrange, Act
    const { onFocused } = mount({ focus: true })
    await Promise.resolve()

    // Assert
    expect(screen.getByRole('combobox', { name: 'Input' })).toHaveFocus()
    expect(onFocused).toHaveBeenCalledOnce()
  })
})
