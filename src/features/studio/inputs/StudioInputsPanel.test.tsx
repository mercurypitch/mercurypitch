// Studio Inputs view tests — before the browser names its inputs the view offers one action, which asks through MicManager and lists the inputs again; then each input shows as a card with its kind, channels, round trip, warning, rows and lanes; a check opens an input and its rows' meters read, while an arm leaves Check off; and every lane has its input picker.
import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { audioInput } from '@/lib/audio-input/fake-devices.fixture'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
import type { InputChannelCount, StudioLaneInput, } from '@/lib/studio/record/lane-inputs'
import { FOLLOW_STUDIO_INPUT } from '@/lib/studio/record/lane-inputs'
import type { StudioRecordPhase } from '@/lib/studio/record/studio-recorder'
import { fakeMidiAccess, fakeMidiInput } from '../record/midi/fake-midi.fixture'
import type { StudioMidiAccess } from '../record/midi/studio-midi-access'
import { createStudioMidiAccess } from '../record/midi/studio-midi-access'
import type { StudioInputsPanelProps } from './StudioInputsPanel'
import { StudioInputsPanel } from './StudioInputsPanel'

const mic = vi.hoisted(() => ({
  acquireFrom: vi.fn(),
  release: vi.fn(),
}))
vi.mock('@/lib/mic-manager', () => ({
  micManager: {
    acquireFrom: mic.acquireFrom,
    subscribe: () => () => undefined,
    getPreferredDevice: () => null,
    getResolvedDevice: () => null,
  },
}))
vi.mock('@/lib/mic-sentinel', () => ({
  registerMicIndicator: () => () => undefined,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

const named = [
  audioInput('default', 'Default - Desk mic', 'desk'),
  audioInput('desk', 'Desk mic'),
  audioInput('scarlett', 'Scarlett 2i2 USB'),
  audioInput('airpods', 'AirPods Pro (Bluetooth)'),
]

/** A context whose analysers each read a steady level, in the order they are made. */
function fakeContext(levels: number[]) {
  let made = 0
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() })
  return {
    state: 'running',
    destination: node(),
    createMediaStreamSource: () => node(),
    createChannelSplitter: () => node(),
    createGain: () => ({ ...node(), gain: { value: 1 } }),
    createAnalyser: () => {
      const level = levels[made++] ?? 0
      return {
        ...node(),
        fftSize: 1024,
        getFloatTimeDomainData: (block: Float32Array) => block.fill(level),
      }
    },
  } as unknown as AudioContext
}

function mount(
  options: {
    devices?: MediaDeviceInfo[]
    phase?: StudioRecordPhase
    counts?: InputChannelCount[]
    lanes?: Record<string, StudioLaneInput>
    levels?: number[]
    midi?: StudioMidiAccess
  } = {},
) {
  const [phase, setPhase] = createSignal<StudioRecordPhase>(
    options.phase ?? 'idle',
  )
  const [counts, setCounts] = createSignal(options.counts ?? [])
  const refreshInputs = vi.fn(async () => undefined)
  const project = {
    ...createStudioProject({ id: 'song' }),
    tracks: [
      createStudioTrack({ id: 'gtr', name: 'Guitar', order: 0 }),
      createStudioTrack({ id: 'vox', name: 'Vocal', order: 1 }),
    ],
  }
  const recorder = {
    inputs: () => options.devices ?? named,
    refreshInputs,
    busy: () => false,
    phase,
    inputTap: () => null,
    midi: options.midi ?? createStudioMidiAccess({ request: () => null }),
    settings: () => ({ inputDeviceId: null, inputLabel: null }),
    laneInputs: {
      of: (id: string) => options.lanes?.[id] ?? FOLLOW_STUDIO_INPUT,
      choose: vi.fn(),
      channels: () => null,
      studioInputName: () => 'Default input',
      counts,
      remember: vi.fn((_stream: MediaStream, channels: number) =>
        setCounts([{ deviceId: 'scarlett', label: null, channels }]),
      ),
    },
  } as unknown as StudioInputsPanelProps['recorder']
  const context = fakeContext(options.levels ?? [])
  render(() => (
    <StudioInputsPanel
      recorder={recorder}
      project={project}
      clock={() => Promise.resolve(context)}
    />
  ))
  return { setPhase, refreshInputs, recorder }
}

const card = (name: string) =>
  screen.getByRole('article', { name }) as HTMLElement

describe('the Inputs view', () => {
  it('offers one action before the browser names its inputs, which asks through MicManager and lists them again', async () => {
    // Arrange
    const release = vi.fn()
    mic.acquireFrom.mockResolvedValue({
      stream: {} as MediaStream,
      missing: false,
      release,
    })
    const { refreshInputs } = mount({
      devices: [audioInput('default', ''), audioInput('a1', '')],
    })

    // Act
    await fireEvent.click(
      screen.getByRole('button', {
        name: 'Allow the microphone to see your inputs',
      }),
    )
    await vi.waitFor(() => expect(refreshInputs).toHaveBeenCalled())

    // Assert
    expect(screen.queryByRole('article')).toBeNull()
    expect(mic.acquireFrom).toHaveBeenCalledExactlyOnceWith(
      'studio-inputs',
      null,
    )
    expect(release).toHaveBeenCalledOnce()
  })

  it('shows each input as a card: its kind, channels, round trip, warning, rows and lanes', () => {
    // Arrange, Act
    mount({
      counts: [{ deviceId: 'scarlett', label: null, channels: 2 }],
      lanes: {
        gtr: {
          deviceId: 'scarlett',
          label: 'Scarlett 2i2 USB',
          channel: 1,
          pair: false,
        },
      },
    })

    // Assert
    const scarlett = card('Scarlett 2i2 USB')
    expect(within(scarlett).getByText('USB')).toBeVisible()
    expect(scarlett).toHaveTextContent('Channels2')
    expect(scarlett).toHaveTextContent('LatencyNot measured')
    expect(scarlett).toHaveTextContent('LanesGuitar')
    expect(
      [...scarlett.querySelectorAll('[data-studio-input-row]')].map((row) =>
        row.getAttribute('data-studio-input-row'),
      ),
    ).toEqual(['Default: Inputs 1 + 2', 'Input 1', 'Input 2', 'Inputs 1 + 2'])
    expect(
      scarlett.querySelector('[data-studio-input-row="Input 2"]'),
    ).toHaveTextContent('Guitar')
    expect(card('Desk mic')).toHaveTextContent('System default')
    expect(card('Desk mic')).toHaveTextContent('LanesVocal')
    expect(card('AirPods Pro (Bluetooth)')).toHaveTextContent(/adds delay/)
  })

  it('checks an input: opens it, learns its channels, and its rows read their meters', async () => {
    // Arrange
    vi.useFakeTimers()
    const release = vi.fn()
    const track = { getSettings: () => ({ channelCount: 2 }) }
    mic.acquireFrom.mockResolvedValue({
      stream: { getAudioTracks: () => [track] },
      missing: false,
      release,
    })
    // Input 1, Input 2, then Inputs 1 + 2, in the order their meters are made.
    mount({ levels: [0.5, 0.01, 0.25] })
    const scarlett = card('Scarlett 2i2 USB')

    // Act
    await fireEvent.click(
      within(scarlett).getByRole('button', { name: 'Check' }),
    )
    await vi.advanceTimersByTimeAsync(100)

    // Assert
    expect(mic.acquireFrom).toHaveBeenCalledWith('studio-inputs', 'scarlett')
    expect(scarlett).toHaveTextContent('Channels2')
    const peak = (label: string) =>
      [...scarlett.querySelectorAll('[data-studio-input-row]')]
        .find((row) => row.getAttribute('data-studio-input-row') === label)
        ?.querySelector('[data-peak]')
        ?.getAttribute('data-peak')
    expect(peak('Input 1')).toBe('0.500')
    expect(peak('Input 2')).toBe('0.010')
    expect(peak('Inputs 1 + 2')).toBe('0.250')
    // The default row reads what the default takes: both, at half each.
    expect(peak('Default: Inputs 1 + 2')).toBe('0.250')
    expect(scarlett).toHaveTextContent('Signal on Input 1')
    expect(
      within(scarlett).getByRole('button', { name: 'Stop checking' }),
    ).toBeVisible()
  })

  it('meters an input whole, on one row, where the browser does not report its channels', async () => {
    // Arrange
    vi.useFakeTimers()
    const track = { getSettings: () => ({}) }
    mic.acquireFrom.mockResolvedValue({
      stream: { getAudioTracks: () => [track] },
      missing: false,
      release: vi.fn(),
    })
    const { recorder } = mount({
      levels: [0.3],
      lanes: {
        gtr: {
          deviceId: 'scarlett',
          label: 'Scarlett 2i2 USB',
          channel: 1,
          pair: false,
        },
      },
    })
    const scarlett = card('Scarlett 2i2 USB')

    // Act
    await fireEvent.click(
      within(scarlett).getByRole('button', { name: 'Check' }),
    )
    await vi.advanceTimersByTimeAsync(100)

    // Assert
    expect(scarlett).toHaveTextContent('ChannelsNot reported by this browser')
    const rows = [...scarlett.querySelectorAll('[data-studio-input-row]')]
    expect(
      rows.map((row) => row.getAttribute('data-studio-input-row')),
    ).toEqual(['Whole input'])
    expect(rows[0]).toHaveTextContent('Guitar')
    expect(
      rows[0].querySelector('[data-peak]')?.getAttribute('data-peak'),
    ).toBe('0.300')
    expect(scarlett).not.toHaveTextContent('Signal on')
    expect(recorder.laneInputs.remember).not.toHaveBeenCalled()
  })

  it('leaves Check off while a lane holds the microphone, and lets a check go as one arms', async () => {
    // Arrange
    const release = vi.fn()
    const track = { getSettings: () => ({ channelCount: 1 }) }
    mic.acquireFrom.mockResolvedValue({
      stream: { getAudioTracks: () => [track] },
      missing: false,
      release,
    })
    const { setPhase } = mount()
    const desk = card('Desk mic')
    await fireEvent.click(within(desk).getByRole('button', { name: 'Check' }))
    await vi.waitFor(() =>
      expect(
        within(desk).getByRole('button', { name: 'Stop checking' }),
      ).toBeVisible(),
    )

    // Act
    setPhase('arming')

    // Assert
    expect(release).toHaveBeenCalledOnce()
    for (const check of screen.getAllByRole('button', { name: 'Check' }))
      expect(check).toBeDisabled()
    for (const measure of screen.getAllByRole('button', {
      name: 'Measure latency',
    }))
      expect(measure).toBeDisabled()
  })

  it("lists every lane with its input picker, showing the lane's own choice and choosing for that lane alone", async () => {
    // Arrange
    const { recorder } = mount({
      lanes: {
        vox: {
          deviceId: 'scarlett',
          label: 'Scarlett 2i2 USB',
          channel: null,
          pair: false,
        },
      },
    })
    const picker = (name: string) =>
      within(screen.getByRole('group', { name: `${name} input` })).getByRole(
        'combobox',
        { name: 'Input' },
      )

    // Act
    await fireEvent.change(picker('Guitar'), { target: { value: 'desk' } })

    // Assert
    expect(picker('Vocal')).toHaveValue('scarlett')
    expect(recorder.laneInputs.choose).toHaveBeenCalledExactlyOnceWith('gtr', {
      deviceId: 'desk',
      label: 'Desk mic',
      channel: null,
      pair: false,
    })
  })

  it('asks for MIDI from a press, then lists each keyboard with the lanes it plays and a light while it plays', async () => {
    // Arrange
    const keys = fakeMidiInput('keys', 'Keystation 49')
    const request = vi.fn(() => Promise.resolve(fakeMidiAccess([keys]).access))
    mount({
      midi: createStudioMidiAccess({ request }),
      lanes: { vox: { kind: 'midi', portId: 'keys', label: 'Keystation 49' } },
    })
    const section = screen.getByRole('region', { name: 'MIDI inputs' })
    const asked = request.mock.calls.length

    // Act
    await fireEvent.click(
      within(section).getByRole('button', {
        name: 'Allow MIDI to see your keyboards and pads',
      }),
    )
    const row = await vi.waitFor(() => {
      const found = section.querySelector('[data-studio-midi-port="keys"]')
      if (found === null) throw new Error('No row yet')
      return found
    })
    const light = row.querySelector('[aria-hidden="true"]')!
    await vi.waitFor(() => {
      keys.send([0x90, 60, 100], performance.now())
      expect(light).toHaveAttribute('data-active')
    })

    // Assert
    expect(asked).toBe(0)
    expect(request).toHaveBeenCalledOnce()
    expect(row).toHaveTextContent('Keystation 49')
    expect(row).toHaveTextContent('Vocal')
  })
})
