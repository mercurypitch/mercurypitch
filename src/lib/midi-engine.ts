// ============================================================
// MidiEngine — Web MIDI API wrapper for piano practice
// ============================================================

export interface MidiNoteEvent {
  midi: number
  velocity: number
  timestamp: number
}

export class MidiEngine {
  private access: MIDIAccess | null = null
  private inputs: Map<string, MIDIInput> = new Map()
  private heldNotes: Map<number, MidiNoteEvent> = new Map()

  callbacks = {
    onNoteOn: null as ((e: MidiNoteEvent) => void) | null,
    onNoteOff: null as ((e: MidiNoteEvent) => void) | null,
    onStateChange: null as ((connected: boolean) => void) | null,
  }

  async connect(): Promise<boolean> {
    try {
      this.access = await navigator.requestMIDIAccess()
    } catch {
      return false
    }

    this.scanInputs()
    this.access.onstatechange = () => {
      this.scanInputs()
      this.callbacks.onStateChange?.(this.isConnected())
    }

    return this.isConnected()
  }

  disconnect(): void {
    for (const input of this.inputs.values()) {
      input.onmidimessage = null
    }
    this.inputs.clear()
    this.heldNotes.clear()
    this.access = null
  }

  isConnected(): boolean {
    return this.inputs.size > 0
  }

  getInputNames(): string[] {
    return Array.from(this.inputs.values()).map((i) => i.name ?? 'Unknown')
  }

  getHeldNotes(): ReadonlyMap<number, MidiNoteEvent> {
    return this.heldNotes
  }

  private scanInputs(): void {
    if (!this.access) return

    // Detach old listeners
    for (const input of this.inputs.values()) {
      input.onmidimessage = null
    }
    this.inputs.clear()

    // Attach listeners to all inputs
    for (const entry of this.access.inputs.values()) {
      if (!entry) continue
      entry.onmidimessage = (msg: MIDIMessageEvent) => this.handleMessage(msg)
      this.inputs.set(entry.id, entry)
    }
  }

  private handleMessage(msg: MIDIMessageEvent): void {
    const data = msg.data
    if (!data || data.length < 3) return

    const status = data[0] & 0xf0
    const note = data[1]
    const velocity = data[2]

    const event: MidiNoteEvent = {
      midi: note,
      velocity,
      timestamp: msg.timeStamp,
    }

    if (status === 0x90 && velocity > 0) {
      // Note on
      this.heldNotes.set(note, event)
      this.callbacks.onNoteOn?.(event)
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      // Note off
      this.heldNotes.delete(note)
      this.callbacks.onNoteOff?.(event)
    }
  }
}
