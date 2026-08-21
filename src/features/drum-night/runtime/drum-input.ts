// Drum Night input — keyboard and explicit-gesture WebMIDI ownership.
// ============================================================

import { drumPadForKeyboardCode, isGeneralMidiDrumKey } from './drum-pad-layout'
import type { DrumLiveHit } from './drum-runtime-types'

export type DrumMidiStatus =
  | 'idle'
  | 'requesting'
  | 'connected'
  | 'no-inputs'
  | 'disconnected'
  | 'unsupported'
  | 'denied'
  | 'error'

export interface DrumMidiInputSummary {
  readonly id: string
  readonly name: string
}

export interface DrumMidiControllerChange {
  readonly sourceId: string
  /** Original zero-based MIDI channel from the status low nibble. */
  readonly midiChannel: number
  readonly controller: number
  readonly value: number
  readonly timestampMs: number
}

export interface DrumMidiRawNoteEvent {
  readonly sourceId: string
  readonly midiChannel: number
  readonly rawMidiKey: number
  readonly velocity: number
  readonly timestampMs: number
}

export interface DrumMidiState {
  readonly status: DrumMidiStatus
  /** All connected input names, in deterministic input-id order. */
  readonly inputNames: readonly string[]
  readonly availableInputs: readonly DrumMidiInputSummary[]
  /** Exactly one input owns Drum Night events at a time. */
  readonly selectedInputId: string | null
  readonly selectedInputName: string | null
  readonly hasReceivedHit: boolean
  readonly learningTargetGmKey: number | null
  readonly controllerValues: readonly DrumMidiControllerChange[]
  readonly lastControllerChange: DrumMidiControllerChange | null
  /** The last note-on that was neither GM nor learned into a GM articulation. */
  readonly lastRawUnmappedNote: DrumMidiRawNoteEvent | null
  readonly errorMessage: string | null
}

/** Learned mappings are persisted per selected WebMIDI input id. */
export interface DrumMidiMappingStore {
  load(inputId: string): ReadonlyMap<number, number>
  save(inputId: string, mapping: ReadonlyMap<number, number>): void
}

export interface DrumMidiMessageLike {
  readonly data: Uint8Array | null
  readonly timeStamp: number
}

type DrumMidiMessageHandler = (event: DrumMidiMessageLike) => void
type DrumMidiStateHandler = (event?: Event) => void

export interface DrumMidiInputPort {
  readonly id: string
  readonly name?: string | null
  readonly state?: MIDIPortDeviceState
  onmidimessage: DrumMidiMessageHandler | null
  addEventListener?(type: 'midimessage', listener: DrumMidiMessageHandler): void
  removeEventListener?(
    type: 'midimessage',
    listener: DrumMidiMessageHandler,
  ): void
}

export interface DrumMidiInputCollection {
  values(): IterableIterator<DrumMidiInputPort>
}

export interface DrumMidiAccessPort {
  readonly inputs: DrumMidiInputCollection
  onstatechange: DrumMidiStateHandler | null
  addEventListener?(type: 'statechange', listener: DrumMidiStateHandler): void
  removeEventListener?(
    type: 'statechange',
    listener: DrumMidiStateHandler,
  ): void
}

export interface DrumMidiEnvironment {
  readonly requestAccess?: () => Promise<DrumMidiAccessPort>
  readonly nowMs: () => number
  readonly timeOriginMs?: () => number
}

export interface DrumMidiInputOptions {
  readonly environment?: DrumMidiEnvironment
  readonly mappingStore?: DrumMidiMappingStore | null
  readonly onHit: (hit: DrumLiveHit) => void
  readonly onControllerChange?: (change: DrumMidiControllerChange) => void
}

export interface DrumMidiInput {
  state(): DrumMidiState
  /** Mapping profile for the currently selected input only. */
  mapping(): ReadonlyMap<number, number>
  subscribe(listener: () => void): () => void
  connect(): Promise<boolean>
  disconnect(): void
  selectInput(inputId: string): boolean
  beginLearn(targetGmKey: number): boolean
  cancelLearn(): void
  clearMapping(sourceMidiKey?: number): void
  dispose(): void
}

const STORAGE_KEY = 'mp.drumNight.midiMapping.v2'

function defaultMidiEnvironment(): DrumMidiEnvironment {
  const midiNavigator = globalThis.navigator as Navigator & {
    requestMIDIAccess?: () => Promise<MIDIAccess>
  }
  return {
    requestAccess:
      typeof midiNavigator?.requestMIDIAccess === 'function'
        ? async () =>
            (await midiNavigator.requestMIDIAccess!()) as unknown as DrumMidiAccessPort
        : undefined,
    nowMs: () => performance.now(),
    timeOriginMs: () => performance.timeOrigin,
  }
}

function clampVelocity(value: number): number {
  return Math.min(127, Math.max(1, Math.round(value)))
}

function objectStringProperty(error: unknown, key: 'message' | 'name'): string {
  const record = error as Record<string, unknown> | null
  if (
    typeof record === 'object' &&
    record !== null &&
    key in record &&
    typeof record[key] === 'string'
  ) {
    return record[key]
  }
  return ''
}

function isPermissionError(error: unknown): boolean {
  const name = objectStringProperty(error, 'name')
  return name === 'NotAllowedError' || name === 'SecurityError'
}

function errorMessage(error: unknown): string {
  const message = objectStringProperty(error, 'message')
  return message.length > 0 ? message : 'MIDI connection failed.'
}

/** Bring epoch-like and stale device stamps onto the current performance clock. */
export function normalizeDrumInputTimestampMs(
  eventTimestampMs: number,
  nowMs: number,
  timeOriginMs?: number,
): number {
  const pastToleranceMs = 60_000
  const futureToleranceMs = 1_000
  if (
    Number.isFinite(eventTimestampMs) &&
    eventTimestampMs >= nowMs - pastToleranceMs &&
    eventTimestampMs <= nowMs + futureToleranceMs
  ) {
    return eventTimestampMs
  }

  const relativeTimestampMs = eventTimestampMs - (timeOriginMs ?? NaN)
  if (
    Number.isFinite(relativeTimestampMs) &&
    relativeTimestampMs >= nowMs - pastToleranceMs &&
    relativeTimestampMs <= nowMs + futureToleranceMs
  ) {
    return relativeTimestampMs
  }
  return nowMs
}

function validMapping(
  entries: ReadonlyMap<number, number>,
): Map<number, number> {
  const mapping = new Map<number, number>()
  for (const [sourceKey, targetKey] of entries) {
    if (
      Number.isInteger(sourceKey) &&
      sourceKey >= 0 &&
      sourceKey <= 127 &&
      isGeneralMidiDrumKey(targetKey)
    ) {
      mapping.set(sourceKey, targetKey)
    }
  }
  return mapping
}

export function createLocalDrumMidiMappingStore(
  storage: Storage,
): DrumMidiMappingStore {
  const readProfiles = (): Record<string, Record<string, unknown>> => {
    try {
      const raw = storage.getItem(STORAGE_KEY)
      if (raw === null) return {}
      const parsed = JSON.parse(raw) as {
        version?: unknown
        profiles?: unknown
      }
      if (
        parsed.version !== 2 ||
        typeof parsed.profiles !== 'object' ||
        parsed.profiles === null
      ) {
        return {}
      }
      return parsed.profiles as Record<string, Record<string, unknown>>
    } catch {
      return {}
    }
  }

  return {
    load(inputId): ReadonlyMap<number, number> {
      const profile = readProfiles()[inputId]
      if (typeof profile !== 'object' || profile === null) return new Map()
      const mapping = new Map<number, number>()
      for (const [source, target] of Object.entries(profile)) {
        const sourceKey = Number(source)
        if (
          Number.isInteger(sourceKey) &&
          sourceKey >= 0 &&
          sourceKey <= 127 &&
          typeof target === 'number' &&
          isGeneralMidiDrumKey(target)
        ) {
          mapping.set(sourceKey, target)
        }
      }
      return mapping
    },
    save(inputId, mapping): void {
      try {
        const profiles = readProfiles()
        profiles[inputId] = Object.fromEntries(mapping)
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, profiles }))
      } catch {
        // A private or full storage area must not block a playable kit.
      }
    },
  }
}

function displayInputName(input: DrumMidiInputPort): string {
  const name = input.name?.trim()
  return name !== undefined && name.length > 0 ? name : 'MIDI drum input'
}

function compareInputs(
  left: DrumMidiInputPort,
  right: DrumMidiInputPort,
): number {
  const idOrder = left.id.localeCompare(right.id)
  return idOrder === 0
    ? displayInputName(left).localeCompare(displayInputName(right))
    : idOrder
}

export function createDrumMidiInput(
  options: DrumMidiInputOptions,
): DrumMidiInput {
  const environment = options.environment ?? defaultMidiEnvironment()
  const listeners = new Set<() => void>()
  const mappingsByInput = new Map<string, Map<number, number>>()
  const controllerValues = new Map<string, DrumMidiControllerChange>()
  let access: DrumMidiAccessPort | null = null
  let allInputs = new Map<string, DrumMidiInputPort>()
  let selectedInput: DrumMidiInputPort | null = null
  let preferredInputId: string | null = null
  let unbindSelectedInput: (() => void) | null = null
  let unbindAccessState: (() => void) | null = null
  let connecting: Promise<boolean> | null = null
  let generation = 0
  let disposed = false
  let wasConnected = false
  let currentState: DrumMidiState = Object.freeze({
    status: 'idle',
    inputNames: Object.freeze([]),
    availableInputs: Object.freeze([]),
    selectedInputId: null,
    selectedInputName: null,
    hasReceivedHit: false,
    learningTargetGmKey: null,
    controllerValues: Object.freeze([]),
    lastControllerChange: null,
    lastRawUnmappedNote: null,
    errorMessage: null,
  })

  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  const updateState = (patch: Partial<DrumMidiState>): void => {
    currentState = Object.freeze({
      ...currentState,
      ...patch,
      inputNames:
        patch.inputNames === undefined
          ? currentState.inputNames
          : Object.freeze([...patch.inputNames]),
      availableInputs:
        patch.availableInputs === undefined
          ? currentState.availableInputs
          : Object.freeze(
              patch.availableInputs.map((input) => Object.freeze({ ...input })),
            ),
      controllerValues:
        patch.controllerValues === undefined
          ? currentState.controllerValues
          : Object.freeze([...patch.controllerValues]),
    })
    emit()
  }

  const mappingForInput = (inputId: string): Map<number, number> => {
    const cached = mappingsByInput.get(inputId)
    if (cached !== undefined) return cached
    let loaded = new Map<number, number>()
    try {
      loaded = validMapping(options.mappingStore?.load(inputId) ?? new Map())
    } catch {
      // An unavailable profile must not block a live input.
    }
    mappingsByInput.set(inputId, loaded)
    return loaded
  }

  const persistSelectedMapping = (): void => {
    if (selectedInput === null) return
    try {
      options.mappingStore?.save(
        selectedInput.id,
        new Map(mappingForInput(selectedInput.id)),
      )
    } catch {
      // Persistence is an enhancement; the learned live profile still works.
    }
  }

  const normalizedEventTimestamp = (event: DrumMidiMessageLike): number => {
    const nowMs = environment.nowMs()
    return normalizeDrumInputTimestampMs(
      event.timeStamp,
      nowMs,
      environment.timeOriginMs?.(),
    )
  }

  const handleMessage = (
    input: DrumMidiInputPort,
    event: DrumMidiMessageLike,
  ): void => {
    if (input.id !== selectedInput?.id) return
    const data = event.data
    if (data === null || data.length < 3) return
    const messageType = data[0] & 0xf0
    const midiChannel = data[0] & 0x0f
    const rawMidiKey = data[1]
    const rawVelocity = data[2]
    const timestampMs = normalizedEventTimestamp(event)

    if (messageType === 0xb0) {
      const change = Object.freeze({
        sourceId: input.id,
        midiChannel,
        controller: rawMidiKey,
        value: Math.min(127, Math.max(0, Math.round(rawVelocity))),
        timestampMs,
      })
      controllerValues.set(`${midiChannel}:${rawMidiKey}`, change)
      updateState({
        controllerValues: [...controllerValues.values()],
        lastControllerChange: change,
        errorMessage: null,
      })
      options.onControllerChange?.(change)
      return
    }
    if (messageType !== 0x90 || rawVelocity <= 0) return

    const mapping = mappingForInput(input.id)
    let targetGmKey = mapping.get(rawMidiKey) ?? null
    if (currentState.learningTargetGmKey !== null) {
      targetGmKey = currentState.learningTargetGmKey
      mapping.set(rawMidiKey, targetGmKey)
      persistSelectedMapping()
      updateState({ learningTargetGmKey: null })
    }
    if (targetGmKey === null && isGeneralMidiDrumKey(rawMidiKey)) {
      targetGmKey = rawMidiKey
    }
    if (targetGmKey === null) {
      updateState({
        hasReceivedHit: true,
        lastRawUnmappedNote: Object.freeze({
          sourceId: input.id,
          midiChannel,
          rawMidiKey,
          velocity: clampVelocity(rawVelocity),
          timestampMs,
        }),
        errorMessage: null,
      })
      return
    }

    updateState({ hasReceivedHit: true, errorMessage: null })
    options.onHit({
      gmKey: targetGmKey,
      velocity: clampVelocity(rawVelocity),
      timestampMs,
      source: 'midi',
      sourceId: input.id,
      rawMidiKey,
      midiChannel,
    })
  }

  const bindInput = (input: DrumMidiInputPort): (() => void) => {
    const handler: DrumMidiMessageHandler = (event) =>
      handleMessage(input, event)
    if (
      input.addEventListener !== undefined &&
      input.removeEventListener !== undefined
    ) {
      input.addEventListener('midimessage', handler)
      return () => input.removeEventListener?.('midimessage', handler)
    }

    const previous = input.onmidimessage
    const combined: DrumMidiMessageHandler = (event) => {
      try {
        previous?.call(input, event)
      } finally {
        handler(event)
      }
    }
    input.onmidimessage = combined
    return () => {
      if (input.onmidimessage === combined) input.onmidimessage = previous
    }
  }

  const clearSelectedInput = (): void => {
    unbindSelectedInput?.()
    unbindSelectedInput = null
    selectedInput = null
  }

  const resetSelectedInputEvidence = (): void => {
    controllerValues.clear()
    updateState({
      hasReceivedHit: false,
      learningTargetGmKey: null,
      controllerValues: [],
      lastControllerChange: null,
      lastRawUnmappedNote: null,
    })
  }

  const scanInputs = (): void => {
    if (access === null) return
    const sortedInputs = [...access.inputs.values()]
      .filter((input) => input.state !== 'disconnected')
      .sort(compareInputs)
    allInputs = new Map(sortedInputs.map((input) => [input.id, input]))
    const preferred =
      preferredInputId === null
        ? null
        : (allInputs.get(preferredInputId) ?? null)
    const nextSelected = preferred ?? sortedInputs[0] ?? null
    if (preferredInputId === null && nextSelected !== null) {
      preferredInputId = nextSelected.id
    }
    const selectionChanged =
      nextSelected?.id !== selectedInput?.id || nextSelected !== selectedInput

    if (selectionChanged) {
      clearSelectedInput()
      resetSelectedInputEvidence()
      selectedInput = nextSelected
      if (selectedInput !== null) {
        mappingForInput(selectedInput.id)
        unbindSelectedInput = bindInput(selectedInput)
      }
    }

    if (sortedInputs.length > 0) wasConnected = true
    const availableInputs = sortedInputs.map((input) => ({
      id: input.id,
      name: displayInputName(input),
    }))
    updateState({
      status:
        sortedInputs.length > 0
          ? 'connected'
          : wasConnected
            ? 'disconnected'
            : 'no-inputs',
      inputNames: availableInputs.map((input) => input.name),
      availableInputs,
      selectedInputId: selectedInput?.id ?? null,
      selectedInputName:
        selectedInput === null ? null : displayInputName(selectedInput),
      errorMessage: null,
    })
  }

  const bindAccessState = (grantedAccess: DrumMidiAccessPort): (() => void) => {
    const handler: DrumMidiStateHandler = () => scanInputs()
    if (
      grantedAccess.addEventListener !== undefined &&
      grantedAccess.removeEventListener !== undefined
    ) {
      grantedAccess.addEventListener('statechange', handler)
      return () => grantedAccess.removeEventListener?.('statechange', handler)
    }

    const previous = grantedAccess.onstatechange
    const combined: DrumMidiStateHandler = (event) => {
      try {
        previous?.call(grantedAccess, event)
      } finally {
        handler(event)
      }
    }
    grantedAccess.onstatechange = combined
    return () => {
      if (grantedAccess.onstatechange === combined) {
        grantedAccess.onstatechange = previous
      }
    }
  }

  const runConnect = async (): Promise<boolean> => {
    const requestAccess = environment.requestAccess
    if (requestAccess === undefined) {
      updateState({ status: 'unsupported', errorMessage: null })
      return false
    }
    const attempt = ++generation
    updateState({
      status: 'requesting',
      hasReceivedHit: false,
      errorMessage: null,
    })
    try {
      const grantedAccess = await requestAccess()
      if (disposed || attempt !== generation) return false
      access = grantedAccess
      unbindAccessState = bindAccessState(grantedAccess)
      scanInputs()
      return selectedInput !== null
    } catch (error) {
      if (disposed || attempt !== generation) return false
      updateState({
        status: isPermissionError(error) ? 'denied' : 'error',
        errorMessage: errorMessage(error),
      })
      return false
    }
  }

  const connect = (): Promise<boolean> => {
    if (disposed) return Promise.resolve(false)
    if (access !== null) {
      scanInputs()
      return Promise.resolve(selectedInput !== null)
    }
    if (connecting !== null) return connecting
    const request = runConnect()
    connecting = request
    void request.then(() => {
      if (connecting === request) connecting = null
    })
    return request
  }

  const disconnect = (): void => {
    generation += 1
    connecting = null
    clearSelectedInput()
    unbindAccessState?.()
    unbindAccessState = null
    access = null
    allInputs.clear()
    controllerValues.clear()
    updateState({
      status: 'disconnected',
      inputNames: [],
      availableInputs: [],
      selectedInputId: null,
      selectedInputName: null,
      hasReceivedHit: false,
      learningTargetGmKey: null,
      controllerValues: [],
      lastControllerChange: null,
      lastRawUnmappedNote: null,
    })
  }

  return {
    state: () => currentState,
    mapping: () =>
      selectedInput === null
        ? new Map()
        : new Map(mappingForInput(selectedInput.id)),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    connect,
    disconnect,
    selectInput(inputId) {
      if (!allInputs.has(inputId)) return false
      preferredInputId = inputId
      scanInputs()
      return selectedInput?.id === inputId
    },
    beginLearn(targetGmKey) {
      if (!isGeneralMidiDrumKey(targetGmKey)) return false
      updateState({ learningTargetGmKey: targetGmKey })
      return true
    },
    cancelLearn() {
      updateState({ learningTargetGmKey: null })
    },
    clearMapping(sourceMidiKey) {
      if (selectedInput === null) return
      const mapping = mappingForInput(selectedInput.id)
      if (sourceMidiKey === undefined) mapping.clear()
      else mapping.delete(sourceMidiKey)
      persistSelectedMapping()
      emit()
    },
    dispose() {
      if (disposed) return
      disposed = true
      generation += 1
      connecting = null
      clearSelectedInput()
      unbindAccessState?.()
      unbindAccessState = null
      access = null
      allInputs.clear()
      listeners.clear()
    },
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

export function drumKeyboardHitFromEvent(
  event: Pick<
    KeyboardEvent,
    | 'altKey'
    | 'code'
    | 'ctrlKey'
    | 'defaultPrevented'
    | 'metaKey'
    | 'repeat'
    | 'shiftKey'
    | 'target'
    | 'timeStamp'
  >,
  nowMs: number,
  timeOriginMs?: number,
): DrumLiveHit | null {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    isEditableTarget(event.target)
  ) {
    return null
  }
  const pad = drumPadForKeyboardCode(event.code)
  if (pad === null) return null
  return {
    gmKey: pad.gmKey,
    velocity: 100,
    timestampMs: normalizeDrumInputTimestampMs(
      event.timeStamp,
      nowMs,
      timeOriginMs,
    ),
    source: 'keyboard',
    sourceId: event.code,
  }
}

export function installDrumKeyboardInput(
  onHit: (hit: DrumLiveHit) => void,
  environment: {
    readonly target: Pick<Window, 'addEventListener' | 'removeEventListener'>
    readonly nowMs: () => number
    readonly timeOriginMs?: () => number
  },
): () => void {
  const onKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return
    const hit = drumKeyboardHitFromEvent(
      event,
      environment.nowMs(),
      environment.timeOriginMs?.(),
    )
    if (hit === null) return
    event.preventDefault()
    onHit(hit)
  }
  environment.target.addEventListener('keydown', onKeyDown)
  return () => environment.target.removeEventListener('keydown', onKeyDown)
}
