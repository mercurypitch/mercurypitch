// ============================================================
// Piano Night app tests — silent entry and explicit runtime intent
// ============================================================
//
// The standalone room must remain inert on mount. Audio, MIDI, persistence,
// and workers are instrumented here so a future convenience import cannot
// quietly turn first paint into a permission or heavy-runtime boundary.

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PianoNightApp } from './PianoNightApp'

class FakeAudioParam {
  value = 1

  setValueAtTime(value: number): this {
    this.value = value
    return this
  }

  exponentialRampToValueAtTime(value: number): this {
    this.value = value
    return this
  }

  cancelAndHoldAtTime(): this {
    return this
  }

  cancelScheduledValues(): this {
    return this
  }
}

class FakeAudioNode {
  readonly connect = vi.fn(() => this)
  readonly disconnect = vi.fn()
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam()
}

class FakeCompressorNode extends FakeAudioNode {
  readonly threshold = new FakeAudioParam()
  readonly knee = new FakeAudioParam()
  readonly ratio = new FakeAudioParam()
  readonly attack = new FakeAudioParam()
  readonly release = new FakeAudioParam()
}

class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = 'sine'
  readonly frequency = new FakeAudioParam()
  readonly detune = new FakeAudioParam()
  readonly start = vi.fn()
  readonly stop = vi.fn()
  onended: (() => void) | null = null
}

class FakeAudioContext {
  currentTime = 0
  state: AudioContextState = 'suspended'
  readonly destination = new FakeAudioNode()
  readonly gains: FakeGainNode[] = []
  readonly oscillators: FakeOscillatorNode[] = []
  readonly resume = vi.fn(async () => {
    this.state = 'running'
  })
  readonly suspend = vi.fn(async () => {
    this.state = 'suspended'
  })
  readonly close = vi.fn(async () => {
    this.state = 'closed'
  })

  createGain(): GainNode {
    const node = new FakeGainNode()
    this.gains.push(node)
    return node as unknown as GainNode
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    return new FakeCompressorNode() as unknown as DynamicsCompressorNode
  }

  createOscillator(): OscillatorNode {
    const node = new FakeOscillatorNode()
    this.oscillators.push(node)
    return node as unknown as OscillatorNode
  }
}

interface FakeMidiInput {
  id: string
  name: string
  manufacturer: string
  state: MIDIPortDeviceState
  connection: MIDIPortConnectionState
  onmidimessage: ((event: MIDIMessageEvent) => void) | null
}

function createMidiAccess(input: FakeMidiInput): MIDIAccess {
  return {
    inputs: new Map([[input.id, input as unknown as MIDIInput]]),
    outputs: new Map(),
    onstatechange: null,
  } as unknown as MIDIAccess
}

let audioContext: FakeAudioContext
let createAudioContext: ReturnType<typeof vi.fn>
let createWorker: ReturnType<typeof vi.fn>
let databaseOpen: ReturnType<typeof vi.spyOn>
let getUserMedia: ReturnType<typeof vi.spyOn>
let requestMidiAccess: ReturnType<typeof vi.fn>
let originalMatchMedia: PropertyDescriptor | undefined
let originalRequestMidiAccess: PropertyDescriptor | undefined

beforeEach(() => {
  localStorage.clear()
  audioContext = new FakeAudioContext()
  createAudioContext = vi.fn(function AudioContextConstructor() {
    return audioContext
  })
  createWorker = vi.fn(function WorkerConstructor() {
    return undefined
  })
  vi.stubGlobal('AudioContext', createAudioContext)
  vi.stubGlobal('Worker', createWorker)

  originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  })

  originalRequestMidiAccess = Object.getOwnPropertyDescriptor(
    navigator,
    'requestMIDIAccess',
  )
  requestMidiAccess = vi.fn()
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    value: requestMidiAccess,
  })

  databaseOpen = vi.spyOn(globalThis.indexedDB, 'open')
  getUserMedia = vi.spyOn(navigator.mediaDevices, 'getUserMedia')
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()

  if (originalMatchMedia === undefined) {
    Reflect.deleteProperty(window, 'matchMedia')
  } else {
    Object.defineProperty(window, 'matchMedia', originalMatchMedia)
  }
  if (originalRequestMidiAccess === undefined) {
    Reflect.deleteProperty(navigator, 'requestMIDIAccess')
  } else {
    Object.defineProperty(
      navigator,
      'requestMIDIAccess',
      originalRequestMidiAccess,
    )
  }
})

function expectSilentBrowserBoundary(): void {
  expect(createAudioContext).not.toHaveBeenCalled()
  expect(requestMidiAccess).not.toHaveBeenCalled()
  expect(getUserMedia).not.toHaveBeenCalled()
  expect(databaseOpen).not.toHaveBeenCalled()
  expect(createWorker).not.toHaveBeenCalled()
}

describe('PianoNightApp', () => {
  it('mounts the prepared project without crossing a browser boundary', () => {
    render(() => <PianoNightApp />)

    const shell = screen.getByTestId('piano-night-shell')
    expect(shell).toHaveAttribute('data-room', 'piano-afterglow')
    expect(
      screen.getAllByText('Afterglow Study in E-flat').length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('Prepared project performance')).toBeVisible()
    expect(screen.getByText('bars 1–4 · Afterglow Studio')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Afterglow Study in E-flat is ready. Audio and input are off.',
    )

    const keyboard = screen.getByTestId('piano-night-keyboard')
    expect(keyboard).toHaveAccessibleName('Playable 88-key piano keyboard')
    expect(keyboard.querySelectorAll('button[data-midi]')).toHaveLength(88)
    expect(screen.queryByText(/No project loaded/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Illustrative/i)).not.toBeInTheDocument()
    expectSilentBrowserBoundary()
  })

  it('activates one audio clock and the fallback synth only after Play', async () => {
    render(() => <PianoNightApp />)

    const play = screen.getByTestId('piano-night-play')
    expect(play).toHaveAccessibleName('Play Piano Night')
    expect(play).toHaveAttribute('aria-pressed', 'false')
    expectSilentBrowserBoundary()

    fireEvent.click(play)

    await waitFor(() => {
      expect(play).toHaveAccessibleName('Pause Piano Night')
      expect(play).toHaveAttribute('aria-pressed', 'true')
    })
    expect(createAudioContext).toHaveBeenCalledOnce()
    expect(audioContext.resume).toHaveBeenCalled()
    expect(audioContext.gains.length).toBeGreaterThan(1)
    expect(audioContext.oscillators.length).toBeGreaterThan(0)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Playing Afterglow Study in E-flat with the built-in fallback synth.',
    )
    expect(requestMidiAccess).not.toHaveBeenCalled()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(databaseOpen).not.toHaveBeenCalled()
    expect(createWorker).not.toHaveBeenCalled()

    fireEvent.click(play)
    expect(play).toHaveAccessibleName('Play Piano Night')
    expect(play).toHaveAttribute('aria-pressed', 'false')
    expect(createAudioContext).toHaveBeenCalledOnce()
  })

  it('projects one prepared score through Fall, Score, and Keys', () => {
    render(() => <PianoNightApp />)

    expect(screen.getByTestId('piano-night-fall-view')).toBeInTheDocument()
    const view = screen.getByRole('button', {
      name: 'Change performance view. Current view: Fall',
    })

    fireEvent.click(view)
    const score = screen.getByTestId('piano-night-score-view')
    expect(score).toHaveAccessibleName(
      'Project score for Afterglow Study in E-flat',
    )
    expect(screen.getByText('Prepared score lens')).toBeVisible()
    expect(screen.getByText(/notes$/)).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Change performance view. Current view: Score',
      }),
    )
    expect(screen.getByTestId('piano-night-keys-view')).toBeInTheDocument()
    expect(screen.getByText('Next project entrance')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'A♭2 · G3 · G4' })).toBeVisible()
    expect(
      screen.getAllByText('Afterglow Study in E-flat').length,
    ).toBeGreaterThan(0)
    expectSilentBrowserBoundary()
  })

  it('describes the visual dynamics and pedal prompts to assistive technology', () => {
    render(() => <PianoNightApp />)

    expect(
      screen.getByRole('img', {
        name: 'Crescendo from mezzo-piano to mezzo-forte',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: 'Hold the sustain pedal through the phrase, then release',
      }),
    ).toBeInTheDocument()
    expectSilentBrowserBoundary()
  })

  it('keeps the phrase lens aligned with a project seek', () => {
    render(() => <PianoNightApp />)

    const seek = screen.getByLabelText('Seek piano project')
    const playhead = screen.getByTestId('piano-night-trace-playhead')
    expect(seek).toHaveAttribute('aria-valuetext', 'Beat 0.0 of 64')
    expect(playhead).toHaveStyle({
      left: 'clamp(15px, 0%, calc(100% - 15px))',
    })

    fireEvent.input(seek, {
      target: { value: '20' },
    })

    expect(seek).toHaveAttribute('aria-valuetext', 'Beat 20.0 of 64')
    expect(playhead).toHaveStyle({
      left: 'clamp(15px, 31.25%, calc(100% - 15px))',
    })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Change performance view. Current view: Fall',
      }),
    )

    expect(screen.getByTestId('piano-night-score-view')).toHaveTextContent(
      'bars 5–8',
    )
    expect(screen.getByText('Phrase 2 of 4')).toBeVisible()
    expectSilentBrowserBoundary()
  })

  it('offers a roving keyboard path and releases its voice on seek', async () => {
    render(() => <PianoNightApp />)

    const middleC = screen.getByRole('button', { name: 'Play C4' })
    const cSharp = screen.getByRole('button', { name: 'Play C#4' })
    expect(middleC).toHaveAttribute('tabindex', '0')

    middleC.focus()
    fireEvent.keyDown(middleC, { key: 'ArrowRight' })
    await waitFor(() => expect(cSharp).toHaveFocus())
    expect(cSharp).toHaveAttribute('tabindex', '0')

    fireEvent.click(cSharp, { detail: 0 })
    await waitFor(() => expect(cSharp).toHaveAttribute('aria-pressed', 'true'))
    expect(createAudioContext).toHaveBeenCalledOnce()

    fireEvent.input(screen.getByLabelText('Seek piano project'), {
      target: { value: '24' },
    })
    expect(cSharp).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps the roving keyboard focus visible after entering phone layout', async () => {
    let mobile = false
    let notifyMobileChange: (() => void) | undefined
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({
        get matches() {
          return query ===
            '(max-width: 680px), (max-width: 900px) and (max-height: 500px)'
            ? mobile
            : false
        },
        media: query,
        onchange: null,
        addEventListener: vi.fn(
          (type: string, listener: EventListenerOrEventListenerObject) => {
            if (
              query !==
                '(max-width: 680px), (max-width: 900px) and (max-height: 500px)' ||
              type !== 'change'
            ) {
              return
            }
            notifyMobileChange = () => {
              if (typeof listener === 'function') listener(new Event('change'))
              else listener.handleEvent(new Event('change'))
            }
          },
        ),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    })
    render(() => <PianoNightApp />)

    const lowestKey = screen.getByRole('button', { name: 'Play A0' })
    const middleC = screen.getByRole('button', { name: 'Play C4' })
    lowestKey.focus()
    expect(lowestKey).toHaveAttribute('tabindex', '0')

    mobile = true
    notifyMobileChange?.()

    await waitFor(() => {
      expect(lowestKey).toHaveAttribute('data-in-range', 'false')
      expect(lowestKey).toHaveAttribute('tabindex', '-1')
      expect(middleC).toHaveAttribute('tabindex', '0')
      expect(middleC).toHaveFocus()
    })
  })

  it('returns focus to the compact-sheet opener when the sheet closes', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query === '(max-width: 1180px)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    })
    render(() => <PianoNightApp />)

    const opener = within(
      screen.getByRole('navigation', {
        name: 'Piano Night mobile navigation',
      }),
    ).getByRole('button', { name: 'Open Piano Night settings' })
    opener.focus()
    fireEvent.click(opener)
    const close = screen.getByRole('button', {
      name: 'Close Piano Night controls',
    })
    await waitFor(() => expect(close).toHaveFocus())

    fireEvent.click(close)
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('announces a touch-key audio activation failure at the action site', async () => {
    audioContext.resume.mockRejectedValue(new Error('blocked'))
    render(() => <PianoNightApp />)

    fireEvent.click(screen.getByRole('button', { name: 'Play C4' }), {
      detail: 0,
    })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        "Audio could not start. Check this browser's audio permission and try again.",
      )
    })
    expect(createAudioContext).toHaveBeenCalledOnce()
  })

  it('requests MIDI and audio only from the explicit Connect MIDI action', async () => {
    const input: FakeMidiInput = {
      id: 'stage-keyboard',
      name: 'Stage Keyboard',
      manufacturer: 'Mercury Test',
      state: 'connected',
      connection: 'open',
      onmidimessage: null,
    }
    requestMidiAccess.mockResolvedValue(createMidiAccess(input))
    render(() => <PianoNightApp />)

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Open Piano Night settings' })[0],
    )
    expect(requestMidiAccess).not.toHaveBeenCalled()
    expect(createAudioContext).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Connect MIDI' }))

    await waitFor(() => {
      expect(requestMidiAccess).toHaveBeenCalledOnce()
      expect(screen.getByLabelText('MIDI input')).toHaveValue('stage-keyboard')
    })
    expect(createAudioContext).toHaveBeenCalledOnce()
    expect(screen.getAllByText('Stage Keyboard').length).toBeGreaterThan(0)
    expect(input.onmidimessage).toEqual(expect.any(Function))
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'MIDI keyboard connected to the fallback synth.',
      )
    })
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(databaseOpen).not.toHaveBeenCalled()
    expect(createWorker).not.toHaveBeenCalled()
  })

  it('opens the device library only from Music without activating audio or a worker', async () => {
    render(() => <PianoNightApp />)
    expectSilentBrowserBoundary()

    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Choose music for Piano Night',
      })[0],
    )

    await screen.findByRole('heading', { name: 'Choose what to play' })
    const musicPanel = screen.getByRole('tabpanel', { name: 'Music' })
    await waitFor(() =>
      expect(musicPanel).toHaveAttribute('aria-busy', 'false'),
    )
    await waitFor(() => expect(databaseOpen).toHaveBeenCalled())
    expect(createWorker).not.toHaveBeenCalled()
    expect(createAudioContext).not.toHaveBeenCalled()
    expect(requestMidiAccess).not.toHaveBeenCalled()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: /Afterglow Study in E-flat/ }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('stages a composed melody without inventing authored coaching', async () => {
    localStorage.setItem(
      'pitchperfect_library',
      JSON.stringify({
        melodies: {
          'device-nocturne': {
            id: 'device-nocturne',
            name: 'Device Nocturne',
            bpm: 132,
            kind: 'melody',
            items: [
              {
                id: 1,
                isRest: false,
                note: { midi: 60 },
                startBeat: 0,
                duration: 2,
                velocity: 100,
              },
            ],
          },
        },
      }),
    )
    render(() => <PianoNightApp />)

    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Choose music for Piano Night',
      })[0],
    )
    const composition = await screen.findByRole('button', {
      name: /Device Nocturne/,
    })
    fireEvent.click(composition)

    await waitFor(() => {
      expect(screen.getAllByText('Device Nocturne').length).toBeGreaterThan(0)
      expect(screen.getByText('Loaded project performance')).toBeVisible()
      expect(screen.getByRole('status')).toHaveTextContent(
        'Device Nocturne is on stage.',
      )
    })
    expect(screen.getByLabelText('Seek piano project')).toHaveAttribute(
      'aria-valuetext',
      'Beat 0.0 of 2',
    )
    expect(
      screen.getByText(
        'No authored coaching prompt exists for Device Nocturne.',
      ),
    ).toBeVisible()
    expect(
      screen.queryByRole('img', {
        name: 'Crescendo from mezzo-piano to mezzo-forte',
      }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Change performance view. Current view: Fall',
      }),
    )
    expect(screen.getByTestId('piano-night-score-view')).toHaveAccessibleName(
      'Project score for Device Nocturne',
    )
    expect(screen.getByText('Project score lens')).toBeVisible()
    expect(screen.getByText('Key not specified')).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Change performance view. Current view: Score',
      }),
    )
    expect(screen.getByTestId('piano-night-keys-view')).toHaveTextContent(
      'Beat 0.0 of 2',
    )
    expect(screen.getByRole('heading', { name: 'C4' })).toBeVisible()
    expect(createWorker).not.toHaveBeenCalled()
    expect(createAudioContext).not.toHaveBeenCalled()
    expect(requestMidiAccess).not.toHaveBeenCalled()
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('uses one Music and Settings entry per responsive layout', () => {
    render(() => <PianoNightApp />)

    expect(
      screen.getAllByRole('button', { name: 'Open Piano Night settings' }),
    ).toHaveLength(2)
    expect(
      screen.getAllByRole('button', {
        name: 'Choose music for Piano Night',
      }),
    ).toHaveLength(2)
    expect(
      screen.queryByRole('button', { name: 'Open session controls' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Sounds' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Room' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'Open the current Piano workspace',
      }),
    ).toHaveAttribute('href', '/#/piano')
  })

  it('keeps Music distinct and reopens the last settings section', async () => {
    render(() => <PianoNightApp />)

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Open Piano Night settings' })[0],
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Room' }))
    expect(screen.getByRole('tab', { name: 'Room' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Piano Night controls' }),
      ).getByRole('button', { name: 'Close Piano Night controls' }),
    )

    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Choose music for Piano Night',
      })[0],
    )
    await screen.findByRole('tabpanel', { name: 'Music' })
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Piano Night controls' }),
      ).getByRole('button', { name: 'Close Piano Night controls' }),
    )

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Open Piano Night settings' })[0],
    )
    expect(screen.getByRole('tab', { name: 'Room' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      screen.queryByRole('tabpanel', { name: 'Music' }),
    ).not.toBeInTheDocument()
  })

  it('persists a Piano room choice without changing sound', () => {
    render(() => <PianoNightApp />)

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Open Piano Night settings' })[0],
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Room' }))
    const roomButton = screen.getByRole('button', {
      name: /Morning Conservatory/,
    })
    expect(roomButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(roomButton)

    expect(roomButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('piano-night-shell')).toHaveAttribute(
      'data-room',
      'piano-morning-conservatory',
    )
    expect(screen.getByTestId('piano-night-shell')).toHaveAttribute(
      'data-room-treatment',
      'light',
    )
    expect(
      screen.getByText(
        'Morning Conservatory selected. Instrument sound unchanged.',
      ),
    ).toBeInTheDocument()
    expect(localStorage.getItem('pitchperfect_piano_background')).toBe(
      'piano-morning-conservatory',
    )
    expectSilentBrowserBoundary()
  })
})
