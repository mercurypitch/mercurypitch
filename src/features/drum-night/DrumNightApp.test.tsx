// ============================================================
// Drum Night app tests — silent entry and real gesture-owned room controls
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DrumKitId, DrumKitPlayer, DrumKitPlayerOptions, DrumKitPlayerSnapshot, } from './audio'
import { drumKitManifest } from './audio'
import type { DrumNightAudioSession } from './drum-night-audio-session'
import { DrumNightApp } from './DrumNightApp'
import type { DrumMidiAccessPort, DrumMidiInputPort, DrumMidiMessageLike, DrumRuntimeClock, } from './runtime'
import type { DrumScoreIndex, DrumSessionImportController, DrumSessionImportState, } from './session'
import { createDrumScoreIndex, IDLE_DRUM_SESSION } from './session'
import { drumSongFixture, percussionTrackFixture, readySessionFixture, } from './session/drum-session.test-fixtures'

class TestClock implements DrumRuntimeClock {
  private timestampMs = 0
  private nextFrameId = 1
  private frames = new Map<number, (timestampMs: number) => void>()

  nowMs = (): number => this.timestampMs

  requestFrame = (callback: (timestampMs: number) => void): number => {
    const id = this.nextFrameId
    this.nextFrameId += 1
    this.frames.set(id, callback)
    return id
  }

  cancelFrame = (handle: number): void => {
    this.frames.delete(handle)
  }

  advanceTo(timestampMs: number): void {
    this.timestampMs = timestampMs
    const pending = [...this.frames.values()]
    this.frames.clear()
    for (const callback of pending) callback(this.timestampMs)
  }
}

class FakeMidiInput implements DrumMidiInputPort {
  readonly id: string
  readonly name: string
  readonly state: MIDIPortDeviceState = 'connected'
  onmidimessage: ((event: DrumMidiMessageLike) => void) | null = null
  private listeners = new Set<(event: DrumMidiMessageLike) => void>()

  constructor(id: string, name: string) {
    this.id = id
    this.name = name
  }

  addEventListener(
    _type: 'midimessage',
    listener: (event: DrumMidiMessageLike) => void,
  ): void {
    this.listeners.add(listener)
  }

  removeEventListener(
    _type: 'midimessage',
    listener: (event: DrumMidiMessageLike) => void,
  ): void {
    this.listeners.delete(listener)
  }

  emit(data: readonly number[], timeStamp = performance.now()): void {
    const event = { data: new Uint8Array(data), timeStamp }
    this.onmidimessage?.(event)
    for (const listener of this.listeners) listener(event)
  }
}

function midiAccess(inputs: readonly FakeMidiInput[]): DrumMidiAccessPort {
  return {
    inputs: { values: () => inputs[Symbol.iterator]() },
    onstatechange: null,
  }
}

function dispatchPointerDown(
  target: Element,
  init: {
    readonly button: number
    readonly isPrimary: boolean
    readonly pressure: number
  },
): void {
  const event = new Event('pointerdown', { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    button: { value: init.button },
    isPrimary: { value: init.isPrimary },
    pressure: { value: init.pressure },
  })
  fireEvent(target, event)
}

function sessionHarness(mapperAvailable = true) {
  let activated = false
  const activeContextValue = { currentTime: 0 } as AudioContext
  const contextForGesture = vi.fn(() => {
    activated = true
    return activeContextValue
  })
  const outputForGesture = vi.fn(() => {
    activated = true
    return {} as AudioNode
  })
  const activeContext = vi.fn(() => (activated ? activeContextValue : null))
  const performanceTimestampToContextTime = vi.fn((timestampMs: number) =>
    activated && mapperAvailable ? timestampMs / 1000 : null,
  )
  const dispose = vi.fn(async () => undefined)
  const session = {
    activeContext,
    contextForGesture,
    outputForGesture,
    performanceTimestampToContextTime,
    dispose,
  } satisfies DrumNightAudioSession
  return {
    activeContext,
    contextForGesture,
    dispose,
    outputForGesture,
    performanceTimestampToContextTime,
    session,
  }
}

function importSessionHarness(
  initialState: DrumSessionImportState = IDLE_DRUM_SESSION,
) {
  let state = initialState
  let generation = 0
  let disposed = false
  let nextResult: DrumSessionImportState = initialState
  const listeners = new Set<() => void>()
  const emit = (): void => {
    for (const listener of listeners) listener()
  }
  const setState = (nextState: DrumSessionImportState): void => {
    state = nextState
    emit()
  }
  const importFile = vi.fn(async (file: File) => {
    const attemptGeneration = ++generation
    setState({ status: 'loading', fileName: file.name })
    await Promise.resolve()
    if (disposed || attemptGeneration !== generation) {
      return {
        status: 'stale' as const,
        generation: attemptGeneration,
        state: nextResult,
      }
    }
    setState(nextResult)
    return {
      status: 'applied' as const,
      generation: attemptGeneration,
      state: nextResult,
    }
  })
  const cancel = vi.fn(() => {
    generation += 1
    setState(IDLE_DRUM_SESSION)
  })
  const dispose = vi.fn(() => {
    disposed = true
    generation += 1
    listeners.clear()
  })
  const controller = {
    state: () => state,
    generation: () => generation,
    subscribe(listener: () => void) {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    importFile,
    cancel,
    dispose,
  } satisfies DrumSessionImportController
  return {
    cancel,
    controller,
    dispose,
    importFile,
    listenerCount: () => listeners.size,
    setNextResult(nextState: DrumSessionImportState) {
      nextResult = nextState
    },
    setState,
  }
}

function playerHarness(
  initialKitId: DrumKitId = 'mercury-synth',
  activationResults: readonly boolean[] = [true],
) {
  let options: DrumKitPlayerOptions | null = null
  let snapshot: DrumKitPlayerSnapshot = {
    selectedKitId: initialKitId,
    status: 'idle',
    fallbackReady: false,
    sampledReady: false,
    loadedSamples: 0,
    preparedSamples: 0,
    plannedSamples: 0,
    decodedBytes: 0,
    publishedEncodedBytes: drumKitManifest(initialKitId).publishedEncodedBytes,
    error: null,
  }
  const listeners = new Set<() => void>()
  const emit = (): void => {
    for (const listener of listeners) listener()
  }
  const updateSnapshot = (patch: Partial<DrumKitPlayerSnapshot>): void => {
    snapshot = { ...snapshot, ...patch }
    emit()
  }
  let activationAttempt = 0
  const activate = vi.fn(async () => {
    options?.getAudioContext()
    options?.getOutput()
    const activated =
      activationResults[
        Math.min(activationAttempt, activationResults.length - 1)
      ] ?? true
    activationAttempt += 1
    if (!activated) {
      updateSnapshot({
        status: 'error',
        fallbackReady: false,
        sampledReady: false,
        error: 'Drum audio context is unavailable.',
      })
      return false
    }
    const sampled = snapshot.selectedKitId !== 'mercury-synth'
    updateSnapshot({
      status: sampled ? 'loading' : 'ready',
      fallbackReady: true,
      plannedSamples: sampled ? 5 : 0,
      preparedSamples: 0,
      error: null,
    })
    return true
  })
  const trigger = vi.fn<DrumKitPlayer['trigger']>(() => 'synth-fallback')
  const panic = vi.fn()
  const dispose = vi.fn(() => listeners.clear())
  const selectKit = vi.fn<DrumKitPlayer['selectKit']>(async (kitId) => {
    const sampled = kitId !== 'mercury-synth'
    updateSnapshot({
      selectedKitId: kitId,
      status: snapshot.fallbackReady && sampled ? 'loading' : 'idle',
      sampledReady: false,
      loadedSamples: 0,
      preparedSamples: 0,
      plannedSamples: snapshot.fallbackReady && sampled ? 5 : 0,
      publishedEncodedBytes: drumKitManifest(kitId).publishedEncodedBytes,
      error: null,
    })
  })
  const retry = vi.fn<DrumKitPlayer['retry']>(async () => {
    updateSnapshot({
      status: snapshot.selectedKitId === 'mercury-synth' ? 'ready' : 'loading',
      error: null,
    })
  })
  const player = {
    activate,
    trigger,
    panic,
    dispose,
    selectedKit: () => drumKitManifest(snapshot.selectedKitId),
    selectKit,
    retry,
    prewarm: vi.fn(async () => undefined),
    choke: vi.fn(),
    setVolume: vi.fn(),
    snapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  } satisfies DrumKitPlayer
  const createPlayer = vi.fn((nextOptions: DrumKitPlayerOptions) => {
    options = nextOptions
    const nextKitId = nextOptions.initialKitId ?? initialKitId
    snapshot = {
      ...snapshot,
      selectedKitId: nextKitId,
      publishedEncodedBytes: drumKitManifest(nextKitId).publishedEncodedBytes,
    }
    return player
  })
  return {
    activate,
    createPlayer,
    dispose,
    listenerCount: () => listeners.size,
    player,
    retry,
    selectKit,
    trigger,
    updateSnapshot,
  }
}

function renderRoom(options?: {
  readonly access?: DrumMidiAccessPort
  readonly activationResults?: readonly boolean[]
  readonly clock?: DrumRuntimeClock
  readonly createScoreIndex?: (
    document: Extract<DrumSessionImportState, { status: 'ready' }>['document'],
  ) => DrumScoreIndex
  readonly importSession?: ReturnType<typeof importSessionHarness>
  readonly onReadySessionChange?: (
    document:
      | Extract<DrumSessionImportState, { status: 'ready' }>['document']
      | null,
  ) => void
  readonly requestAccess?: () => Promise<DrumMidiAccessPort>
  readonly schedulerAudioReady?: boolean
  readonly maxRecordedHits?: number
}) {
  const session = sessionHarness(options?.schedulerAudioReady)
  const player = playerHarness('mercury-synth', options?.activationResults)
  const importSession = options?.importSession ?? importSessionHarness()
  const requestAccess =
    options?.requestAccess ??
    vi.fn(async () => options?.access ?? midiAccess([]))
  const mounted = render(() => (
    <DrumNightApp
      createAudioSession={() => session.session}
      createPlayer={player.createPlayer}
      createScoreIndex={options?.createScoreIndex}
      createSessionController={() => importSession.controller}
      onReadySessionChange={options?.onReadySessionChange}
      runtimeOptions={{
        clock: options?.clock,
        maxRecordedHits: options?.maxRecordedHits,
        midiEnvironment: {
          requestAccess,
          nowMs: options?.clock?.nowMs ?? (() => performance.now()),
          timeOriginMs: () => performance.timeOrigin,
        },
      }}
    />
  ))
  return { ...mounted, importSession, player, requestAccess, session }
}

let createAudioContext: ReturnType<typeof vi.fn>
let createWorker: ReturnType<typeof vi.fn>
let fetchRequest: ReturnType<typeof vi.fn>
let getUserMedia: ReturnType<typeof vi.fn>
let originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia

beforeEach(() => {
  window.history.replaceState({}, '', '/drum-night')
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1280,
  })
  localStorage.clear()
  createAudioContext = vi.fn()
  createWorker = vi.fn()
  fetchRequest = vi.fn()
  getUserMedia = vi.fn()
  vi.stubGlobal('AudioContext', createAudioContext)
  vi.stubGlobal('fetch', fetchRequest)
  vi.stubGlobal('Worker', createWorker)
  originalGetUserMedia = navigator.mediaDevices.getUserMedia
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    value: getUserMedia,
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    value: originalGetUserMedia,
  })
})

describe('DrumNightApp', () => {
  it('mounts without Web Audio, samples, MIDI, workers, or microphone work', () => {
    const room = renderRoom()

    expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
      'data-view',
      'pocket',
    )
    expect(
      screen.getByText(/Audio, samples, and MIDI stay off/i),
    ).toBeInTheDocument()
    expect(room.player.activate).not.toHaveBeenCalled()
    expect(room.session.contextForGesture).not.toHaveBeenCalled()
    expect(room.requestAccess).not.toHaveBeenCalled()
    expect(createAudioContext).not.toHaveBeenCalled()
    expect(fetchRequest).not.toHaveBeenCalled()
    expect(createWorker).not.toHaveBeenCalled()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(screen.queryByText('EARLY')).not.toBeInTheDocument()
    expect(screen.queryByText('ON')).not.toBeInTheDocument()
    expect(screen.queryByText('LATE')).not.toBeInTheDocument()
  })

  it('starts sound from pointer and keyboard strikes and uses Space for one transport', async () => {
    const room = renderRoom()
    const touchKit = screen.getByLabelText('Touch drum pads')
    const snare = within(touchKit).getByRole('button', {
      name: 'Acoustic snare, key 2',
    })

    dispatchPointerDown(snare, {
      button: 2,
      isPrimary: true,
      pressure: 0.5,
    })
    dispatchPointerDown(snare, {
      button: 0,
      isPrimary: false,
      pressure: 0.5,
    })
    expect(room.player.trigger).not.toHaveBeenCalled()

    dispatchPointerDown(snare, {
      button: 0,
      isPrimary: true,
      pressure: 0.5,
    })
    await waitFor(() => expect(room.player.trigger).toHaveBeenCalledTimes(1))
    expect(room.player.activate).toHaveBeenCalledOnce()
    expect(room.session.contextForGesture).toHaveBeenCalledOnce()
    expect(room.session.outputForGesture).toHaveBeenCalledOnce()
    expect(room.player.trigger).toHaveBeenLastCalledWith(
      expect.objectContaining({ gmKey: 38, sourceId: 'snare' }),
    )

    fireEvent.keyDown(window, { code: 'Digit3' })
    await waitFor(() => expect(room.player.trigger).toHaveBeenCalledTimes(2))
    expect(room.player.trigger).toHaveBeenLastCalledWith(
      expect.objectContaining({ gmKey: 36, sourceId: 'Digit3' }),
    )

    fireEvent.keyDown(window, { code: 'Space' })
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', {
          name: 'Pause Live drums take clock',
        }),
      ).not.toHaveLength(0),
    )
    expect(
      screen.getByText(
        'Starting the live take clock. No backing track or click is scheduled.',
      ),
    ).toHaveAttribute('data-visible', 'false')
    expect(room.requestAccess).not.toHaveBeenCalled()
  })

  it('persists all four kit choices and exposes loading fallback, attribution, and retry', async () => {
    const room = renderRoom()
    fireEvent.click(screen.getAllByRole('button', { name: 'Kit' })[0])
    const drawer = screen.getByRole('dialog', { name: 'Choose the kit' })
    const kitGroup = within(drawer).getByRole('radiogroup', {
      name: 'Drum sound',
    })

    fireEvent.click(within(kitGroup).getByRole('radio', { name: /Live/i }))
    expect(room.player.selectKit).toHaveBeenCalledWith('live')
    expect(localStorage.getItem('mp.drumNight.kit.v1')).toBe('live')
    expect(within(drawer).getByText(/Vincent/)).toBeVisible()
    expect(room.player.activate).not.toHaveBeenCalled()
    expect(room.session.contextForGesture).not.toHaveBeenCalled()

    room.player.updateSnapshot({
      status: 'loading',
      fallbackReady: true,
      plannedSamples: 5,
      preparedSamples: 2,
    })
    expect(
      within(drawer).getByText(/Loading 2 of 5 core samples/i),
    ).toBeVisible()

    room.player.updateSnapshot({
      status: 'error',
      error: 'warm-up failed',
    })
    expect(
      within(drawer).getByText(
        /2 of 5 core samples ready · sample warm-up stopped/i,
      ),
    ).toBeVisible()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Retry Live' }))
    await waitFor(() => expect(room.player.retry).toHaveBeenCalledOnce())

    room.unmount()
    const restored = renderRoom()
    fireEvent.click(screen.getAllByRole('button', { name: 'Kit' })[0])
    expect(
      within(screen.getByRole('dialog', { name: 'Choose the kit' })).getByRole(
        'radio',
        { name: /Live/i },
      ),
    ).toHaveAttribute('aria-checked', 'true')
    expect(restored.player.createPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ initialKitId: 'live' }),
    )
  })

  it('connects explicitly, switches inputs, and learns an unmapped note by strike', async () => {
    const first = new FakeMidiInput('a', 'Practice Pad')
    const second = new FakeMidiInput('b', 'Stage E-kit')
    const room = renderRoom({ access: midiAccess([first, second]) })

    fireEvent.click(screen.getByRole('button', { name: /MIDI not connected/i }))
    expect(room.requestAccess).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Connect MIDI input' }))
    await waitFor(() => expect(room.requestAccess).toHaveBeenCalledOnce())
    expect(room.player.activate).not.toHaveBeenCalled()
    expect(room.session.contextForGesture).not.toHaveBeenCalled()
    expect(
      screen.getByRole('combobox', { name: 'Active MIDI input' }),
    ).toHaveValue('a')

    fireEvent.click(screen.getByRole('button', { name: 'Close input details' }))
    fireEvent.click(screen.getByRole('button', { name: /Practice Pad/i }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Disconnect MIDI' }),
      ).toHaveFocus(),
    )
    expect(
      screen.getByRole('combobox', { name: 'Active MIDI input' }),
    ).not.toHaveFocus()

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Active MIDI input' }),
      { target: { value: 'b' } },
    )
    expect(screen.getByRole('button', { name: /Stage E-kit/i })).toBeVisible()
    second.emit([0x99, 20, 115])
    expect(screen.getByText(/Raw note 20 on channel 10 needs/i)).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'Review sound and mapping' }),
    )

    const drawer = screen.getByRole('dialog', { name: 'Choose the kit' })
    const snareLabel = within(drawer).getByText('Acoustic snare')
    const snareRow = snareLabel.parentElement
    expect(snareRow).not.toBeNull()
    expect(
      within(drawer).getByText(/Raw note 20 on channel 10 is not mapped/i),
    ).toBeVisible()
    fireEvent.click(
      within(snareRow as HTMLElement).getByRole('button', { name: 'Learn' }),
    )
    second.emit([0x99, 20, 115])

    await waitFor(() =>
      expect(within(snareRow as HTMLElement).getByText('Raw 20')).toBeVisible(),
    )
    expect(
      within(drawer).queryByText(/Raw note 20 on channel 10 is not mapped/i),
    ).not.toBeInTheDocument()
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Close rack drawer' }),
    )
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Live drums take clock',
      })[0],
    )
    await waitFor(() => expect(room.player.activate).toHaveBeenCalledOnce())
    second.emit([0x99, 20, 115])
    await waitFor(() =>
      expect(room.player.trigger).toHaveBeenLastCalledWith(
        expect.objectContaining({ gmKey: 38, velocity: 115, sourceId: 'b' }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: /Stage E-kit/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect MIDI' }))
    expect(
      screen.getByRole('button', { name: /MIDI disconnected/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Scan for MIDI input' }),
    ).toBeEnabled()
  })

  it('distinguishes a granted connection with no visible MIDI inputs', async () => {
    const room = renderRoom({ access: midiAccess([]) })
    fireEvent.click(screen.getByRole('button', { name: /MIDI not connected/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Connect MIDI input' }))

    const inputDialog = screen.getByRole('dialog', { name: 'Drum input' })
    await waitFor(() =>
      expect(
        within(inputDialog).getByText('No MIDI inputs found'),
      ).toBeVisible(),
    )
    expect(
      within(inputDialog).getByText(/Permission was granted/i),
    ).toBeVisible()
    expect(room.requestAccess).toHaveBeenCalledOnce()
  })

  it('shows permission denial with a recovery path', async () => {
    const requestAccess = vi.fn(async () => {
      throw new DOMException('blocked', 'NotAllowedError')
    })
    const room = renderRoom({ requestAccess })
    fireEvent.click(screen.getByRole('button', { name: /MIDI not connected/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Connect MIDI input' }))

    const inputDialog = screen.getByRole('dialog', { name: 'Drum input' })
    await waitFor(() =>
      expect(
        within(inputDialog).getByText('MIDI permission blocked'),
      ).toBeVisible(),
    )
    expect(
      within(inputDialog).getByText(/browser site settings/i),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Scan for MIDI input' }),
    ).toBeEnabled()
    expect(room.session.contextForGesture).not.toHaveBeenCalled()
  })

  it('collects and applies five MIDI strikes on the shared performance timeline', async () => {
    vi.useFakeTimers()
    const input = new FakeMidiInput('kit', 'Calibration Kit')
    renderRoom({ access: midiAccess([input]) })
    fireEvent.click(screen.getByRole('button', { name: /MIDI not connected/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Connect MIDI input' }))
    await vi.runAllTicks()
    await Promise.resolve()
    expect(screen.getByText('Five-strike latency check')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Start five strikes' }))
    for (let strike = 1; strike <= 5; strike += 1) {
      await vi.advanceTimersByTimeAsync(strike === 1 ? 700 : 650)
      expect(screen.getByText(`Strike ${strike}`)).toBeVisible()
      input.emit([0x99, 38, 100], performance.now() + 24)
      await Promise.resolve()
    }

    expect(screen.getByText('5/5')).toBeVisible()
    expect(screen.getByText('24 ms estimate')).toBeVisible()
    expect(
      screen.getByText(/5 of 5 strikes consistent · 0 ms spread/i),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Apply estimate' }))
    expect(screen.getByText(/Applied: 24 ms/i)).toBeVisible()
  })

  it('restores drawer focus and releases player and route audio on cleanup', async () => {
    const room = renderRoom()
    const grooveButton = screen.getAllByRole('button', { name: 'Groove' })[0]
    grooveButton.focus()
    fireEvent.click(grooveButton)
    const drawer = screen.getByRole('dialog')
    await waitFor(() =>
      expect(within(drawer).getByRole('tab', { name: 'Groove' })).toHaveFocus(),
    )
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    await waitFor(() => expect(grooveButton).toHaveFocus())

    room.unmount()
    expect(room.player.dispose).toHaveBeenCalledOnce()
    expect(room.player.listenerCount()).toBe(0)
    expect(room.session.dispose).toHaveBeenCalledOnce()
    expect(room.importSession.dispose).toHaveBeenCalledOnce()
    expect(room.importSession.listenerCount()).toBe(0)
  })

  it('traps input focus and restores its trigger after every close path', async () => {
    renderRoom()
    const inputTrigger = screen.getByRole('button', {
      name: /MIDI not connected/i,
    })
    inputTrigger.focus()
    fireEvent.click(inputTrigger)

    let dialog = screen.getByRole('dialog', { name: 'Drum input' })
    const connect = within(dialog).getByRole('button', {
      name: 'Connect MIDI input',
    })
    await waitFor(() => expect(connect).toHaveFocus())
    const close = within(dialog).getByRole('button', {
      name: 'Close input details',
    })
    const review = within(dialog).getByRole('button', {
      name: 'Review sound and mapping',
    })

    review.focus()
    fireEvent.keyDown(review, { key: 'Tab' })
    expect(close).toHaveFocus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(review).toHaveFocus()
    fireEvent.keyDown(review, { key: 'Escape' })
    await waitFor(() => expect(inputTrigger).toHaveFocus())
    expect(
      screen.queryByRole('dialog', { name: 'Drum input' }),
    ).not.toBeInTheDocument()

    fireEvent.click(inputTrigger)
    dialog = screen.getByRole('dialog', { name: 'Drum input' })
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Connect MIDI input' }),
      ).toHaveFocus(),
    )
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Close input details' }),
    )
    await waitFor(() => expect(inputTrigger).toHaveFocus())

    fireEvent.click(inputTrigger)
    await waitFor(() =>
      expect(
        within(screen.getByRole('dialog', { name: 'Drum input' })).getByRole(
          'button',
          { name: 'Connect MIDI input' },
        ),
      ).toHaveFocus(),
    )
    fireEvent.pointerDown(document.body, { button: 0, isPrimary: true })
    await waitFor(() => expect(inputTrigger).toHaveFocus())
    expect(
      screen.queryByRole('dialog', { name: 'Drum input' }),
    ).not.toBeInTheDocument()
  })

  it('makes the rack a truthful modal while retaining playable pads inside it', async () => {
    renderRoom()
    const shell = screen.getByTestId('drum-night-shell')
    const skipLink = screen.getByText('Skip to the drum stage')
    const sessionBar = shell.querySelector('header')
    const backgroundPads = shell.querySelector<HTMLElement>(
      '[aria-label="Touch drum pads"]',
    )
    expect(sessionBar).not.toBeNull()
    expect(backgroundPads).not.toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Groove' })[0])
    const drawer = screen.getByRole('dialog', { name: 'Shape the groove' })
    expect(drawer).toHaveAttribute('aria-modal', 'true')
    expect(skipLink).toHaveAttribute('aria-hidden', 'true')
    expect(
      within(drawer).getByRole('group', { name: 'Rack drawer drum pads' }),
    ).toContainElement(
      within(drawer).getByRole('button', {
        name: 'Acoustic snare, key 2',
      }),
    )

    const sourceVariation = within(drawer).getByRole('button', {
      name: 'Source',
    })
    expect(sourceVariation).toHaveAttribute('aria-pressed', 'true')
    expect(within(sourceVariation).getByText('Selected')).toBeVisible()

    fireEvent.click(within(drawer).getByRole('tab', { name: 'Kit' }))
    const selectedKit = within(drawer).getByRole('radio', {
      name: /Mercury Synth/i,
    })
    expect(selectedKit).toHaveAttribute('aria-checked', 'true')
    expect(within(selectedKit).getByText('Selected')).toBeVisible()

    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Close rack drawer' }),
    )
    expect(skipLink).toHaveAttribute('aria-hidden', 'false')
    const hiddenScrim = shell.querySelector<HTMLElement>(
      'button[aria-label="Close rack drawer"][tabindex="-1"]',
    )
    expect(hiddenScrim).toHaveAttribute('aria-hidden', 'true')
  })

  it('keeps contextual drawer controls keyboard reachable without an invalid tablist', async () => {
    renderRoom()
    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    const drawer = screen.getByRole('dialog', { name: 'Bring a drum part' })
    expect(within(drawer).queryByRole('tablist')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(
        within(drawer).getByRole('button', { name: 'Rack controls' }),
      ).toHaveFocus(),
    )
    expect(
      within(drawer).getByLabelText('Choose a drum session file'),
    ).toHaveAttribute('tabindex', '-1')
  })

  it('supports complete arrow-key behavior for workbench tabs and kit radios', async () => {
    const room = renderRoom()
    fireEvent.click(screen.getAllByRole('button', { name: 'Groove' })[0])
    const drawer = screen.getByRole('dialog', { name: 'Shape the groove' })
    const grooveTab = within(drawer).getByRole('tab', { name: 'Groove' })
    await waitFor(() => expect(grooveTab).toHaveFocus())

    fireEvent.keyDown(grooveTab, { key: 'ArrowRight' })
    const kitTab = within(drawer).getByRole('tab', { name: 'Kit' })
    expect(kitTab).toHaveFocus()
    expect(kitTab).toHaveAttribute('aria-selected', 'true')
    expect(within(drawer).getByRole('tabpanel', { name: 'Kit' })).toBeVisible()

    const synth = within(drawer).getByRole('radio', {
      name: /Mercury Synth/i,
    })
    synth.focus()
    fireEvent.keyDown(synth, { key: 'ArrowRight' })
    const classic = within(drawer).getByRole('radio', { name: /Classic GM/i })
    expect(classic).toHaveFocus()
    expect(classic).toHaveAttribute('aria-checked', 'true')
    expect(room.player.selectKit).toHaveBeenLastCalledWith('classic-gm')

    fireEvent.keyDown(classic, { key: 'End' })
    const live = within(drawer).getByRole('radio', { name: /Live/i })
    expect(live).toHaveFocus()
    expect(live).toHaveAttribute('aria-checked', 'true')
    expect(room.player.selectKit).toHaveBeenLastCalledWith('live')

    fireEvent.keyDown(kitTab, { key: 'End' })
    const roomTab = within(drawer).getByRole('tab', { name: 'Room' })
    expect(roomTab).toHaveFocus()
    expect(roomTab).toHaveAttribute('aria-selected', 'true')
  })

  it('reconciles URL drawer history with the selected and focused rack tab', async () => {
    renderRoom()
    fireEvent.click(screen.getAllByRole('button', { name: 'Groove' })[0])
    const drawer = screen.getByRole('dialog', { name: 'Shape the groove' })
    const grooveTab = within(drawer).getByRole('tab', { name: 'Groove' })
    await waitFor(() => expect(grooveTab).toHaveFocus())

    const kitTab = within(drawer).getByRole('tab', { name: 'Kit' })
    kitTab.focus()
    fireEvent.click(kitTab)
    expect(window.location.search).toBe('?drawer=kit')
    expect(kitTab).toHaveFocus()

    window.history.replaceState({}, '', '/drum-night?drawer=groove')
    window.dispatchEvent(new PopStateEvent('popstate'))

    await waitFor(() => expect(grooveTab).toHaveFocus())
    expect(grooveTab).toHaveAttribute('aria-selected', 'true')
    expect(kitTab).toHaveAttribute('aria-selected', 'false')
    expect(
      within(drawer).getByRole('tabpanel', { name: 'Groove' }),
    ).toBeVisible()
  })

  it('shows an unbounded current bar after the take passes beat 64', async () => {
    const clock = new TestClock()
    renderRoom({ clock })
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Live drums take clock',
      })[0],
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', {
          name: 'Pause Live drums take clock',
        }),
      ).not.toHaveLength(0),
    )

    clock.advanceTo(2_500 + 65 * 625)

    expect(
      screen.getByLabelText('Current bar 17, unbounded take'),
    ).toBeVisible()
    expect(screen.getByText('Bar 17')).toBeVisible()
    expect(screen.queryByText(/of 16/i)).not.toBeInTheDocument()
  })

  it('reactivates audio before retrying an initial graph failure', async () => {
    const room = renderRoom({ activationResults: [false, true] })
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Live drums take clock',
      })[0],
    )

    const alert = await screen.findByRole('alert')
    expect(
      within(alert).getByText(/audio context is unavailable/i),
    ).toBeVisible()
    fireEvent.click(
      within(alert).getByRole('button', { name: 'Try audio again' }),
    )

    await waitFor(() => expect(room.player.activate).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(room.player.retry).toHaveBeenCalledOnce())
    expect(room.player.activate.mock.invocationCallOrder[1]).toBeLessThan(
      room.player.retry.mock.invocationCallOrder[0],
    )
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
  })

  it('keeps the live mixer range operable', async () => {
    const room = renderRoom()
    fireEvent.click(screen.getAllByRole('button', { name: 'Groove' })[0])
    const drawer = screen.getByRole('dialog', { name: 'Shape the groove' })
    fireEvent.click(within(drawer).getByRole('tab', { name: 'Mix' }))
    const kitLevel = within(drawer).getByRole('slider', { name: 'Kit level' })

    fireEvent.input(kitLevel, { target: { value: '64' } })

    expect(room.player.player.setVolume).toHaveBeenLastCalledWith(0.64)
    expect(kitLevel).toBeEnabled()
  })

  it('renders every honest import state and promotes percussion-only ready files to the score', () => {
    const importSession = importSessionHarness()
    renderRoom({ importSession })
    fireEvent.click(screen.getByRole('button', { name: 'Score view' }))

    expect(screen.getByLabelText('score session state')).toHaveTextContent(
      'No drum part loaded',
    )

    const states: readonly [DrumSessionImportState, string][] = [
      [{ status: 'loading', fileName: 'take.mid' }, 'Reading take.mid'],
      [{ status: 'empty', fileName: 'empty.mid' }, 'This file is empty'],
      [
        {
          status: 'too-large',
          fileName: 'large.gp',
          actualBytes: 24 * 1024 * 1024,
          maximumBytes: 20 * 1024 * 1024,
        },
        'This file is too large to open safely',
      ],
      [
        {
          status: 'unsupported',
          fileName: 'part.pdf',
          reason: 'file-type',
          droppedHitCount: 0,
        },
        'File type not supported',
      ],
      [
        {
          status: 'unsupported',
          fileName: 'unknown.gpx',
          reason: 'drum-mapping',
          droppedHitCount: 3,
        },
        'No safely mapped drum hits',
      ],
      [
        { status: 'no-drums', fileName: 'piano.mid', pitchedTrackCount: 2 },
        'No drum track in this file',
      ],
      [
        {
          status: 'error',
          fileName: 'damaged.gp5',
          message: 'The parser could not read this score.',
        },
        'The drum part could not be opened',
      ],
    ]

    for (const [state, expectedCopy] of states) {
      importSession.setState(state)
      expect(screen.getByLabelText('score session state')).toHaveTextContent(
        expectedCopy,
      )
    }

    importSession.setState(readySessionFixture({ title: 'Percussion Study' }))
    expect(
      screen.getByRole('heading', { name: 'Percussion Study' }),
    ).toBeVisible()
    expect(screen.getByText('Imported percussion score')).toBeVisible()
    expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
      'data-session-status',
      'ready',
    )
  })

  it('keeps replacement and cancellation available while an import is loading', () => {
    const importSession = importSessionHarness({
      status: 'loading',
      fileName: 'long-take.mid',
    })
    renderRoom({ importSession })
    fireEvent.click(screen.getAllByRole('button', { name: 'Songs' })[0])
    const drawer = screen.getByRole('dialog', { name: 'Bring a drum part' })

    expect(
      within(drawer).getByRole('button', {
        name: 'Choose a different part',
      }),
    ).toBeEnabled()
    fireEvent.click(
      within(drawer).getByRole('button', { name: 'Cancel import' }),
    )

    expect(importSession.cancel).toHaveBeenCalledOnce()
    expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
      'data-session-status',
      'idle',
    )
    expect(
      screen.getByText(
        'Drum part import cancelled. Nothing was partially loaded.',
      ),
    ).toBeVisible()
  })

  it('imports from the picker and drop zone, ignores stale UI attempts, and keeps recovery visible', async () => {
    const ready = readySessionFixture({ title: 'Pocket From File' })
    const importSession = importSessionHarness()
    const onReadySessionChange = vi.fn()
    importSession.setNextResult(ready)
    renderRoom({ importSession, onReadySessionChange })

    fireEvent.click(screen.getByRole('button', { name: 'Songs' }))
    let drawer = screen.getByRole('dialog', { name: 'Bring a drum part' })
    const file = new File([new Uint8Array([1, 2, 3])], 'pocket.mid', {
      type: 'audio/midi',
    })
    const fileList = {
      0: file,
      length: 1,
      item: () => file,
    } as unknown as FileList
    fireEvent.change(
      within(drawer).getByLabelText('Choose a drum session file'),
      { target: { files: fileList } },
    )

    await waitFor(() =>
      expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
        'data-view',
        'score',
      ),
    )
    expect(importSession.importFile).toHaveBeenCalledWith(file)
    expect(window.location.search).toBe('?view=score')
    expect(onReadySessionChange).toHaveBeenLastCalledWith(ready.document)

    fireEvent.click(screen.getByRole('button', { name: 'Songs' }))
    drawer = screen.getByRole('dialog', { name: 'Bring a drum part' })
    expect(
      within(drawer).getByText(/Percussion-only session ready/i),
    ).toBeVisible()

    const damaged = new File([new Uint8Array([4])], 'damaged.gpx')
    importSession.setNextResult({
      status: 'error',
      fileName: damaged.name,
      message: 'Guitar Pro data ended unexpectedly.',
    })
    fireEvent.drop(
      within(drawer).getByRole('group', {
        name: 'Drop a drum session file',
      }),
      {
        dataTransfer: {
          files: { item: () => damaged },
        },
      },
    )
    await waitFor(() =>
      expect(within(drawer).getByRole('alert')).toHaveTextContent(
        'Guitar Pro data ended unexpectedly.',
      ),
    )
    expect(onReadySessionChange).toHaveBeenLastCalledWith(null)
    expect(
      within(drawer).getByRole('button', { name: 'Choose drum part' }),
    ).toBeEnabled()
  })

  it('reuses one score index across Seat, Score, and Coach and restores the view from the URL', () => {
    window.history.replaceState({}, '', '/drum-night?view=seat')
    const ready = readySessionFixture({ title: 'Seat Map Study' })
    const importSession = importSessionHarness(ready)
    const createScoreIndex = vi.fn((document: typeof ready.document) =>
      createDrumScoreIndex(document),
    )
    renderRoom({ createScoreIndex, importSession })

    expect(screen.getByTestId('drum-night-shell')).toHaveAttribute(
      'data-view',
      'seat',
    )
    const backdrop = screen.getByTestId('drummer-seat-backdrop')
    expect(backdrop.querySelector('img')).toHaveAttribute(
      'src',
      '/drum-night/drummer-seat-landscape.webp',
    )
    expect(backdrop.querySelector('source')).toHaveAttribute(
      'srcset',
      '/drum-night/drummer-seat-portrait.webp',
    )
    expect(screen.getByText('Drummer’s seat')).toBeVisible()
    expect(createScoreIndex).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Score view' }))
    expect(screen.getByText('Imported percussion score')).toBeVisible()
    expect(window.location.search).toBe('?view=score')
    expect(createScoreIndex).toHaveBeenCalledOnce()

    fireEvent.click(
      screen.getByRole('button', { name: 'Open live take monitor' }),
    )
    expect(
      within(
        screen.getByRole('dialog', { name: 'Recover the backbeat' }),
      ).getByRole('heading', { name: 'Phrase coach' }),
    ).toBeVisible()
    expect(createScoreIndex).toHaveBeenCalledOnce()
  })

  it('keeps a late indexed phrase visible after the bounded score projection', async () => {
    const clock = new TestClock()
    const earlyHits = Array.from({ length: 2_050 }, (_, index) => ({
      id: `early-${index}`,
      gmKey: 42,
      startBeat: index * 0.25,
      velocity: 72,
    }))
    const ready = readySessionFixture({
      title: 'Long Form Pocket',
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              ...earlyHits,
              {
                id: 'late-kick',
                gmKey: 36,
                startBeat: 12_000,
                velocity: 112,
              },
            ],
          }),
        ],
      }),
    })
    renderRoom({ clock, importSession: importSessionHarness(ready) })
    fireEvent.click(screen.getByRole('button', { name: 'Score view' }))
    fireEvent.click(screen.getByText('Count-in').closest('button')!)
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Long Form Pocket take clock',
      })[0],
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', {
          name: 'Pause Long Form Pocket take clock',
        }),
      ).not.toHaveLength(0),
    )

    clock.advanceTo(12_000 * 500)

    expect(screen.getByText('Now: Bass Drum 1')).toBeVisible()
    expect(screen.getAllByText(/Bar 3001/)).not.toHaveLength(0)
  })

  it('uses authored 6/8 bars in the top session map', async () => {
    const clock = new TestClock()
    const baseSong = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          hits: [
            { id: 'kick-1', gmKey: 36, startBeat: 0, velocity: 96 },
            { id: 'kick-2', gmKey: 36, startBeat: 8.5, velocity: 96 },
          ],
        }),
      ],
    })
    const ready = readySessionFixture({
      title: 'Six Eight Study',
      song: {
        ...baseSong,
        timeSignatures: [{ beat: 0, numerator: 6, denominator: 8 }],
      },
    })
    renderRoom({ clock, importSession: importSessionHarness(ready) })
    fireEvent.click(screen.getByText('Count-in').closest('button')!)
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Six Eight Study take clock',
      })[0],
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', {
          name: 'Pause Six Eight Study take clock',
        }),
      ).not.toHaveLength(0),
    )

    clock.advanceTo(1_600)

    expect(
      screen.getByLabelText('Current bar 2, 3 authored bars'),
    ).toBeVisible()
  })

  it('schedules authored drums only after Play and discloses bounded routing truth', async () => {
    const clock = new TestClock()
    const simultaneousHits = Array.from({ length: 50 }, (_, index) => ({
      id: `stack-${index}`,
      gmKey: 38,
      startBeat: 0,
      velocity: 90,
    }))
    const denseHits = Array.from({ length: 260 }, (_, index) => ({
      id: `dense-${index}`,
      gmKey: 42,
      startBeat: 0.01 + index * 0.0003,
      velocity: 68,
    }))
    const song = drumSongFixture({
      percussionTracks: [
        percussionTrackFixture({
          hits: [...simultaneousHits, ...denseHits],
          droppedHitCount: 2,
        }),
      ],
    })
    const ready = readySessionFixture({
      title: 'Dense Scheduler Truth',
      song: {
        ...song,
        tempoChanges: Array.from({ length: 200 }, (_, index) => ({
          beat: index,
          usPerBeat: index === 0 ? 1 : 500_000,
        })),
      },
    })
    const room = renderRoom({
      clock,
      importSession: importSessionHarness(ready),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Score view' }))

    expect(room.player.activate).not.toHaveBeenCalled()
    expect(room.player.trigger).not.toHaveBeenCalled()
    expect(
      room.session.performanceTimestampToContextTime,
    ).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Count-in').closest('button')!)
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Dense Scheduler Truth take clock',
      })[0],
    )

    await waitFor(() =>
      expect(room.player.trigger).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: expect.stringMatching(/^authored:/),
        }),
      ),
    )
    const playbackTruth = screen.getByRole('note')
    expect(playbackTruth).toHaveTextContent(
      '2 unsupported source hits stay silent',
    )
    expect(playbackTruth).toHaveTextContent('2 simultaneous hits are silent')
    expect(playbackTruth).toHaveTextContent(/in-range hits are waiting/i)
    expect(playbackTruth).toHaveTextContent(
      /source tempo changes were omitted from the bounded playback map/i,
    )
    expect(playbackTruth).toHaveTextContent(
      /source tempo value was clamped to the supported 40–280 BPM range/i,
    )
    expect(playbackTruth).toHaveTextContent(/attacks are using synth fallback/i)
    expect(screen.getByText(/No metronome click is scheduled/i)).toBeVisible()

    clock.advanceTo(500)
    await waitFor(() =>
      expect(playbackTruth).toHaveTextContent(
        /delayed hits missed the bounded scheduling window and stayed silent/i,
      ),
    )
  })

  it('resets take evidence and practice state when the imported document changes', async () => {
    const clock = new TestClock()
    const first = readySessionFixture({
      title: 'First Pocket',
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              { id: 'first', gmKey: 38, startBeat: 1, velocity: 100 },
              { id: 'tail', gmKey: 36, startBeat: 8, velocity: 90 },
            ],
          }),
        ],
      }),
    })
    const second = readySessionFixture({
      title: 'Second Pocket',
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              { id: 'second', gmKey: 38, startBeat: 1, velocity: 100 },
              { id: 'tail', gmKey: 36, startBeat: 8, velocity: 90 },
            ],
          }),
        ],
      }),
    })
    const importSession = importSessionHarness(first)
    renderRoom({ clock, importSession })

    fireEvent.click(screen.getAllByRole('button', { name: 'Learn' })[0])
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start silent take clock at 82 BPM',
      }),
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', {
          name: 'Pause First Pocket take clock',
        }),
      ).not.toHaveLength(0),
    )
    clock.advanceTo(4_000)
    dispatchPointerDown(
      within(screen.getByLabelText('Touch drum pads')).getByRole('button', {
        name: 'Acoustic snare, key 2',
      }),
      { button: 0, isPrimary: true, pressure: 0.7 },
    )
    await waitFor(() =>
      expect(
        screen.getByText('Take events').closest('button'),
      ).toHaveTextContent('1 hits'),
    )
    expect(
      screen.getByText('Practice loop').closest('button'),
    ).not.toHaveTextContent('Off')

    importSession.setState(second)

    await waitFor(() =>
      expect(
        screen.getByText('Take events').closest('button'),
      ).toHaveTextContent('0 hits'),
    )
    expect(
      screen.getByText('Practice loop').closest('button'),
    ).toHaveTextContent('Off')
    expect(screen.getByText('Play the imported phrase once.')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Clear active .* loop/i }),
    ).not.toBeInTheDocument()
  })

  it('discloses older take events discarded by the bounded evidence window', async () => {
    const clock = new TestClock()
    renderRoom({ clock, maxRecordedHits: 3 })
    fireEvent.click(screen.getByText('Count-in').closest('button')!)
    fireEvent.click(screen.getByText('Take events').closest('button')!)
    fireEvent.click(
      screen.getAllByRole('button', { name: /Play .* take clock/i })[0],
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /Pause .* take clock/i }),
      ).not.toHaveLength(0),
    )

    const snare = within(screen.getByLabelText('Touch drum pads')).getByRole(
      'button',
      { name: 'Acoustic snare, key 2' },
    )
    for (let index = 1; index <= 5; index += 1) {
      clock.advanceTo(index * 10)
      dispatchPointerDown(snare, {
        button: 0,
        isPrimary: true,
        pressure: 0.7,
      })
    }

    await waitFor(() =>
      expect(
        screen.getByText('Take events').closest('button'),
      ).toHaveTextContent('3 hits · 2 older not retained'),
    )
  })

  it('shows a truthful waiting-for-audio scheduler state', async () => {
    const clock = new TestClock()
    const ready = readySessionFixture({ title: 'Waiting Pocket' })
    renderRoom({
      clock,
      importSession: importSessionHarness(ready),
      schedulerAudioReady: false,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Score view' }))
    fireEvent.click(screen.getByText('Count-in').closest('button')!)
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Waiting Pocket take clock',
      })[0],
    )

    await waitFor(() =>
      expect(screen.getByRole('note')).toHaveTextContent(
        'Authored playback is waiting for active drum audio',
      ),
    )
  })

  it('sets a measured recovery bar on the shared loop at 70 percent', async () => {
    const clock = new TestClock()
    const ready = readySessionFixture({
      title: 'Recovery Study',
      song: drumSongFixture({
        percussionTracks: [
          percussionTrackFixture({
            hits: [
              { id: 'snare-1', gmKey: 38, startBeat: 1, velocity: 100 },
              { id: 'snare-2', gmKey: 38, startBeat: 2, velocity: 100 },
              { id: 'tail', gmKey: 36, startBeat: 3.5, velocity: 90 },
            ],
          }),
        ],
      }),
    })
    renderRoom({ clock, importSession: importSessionHarness(ready) })
    fireEvent.click(screen.getByText('Count-in').closest('button')!)
    fireEvent.click(screen.getByText('Take events').closest('button')!)
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Recovery Study take clock',
      })[0],
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', {
          name: 'Pause Recovery Study take clock',
        }),
      ).not.toHaveLength(0),
    )

    const snare = within(screen.getByLabelText('Touch drum pads')).getByRole(
      'button',
      { name: 'Acoustic snare, key 2' },
    )
    clock.advanceTo(550)
    dispatchPointerDown(snare, {
      button: 0,
      isPrimary: true,
      pressure: 0.7,
    })
    clock.advanceTo(1_050)
    dispatchPointerDown(snare, {
      button: 0,
      isPrimary: true,
      pressure: 0.7,
    })

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Set recovery loop to bar 1',
      }),
    )

    expect(
      screen.getByText('Practice loop').closest('button'),
    ).toHaveTextContent('3.5-beat recovery · 70%')
    expect(screen.getByText(/Recovery loop set to bar 1 at 70%/i)).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Clear active 3.5-beat recovery · 70%',
      }),
    )

    expect(
      screen.getByText('Practice loop').closest('button'),
    ).toHaveTextContent('Off')
    expect(
      screen.queryByRole('button', { name: /Clear active .* loop/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Recovery loop cleared.*tempo returned to 100%/i),
    ).toBeVisible()
  })

  it('keeps all six live pads available on a phone in Score and Drummer Seat views', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 390,
    })
    const ready = readySessionFixture({ title: 'Phone Pocket' })
    renderRoom({ importSession: importSessionHarness(ready) })
    const touchKit = screen.getByLabelText('Touch drum pads')

    fireEvent.click(screen.getByRole('button', { name: 'Score view' }))
    expect(within(touchKit).getAllByRole('button')).toHaveLength(6)
    for (const pad of within(touchKit).getAllByRole('button')) {
      expect(pad).toBeEnabled()
      expect(pad).toHaveAttribute('aria-keyshortcuts')
    }

    fireEvent.click(screen.getByRole('button', { name: 'Drummer Seat view' }))
    expect(screen.getByTestId('drummer-seat-backdrop')).toBeInTheDocument()
    expect(within(touchKit).getAllByRole('button')).toHaveLength(6)
  })
})
