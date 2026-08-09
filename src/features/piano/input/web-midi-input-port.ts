// ============================================================
// Web MIDI input port — selected-device browser boundary
// ============================================================
//
// Permission is requested only by connect(), never by construction. Exactly
// one selected input is routed at a time; switching, hot-unplugging, and
// disposal emit source cleanup before a listener can be left behind.

import type { PianoInputEvent, PianoInputSource } from './piano-input-state'

export type WebMidiPermissionState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'disposed'

export interface WebMidiInputDevice {
  readonly id: string
  readonly name: string
  readonly manufacturer: string | null
  readonly state: MIDIPortDeviceState
  readonly connection: MIDIPortConnectionState
}

export interface WebMidiInputPortSnapshot {
  readonly revision: number
  readonly permission: WebMidiPermissionState
  readonly devices: readonly WebMidiInputDevice[]
  /** A manually selected id remains visible while that device is unplugged. */
  readonly selectedInputId: string | null
  readonly connected: boolean
}

export type WebMidiInputPortListener = (
  snapshot: WebMidiInputPortSnapshot,
) => void

export interface WebMidiInputPort {
  /** Explicit user-intent boundary that may show the browser MIDI prompt. */
  connect(): Promise<boolean>
  /** Releases browser listeners and permits a later explicit reconnect. */
  disconnect(): void
  /** Selects one available input, or null to route none. */
  selectInput(inputId: string | null): boolean
  snapshot(): WebMidiInputPortSnapshot
  subscribe(listener: WebMidiInputPortListener): () => void
  dispose(): void
}

export interface WebMidiInputPortOptions {
  onInput(event: PianoInputEvent): void
  requestMIDIAccess?: () => Promise<MIDIAccess>
  now?: () => number
  /** Defaults to true to preserve the legacy first-keyboard behavior. */
  autoSelectFirst?: boolean
}

type SelectionMode = 'auto' | 'manual'

const PEDAL_CONTROLLERS = new Map<number, 'sustain' | 'sostenuto' | 'soft'>([
  [64, 'sustain'],
  [66, 'sostenuto'],
  [67, 'soft'],
])

function defaultRequestMIDIAccess(): Promise<MIDIAccess> {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.requestMIDIAccess !== 'function'
  ) {
    return Promise.reject(new Error('Web MIDI is not supported'))
  }
  return navigator.requestMIDIAccess()
}

function inputIsAvailable(input: MIDIInput): boolean {
  return input.state !== 'disconnected'
}

function inputSource(input: MIDIInput): PianoInputSource {
  return Object.freeze({
    kind: 'midi',
    id: input.id,
    name: input.name ?? 'Unknown MIDI input',
  })
}

function inputDevice(input: MIDIInput): WebMidiInputDevice {
  return Object.freeze({
    id: input.id,
    name: input.name ?? 'Unknown MIDI input',
    manufacturer: input.manufacturer,
    state: input.state,
    connection: input.connection,
  })
}

/** Create a lazy Web MIDI boundary around one selected hardware input. */
export function createWebMidiInputPort(
  options: WebMidiInputPortOptions,
): WebMidiInputPort {
  const hasInjectedRequest = options.requestMIDIAccess !== undefined
  const requestMIDIAccess =
    options.requestMIDIAccess ?? defaultRequestMIDIAccess
  const now = options.now ?? (() => performance.now())
  const autoSelectFirst = options.autoSelectFirst ?? true
  const listeners = new Set<WebMidiInputPortListener>()
  const availableInputs = new Map<string, MIDIInput>()
  let access: MIDIAccess | null = null
  let attachedInput: MIDIInput | null = null
  let attachedMessageHandler: ((event: MIDIMessageEvent) => void) | null = null
  let attachedWithEventListener = false
  let previousMessageHandler:
    | ((this: MIDIInput, ev: MIDIMessageEvent) => void)
    | null = null
  let previousStateHandler:
    | ((this: MIDIAccess, ev: MIDIConnectionEvent) => void)
    | null = null
  let accessWithEventListener = false
  let selectedInputId: string | null = null
  let selectionMode: SelectionMode = autoSelectFirst ? 'auto' : 'manual'
  let permission: WebMidiPermissionState = 'idle'
  let revision = 0
  let generation = 0
  let connectPromise: Promise<boolean> | null = null
  let disposed = false

  function buildSnapshot(): WebMidiInputPortSnapshot {
    return Object.freeze({
      revision,
      permission,
      devices: Object.freeze(
        Array.from(availableInputs.values()).map(inputDevice),
      ),
      selectedInputId,
      connected: attachedInput !== null,
    })
  }

  let currentSnapshot = buildSnapshot()

  function publish(): void {
    revision += 1
    currentSnapshot = buildSnapshot()
    for (const listener of listeners) listener(currentSnapshot)
  }

  function emitSourceDisconnected(input: MIDIInput): void {
    options.onInput(
      Object.freeze({
        type: 'source-disconnected',
        source: inputSource(input),
        timestampMs: now(),
      }),
    )
  }

  function detachSelectedInput(emitCleanup: boolean): void {
    if (attachedInput === null) return
    if (attachedMessageHandler !== null) {
      if (attachedWithEventListener) {
        attachedInput.removeEventListener('midimessage', attachedMessageHandler)
      } else if (attachedInput.onmidimessage === attachedMessageHandler) {
        attachedInput.onmidimessage = previousMessageHandler
      }
    }
    if (emitCleanup) emitSourceDisconnected(attachedInput)
    attachedInput = null
    attachedMessageHandler = null
    attachedWithEventListener = false
    previousMessageHandler = null
  }

  function routeMessage(input: MIDIInput, message: MIDIMessageEvent): void {
    if (input !== attachedInput) return
    const data = message.data
    if (data === null || data.length < 2) return

    const command = data[0] & 0xf0
    const channel = data[0] & 0x0f
    const data1 = data[1]
    const data2 = data.length >= 3 ? data[2] : 0
    const source = inputSource(input)
    const timestampMs = Number.isFinite(message.timeStamp)
      ? message.timeStamp
      : now()

    if (command === 0x90 && data2 > 0) {
      options.onInput({
        type: 'note-on',
        source,
        channel,
        midi: data1,
        velocity: data2 / 127,
        timestampMs,
      })
      return
    }

    if (command === 0x80 || (command === 0x90 && data2 === 0)) {
      options.onInput({
        type: 'note-off',
        source,
        channel,
        midi: data1,
        velocity: data2 / 127,
        timestampMs,
      })
      return
    }

    if (command !== 0xb0) return
    const pedal = PEDAL_CONTROLLERS.get(data1)
    if (pedal !== undefined) {
      options.onInput({
        type: 'pedal',
        source,
        channel,
        pedal,
        value: data2 / 127,
        timestampMs,
      })
      return
    }

    if (data1 === 120) {
      options.onInput({
        type: 'panic',
        source,
        channel,
        timestampMs,
      })
    } else if (data1 === 121) {
      options.onInput({
        type: 'reset-controllers',
        source,
        channel,
        timestampMs,
      })
    } else if (data1 === 123) {
      options.onInput({
        type: 'all-notes-off',
        source,
        channel,
        timestampMs,
      })
    }
  }

  function attachSelectedInput(input: MIDIInput): void {
    if (attachedInput === input) return
    detachSelectedInput(true)
    attachedInput = input
    attachedMessageHandler = (message) => routeMessage(input, message)
    if (typeof input.addEventListener === 'function') {
      input.addEventListener('midimessage', attachedMessageHandler)
      attachedWithEventListener = true
    } else {
      previousMessageHandler = input.onmidimessage
      input.onmidimessage = attachedMessageHandler
    }
  }

  function reconcileInputs(): void {
    availableInputs.clear()
    if (access !== null) {
      for (const input of access.inputs.values()) {
        if (inputIsAvailable(input)) availableInputs.set(input.id, input)
      }
    }

    if (selectionMode === 'auto') {
      if (selectedInputId === null || !availableInputs.has(selectedInputId)) {
        selectedInputId = availableInputs.keys().next().value ?? null
      }
    }

    const selected =
      selectedInputId === null
        ? undefined
        : availableInputs.get(selectedInputId)
    if (selected === undefined) detachSelectedInput(true)
    else attachSelectedInput(selected)
    publish()
  }

  function handleStateChange(): void {
    if (!disposed) reconcileInputs()
  }

  function detachAccess(): void {
    if (access === null) return
    if (accessWithEventListener) {
      access.removeEventListener('statechange', handleStateChange)
    } else if (access.onstatechange === handleStateChange) {
      access.onstatechange = previousStateHandler
    }
    accessWithEventListener = false
    previousStateHandler = null
    access = null
  }

  async function connect(): Promise<boolean> {
    if (disposed) return false
    if (access !== null) {
      // Selecting “No MIDI input” is an explicit disconnect, but the next
      // Connect intent should still restore the default first-device behavior.
      // Preserve a manually selected missing id so hot-plug can reconnect the
      // exact keyboard the user chose.
      if (autoSelectFirst && selectedInputId === null) selectionMode = 'auto'
      reconcileInputs()
      return attachedInput !== null
    }
    if (connectPromise !== null) return connectPromise

    generation += 1
    const requestGeneration = generation
    permission = 'requesting'
    publish()

    const pending = (async () => {
      try {
        const nextAccess = await requestMIDIAccess()
        if (disposed || requestGeneration !== generation) return false
        access = nextAccess
        if (typeof nextAccess.addEventListener === 'function') {
          nextAccess.addEventListener('statechange', handleStateChange)
          accessWithEventListener = true
        } else {
          previousStateHandler = nextAccess.onstatechange
          nextAccess.onstatechange = handleStateChange
        }
        permission = 'granted'
        reconcileInputs()
        return attachedInput !== null
      } catch {
        if (disposed || requestGeneration !== generation) return false
        permission =
          !hasInjectedRequest &&
          (typeof navigator === 'undefined' ||
            typeof navigator.requestMIDIAccess !== 'function')
            ? 'unsupported'
            : 'denied'
        availableInputs.clear()
        publish()
        return false
      }
    })()
    connectPromise = pending
    try {
      return await pending
    } finally {
      if (connectPromise === pending) connectPromise = null
    }
  }

  function disconnectInternal(nextPermission: WebMidiPermissionState): void {
    generation += 1
    connectPromise = null
    detachSelectedInput(true)
    detachAccess()
    availableInputs.clear()
    permission = nextPermission
    publish()
  }

  return {
    connect,
    disconnect() {
      if (disposed) return
      disconnectInternal('idle')
    },
    selectInput(inputId) {
      if (disposed) return false
      if (inputId !== null && !availableInputs.has(inputId)) return false
      selectionMode = 'manual'
      selectedInputId = inputId
      const selected =
        inputId === null ? undefined : availableInputs.get(inputId)
      if (selected === undefined) detachSelectedInput(true)
      else attachSelectedInput(selected)
      publish()
      return true
    },
    snapshot: () => currentSnapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      if (disposed) return
      disposed = true
      disconnectInternal('disposed')
      listeners.clear()
    },
  }
}
