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

function sessionHarness() {
  const contextForGesture = vi.fn(() => ({}) as AudioContext)
  const outputForGesture = vi.fn(() => ({}) as AudioNode)
  const dispose = vi.fn(async () => undefined)
  const session = {
    contextForGesture,
    outputForGesture,
    dispose,
  } satisfies DrumNightAudioSession
  return { contextForGesture, dispose, outputForGesture, session }
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
  readonly requestAccess?: () => Promise<DrumMidiAccessPort>
}) {
  const session = sessionHarness()
  const player = playerHarness('mercury-synth', options?.activationResults)
  const requestAccess =
    options?.requestAccess ??
    vi.fn(async () => options?.access ?? midiAccess([]))
  const mounted = render(() => (
    <DrumNightApp
      createAudioSession={() => session.session}
      createPlayer={player.createPlayer}
      runtimeOptions={{
        clock: options?.clock,
        midiEnvironment: {
          requestAccess,
          nowMs: options?.clock?.nowMs ?? (() => performance.now()),
          timeOriginMs: () => performance.timeOrigin,
        },
      }}
    />
  ))
  return { ...mounted, player, requestAccess, session }
}

let createAudioContext: ReturnType<typeof vi.fn>
let createWorker: ReturnType<typeof vi.fn>
let fetchRequest: ReturnType<typeof vi.fn>
let getUserMedia: ReturnType<typeof vi.fn>
let originalGetUserMedia: typeof navigator.mediaDevices.getUserMedia

beforeEach(() => {
  window.history.replaceState({}, '', '/drum-night')
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
    expect(screen.getByRole('status')).toHaveTextContent(
      'Audio, samples, and MIDI stay off',
    )
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
    const viewSwitcher = screen.getByRole('group', { name: 'Drum view' })
    fireEvent.click(within(viewSwitcher).getByRole('button', { name: 'Kit' }))

    dispatchPointerDown(
      within(screen.getByTestId('drum-night-kit-view')).getByRole('button', {
        name: 'Acoustic snare, key 2',
      }),
      { button: 2, isPrimary: true, pressure: 0.5 },
    )
    dispatchPointerDown(
      within(screen.getByTestId('drum-night-kit-view')).getByRole('button', {
        name: 'Acoustic snare, key 2',
      }),
      { button: 0, isPrimary: false, pressure: 0.5 },
    )
    expect(room.player.trigger).not.toHaveBeenCalled()

    dispatchPointerDown(
      within(screen.getByTestId('drum-night-kit-view')).getByRole('button', {
        name: 'Acoustic snare, key 2',
      }),
      { button: 0, isPrimary: true, pressure: 0.5 },
    )
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
          name: 'Pause Midnight Pocket take clock',
        }),
      ).not.toHaveLength(0),
    )
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
    expect(room.player.activate).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('combobox', { name: 'Active MIDI input' }),
    ).toHaveValue('a')

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
    expect(room.player.trigger).toHaveBeenLastCalledWith(
      expect.objectContaining({ gmKey: 38, velocity: 115, sourceId: 'b' }),
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
    expect(room.session.contextForGesture).toHaveBeenCalledOnce()
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

  it('shows an unbounded current bar after the take passes beat 64', async () => {
    const clock = new TestClock()
    renderRoom({ clock })
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Play Midnight Pocket take clock',
      })[0],
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', {
          name: 'Pause Midnight Pocket take clock',
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
        name: 'Play Midnight Pocket take clock',
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
})
