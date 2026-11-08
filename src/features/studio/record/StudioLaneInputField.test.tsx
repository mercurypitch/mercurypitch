// Studio lane input field tests — the Studio's input comes first by its name, a pick starts the lane on its new input's default, an interface's inputs and aligned pairs show once it has opened after a default named for what it takes, a lane's input that is gone says the Studio's records, a take holds the field, and the lane header's chip brings the focus here.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InstrumentFamilyId, InstrumentGlyphId, } from '@/lib/studio/instruments/glyph-catalog'
import type { StudioLaneInput } from '@/lib/studio/record/lane-inputs'
import { FOLLOW_STUDIO_INPUT } from '@/lib/studio/record/lane-inputs'
import { fakeMidiAccess, fakeMidiInput } from './midi/fake-midi.fixture'
import type { StudioMidiAccess } from './midi/studio-midi-access'
import { createStudioMidiAccess } from './midi/studio-midi-access'
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
    inInputsView?: boolean
    onAllInputs?: () => void
    midi?: StudioMidiAccess
    instrument?: { family: InstrumentFamilyId; glyph: InstrumentGlyphId }
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
    midi:
      options.midi ??
      createStudioMidiAccess({
        request: () => Promise.resolve(fakeMidiAccess([]).access),
      }),
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
      inInputsView={options.inInputsView}
      onAllInputs={options.onAllInputs}
      instrument={options.instrument}
    />
  ))
  return { choose, setBusy, onFocused }
}

const optionTexts = (select: HTMLElement) =>
  [...(select as HTMLSelectElement).options].map((option) => option.text)

describe('Studio lane input field', () => {
  it("lists the Studio's input first, by its name, and a pick starts the lane on its new input's default", async () => {
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
      pair: false,
    })
    expect(picker).toHaveValue('scarlett')
  })

  it("offers an interface's inputs and its aligned pairs once it has opened, after the default named for what it takes", async () => {
    // Arrange
    const scarlett = {
      deviceId: 'scarlett',
      label: 'Scarlett 2i2 USB',
      channel: null,
      pair: false,
    }
    const { choose } = mount({ lane: scarlett, channels: 2 })
    const channel = screen.getByRole('combobox', { name: 'Channel' })

    // Act
    await fireEvent.change(channel, { target: { value: '2' } })
    await fireEvent.change(channel, { target: { value: '1+2' } })

    // Assert
    expect(optionTexts(channel)).toEqual([
      'Default: Inputs 1 + 2',
      'Input 1',
      'Input 2',
      'Inputs 1 + 2',
    ])
    expect(choose.mock.calls).toEqual([
      ['lane-1', { ...scarlett, channel: 1, pair: false }],
      ['lane-1', { ...scarlett, channel: 0, pair: true }],
    ])
    expect(channel).toHaveValue('1+2')
  })

  it('names the default by what it takes on a wider input, and lists only the pairs it has', () => {
    // Arrange, Act
    mount({ channels: 3 })

    // Assert
    expect(
      optionTexts(screen.getByRole('combobox', { name: 'Channel' })),
    ).toEqual([
      'Default: Input 1',
      'Input 1',
      'Input 2',
      'Input 3',
      'Inputs 1 + 2',
    ])
  })

  it('asks for one arm before it shows the channels of an input not opened yet, and shows none for a mono input', () => {
    // Arrange, Act
    mount({ channels: null })

    // Assert
    expect(screen.queryByRole('combobox', { name: 'Channel' })).toBeNull()
    expect(
      screen.getByText(
        "Arm this lane once, or check its input in Inputs, to see this input's channels.",
      ),
    ).toBeVisible()
    cleanup()

    mount({ channels: 1 })
    expect(screen.queryByRole('combobox', { name: 'Channel' })).toBeNull()
    expect(screen.queryByText(/Arm this lane once/)).toBeNull()
    cleanup()

    // The Inputs view offers the check on the input's own card.
    mount({ channels: null, inInputsView: true })
    expect(screen.queryByText(/Arm this lane once/)).toBeNull()
  })

  it('offers the way to every input where its host asks', async () => {
    // Arrange
    const onAllInputs = vi.fn()
    mount({ onAllInputs })

    // Act
    await fireEvent.click(
      screen.getByRole('button', {
        name: 'See every input, its channels and levels',
      }),
    )

    // Assert
    expect(onAllInputs).toHaveBeenCalledOnce()
    cleanup()
    mount()
    expect(screen.queryByRole('button', { name: /See every input/ })).toBeNull()
  })

  it("names the lane's input that is gone, and says the Studio's records until it is back", () => {
    // Arrange, Act
    mount({
      lane: {
        deviceId: 'gone',
        label: 'Old interface',
        channel: null,
        pair: false,
      },
    })

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

  it('lists MIDI ports as a group of their own after the audio inputs once MIDI is allowed from a press, and chooses one for the lane', async () => {
    // Arrange
    const fake = fakeMidiAccess([fakeMidiInput('keys', 'Keystation 49')])
    const request = vi.fn(() => Promise.resolve(fake.access))
    const { choose } = mount({ midi: createStudioMidiAccess({ request }) })
    const picker = screen.getByRole('combobox', { name: 'Input' })
    const before = optionTexts(picker)

    // Act
    await fireEvent.click(
      screen.getByRole('button', { name: 'Show MIDI keyboards and pads' }),
    )
    await vi.waitFor(() =>
      expect(optionTexts(picker)).toContain('Keystation 49'),
    )
    await fireEvent.change(picker, { target: { value: 'midi:keys' } })

    // Assert
    expect(request).toHaveBeenCalledOnce()
    expect(before).not.toContain('Keystation 49')
    expect(optionTexts(picker).at(-1)).toBe('Keystation 49')
    expect(picker.querySelector('optgroup')?.label).toBe('MIDI')
    expect(choose).toHaveBeenLastCalledWith('lane-1', {
      kind: 'midi',
      portId: 'keys',
      label: 'Keystation 49',
    })
  })

  it('says what a MIDI lane plays as, and offers it no channels', () => {
    // Arrange, Act
    mount({
      lane: { kind: 'midi', portId: 'keys', label: 'Keystation 49' },
      channels: 2,
      instrument: { family: 'keys', glyph: 'organ' },
    })

    // Assert
    expect(
      screen.getByText(
        'Plays as piano until this instrument has its own sound.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('combobox', { name: 'Channel' })).toBeNull()
    expect(
      (screen.getByRole('combobox', { name: 'Input' }) as HTMLSelectElement)
        .value,
    ).toBe('midi:keys')
  })

  it('says a browser without Web MIDI has no MIDI group to offer', async () => {
    // Arrange
    mount({ midi: createStudioMidiAccess({ request: () => null }) })

    // Act
    await fireEvent.click(
      screen.getByRole('button', { name: 'Show MIDI keyboards and pads' }),
    )

    // Assert
    const unavailable = screen.getByRole('option', {
      name: 'Not available in this browser',
    })
    expect(unavailable).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(
      "This browser can't use MIDI keyboards or pads.",
    )
  })
})
