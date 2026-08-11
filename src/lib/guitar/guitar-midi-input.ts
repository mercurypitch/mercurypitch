// Host-neutral Web MIDI input for Guitar Night capture and device selection.
// ============================================================

export interface GuitarMidiMessageLike {
  data: ArrayLike<number> | null
  timeStamp: number
}

export interface GuitarMidiInputPortLike {
  id: string
  name?: string | null
  manufacturer?: string | null
  state?: string
  onmidimessage: ((message: GuitarMidiMessageLike) => void) | null
}

export interface GuitarMidiAccessLike {
  inputs: { values(): IterableIterator<GuitarMidiInputPortLike> }
  onstatechange: ((event?: unknown) => void) | null
}

export interface GuitarMidiHost {
  requestAccess(): Promise<GuitarMidiAccessLike>
  performanceNow(): number
}

export interface GuitarMidiPort {
  id: string
  label: string
}

export type GuitarMidiNoteKind = 'attack' | 'release'

export interface GuitarMidiNoteMessage {
  kind: GuitarMidiNoteKind
  midi: number
  velocity: number
  channel: number
  inputId: string
  inputLabel: string
  eventTimestampMs: number
  observedPerformanceMs: number
  voiceId: string
}

export interface GuitarMidiAdapterOptions {
  host?: GuitarMidiHost
  onNote(message: GuitarMidiNoteMessage): void
  onPortsChanged?(
    ports: readonly GuitarMidiPort[],
    activePortId: string | null,
  ): void
}

export interface GuitarMidiClockMapping {
  capturedAtSeconds: number
  eventTimestampMs: number
  observedPerformanceMs: number
}

function defaultMidiHost(): GuitarMidiHost {
  return {
    async requestAccess() {
      if (
        typeof navigator === 'undefined' ||
        typeof navigator.requestMIDIAccess !== 'function'
      ) {
        throw new Error('Web MIDI is not available in this browser.')
      }
      return (await navigator.requestMIDIAccess()) as unknown as GuitarMidiAccessLike
    },
    performanceNow: () =>
      typeof performance === 'undefined' ? Date.now() : performance.now(),
  }
}

/**
 * Bridge a DOMHighResTimeStamp onto the room AudioContext clock at receipt.
 * The mapping stays explicit in event provenance; it is high-resolution MIDI
 * evidence, not an audio sample frame.
 */
export function mapMidiTimestampToAudioClock(
  eventTimestampMs: number,
  observedPerformanceMs: number,
  observedAudioSeconds: number,
): GuitarMidiClockMapping {
  const safeObservedPerformance = Number.isFinite(observedPerformanceMs)
    ? observedPerformanceMs
    : 0
  const safeEventTimestamp = Number.isFinite(eventTimestampMs)
    ? eventTimestampMs
    : safeObservedPerformance
  const safeAudioSeconds = Number.isFinite(observedAudioSeconds)
    ? Math.max(0, observedAudioSeconds)
    : 0
  return {
    capturedAtSeconds: Math.max(
      0,
      safeAudioSeconds + (safeEventTimestamp - safeObservedPerformance) / 1000,
    ),
    eventTimestampMs: safeEventTimestamp,
    observedPerformanceMs: safeObservedPerformance,
  }
}

export function parseGuitarMidiNote(
  message: GuitarMidiMessageLike,
  input: GuitarMidiPort,
  observedPerformanceMs: number,
): GuitarMidiNoteMessage | null {
  const data = message.data
  if (data === null || data.length < 3) return null
  const statusByte = Number(data[0] ?? 0)
  const status = statusByte & 0xf0
  const channel = statusByte & 0x0f
  const midi = Number(data[1] ?? -1)
  const velocity = Number(data[2] ?? 0)
  if (
    !Number.isInteger(midi) ||
    midi < 0 ||
    midi > 127 ||
    !Number.isInteger(velocity) ||
    velocity < 0 ||
    velocity > 127
  ) {
    return null
  }
  const kind: GuitarMidiNoteKind | null =
    status === 0x90 && velocity > 0
      ? 'attack'
      : status === 0x80 || (status === 0x90 && velocity === 0)
        ? 'release'
        : null
  if (kind === null) return null
  return {
    kind,
    midi,
    velocity,
    channel,
    inputId: input.id,
    inputLabel: input.label,
    eventTimestampMs: Number.isFinite(message.timeStamp)
      ? message.timeStamp
      : observedPerformanceMs,
    observedPerformanceMs,
    voiceId: `${input.id}:${channel}:${midi}`,
  }
}

export class GuitarMidiInputAdapter {
  private readonly host: GuitarMidiHost
  private readonly onNote: (message: GuitarMidiNoteMessage) => void
  private readonly onPortsChanged:
    | ((ports: readonly GuitarMidiPort[], activePortId: string | null) => void)
    | undefined
  private access: GuitarMidiAccessLike | null = null
  private inputs = new Map<string, GuitarMidiInputPortLike>()
  private requestedPortId: string | null = null
  private activePortId: string | null = null

  constructor(options: GuitarMidiAdapterOptions) {
    this.host = options.host ?? defaultMidiHost()
    this.onNote = options.onNote
    this.onPortsChanged = options.onPortsChanged
  }

  async connect(): Promise<readonly GuitarMidiPort[]> {
    if (this.access === null) {
      this.access = await this.host.requestAccess()
      this.access.onstatechange = () => this.scanInputs()
    }
    this.scanInputs()
    return this.ports()
  }

  selectPort(portId: string | null): boolean {
    this.requestedPortId = portId !== null && portId.length > 0 ? portId : null
    this.scanInputs()
    return this.activePortId !== null
  }

  selectedPortId(): string | null {
    return this.activePortId
  }

  ports(): readonly GuitarMidiPort[] {
    return [...this.inputs.values()].map((input) => {
      const name = input.name?.trim()
      return {
        id: input.id,
        label: name !== undefined && name.length > 0 ? name : 'MIDI input',
      }
    })
  }

  disconnect(): void {
    for (const input of this.inputs.values()) input.onmidimessage = null
    this.inputs.clear()
    if (this.access !== null) this.access.onstatechange = null
    this.access = null
    this.activePortId = null
    this.onPortsChanged?.([], null)
  }

  private scanInputs(): void {
    for (const input of this.inputs.values()) input.onmidimessage = null
    this.inputs.clear()
    if (this.access === null) return

    for (const input of this.access.inputs.values()) {
      if (input.state === 'disconnected') continue
      this.inputs.set(input.id, input)
    }
    const fallbackId = this.inputs.keys().next().value as string | undefined
    const nextActive =
      this.requestedPortId === null
        ? (fallbackId ?? null)
        : this.inputs.has(this.requestedPortId)
          ? this.requestedPortId
          : null
    this.activePortId = nextActive

    if (nextActive !== null) {
      const input = this.inputs.get(nextActive)
      if (input !== undefined) {
        const name = input.name?.trim()
        const port: GuitarMidiPort = {
          id: input.id,
          label: name !== undefined && name.length > 0 ? name : 'MIDI input',
        }
        input.onmidimessage = (message) => {
          const parsed = parseGuitarMidiNote(
            message,
            port,
            this.host.performanceNow(),
          )
          if (parsed !== null) this.onNote(parsed)
        }
      }
    }
    this.onPortsChanged?.(this.ports(), this.activePortId)
  }
}
