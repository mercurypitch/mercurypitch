// Fake Web MIDI for tests — ports that send messages, and an access that lists them and says when one is plugged or unplugged, as the browser's do.

type Listener = (event: { data: Uint8Array; timeStamp: number }) => void

export interface FakeMidiInput {
  readonly id: string
  readonly name: string
  readonly manufacturer: string | null
  state: MIDIPortDeviceState
  connection: MIDIPortConnectionState
  onmidimessage: Listener | null
  addEventListener(type: string, listener: Listener): void
  removeEventListener(type: string, listener: Listener): void
  /** Send `bytes` as if played, at `timeStamp` on the performance clock. */
  send(bytes: readonly number[], timeStamp: number): void
}

export function fakeMidiInput(id: string, name: string): FakeMidiInput {
  const listeners = new Set<Listener>()
  return {
    id,
    name,
    manufacturer: null,
    state: 'connected',
    connection: 'closed',
    onmidimessage: null,
    addEventListener: (type, listener) => {
      if (type === 'midimessage') listeners.add(listener)
    },
    removeEventListener: (type, listener) => {
      if (type === 'midimessage') listeners.delete(listener)
    },
    send(bytes, timeStamp) {
      for (const listener of listeners)
        listener({ data: new Uint8Array(bytes), timeStamp })
    },
  }
}

export interface FakeMidiAccess {
  readonly access: MIDIAccess
  plug(input: FakeMidiInput): void
  unplug(id: string): void
}

export function fakeMidiAccess(inputs: FakeMidiInput[]): FakeMidiAccess {
  const ports = new Map(inputs.map((input) => [input.id, input]))
  const listeners = new Set<() => void>()
  const changed = () => {
    for (const listener of listeners) listener()
  }
  const access = {
    inputs: ports,
    outputs: new Map(),
    sysexEnabled: false,
    onstatechange: null,
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'statechange') listeners.add(listener)
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (type === 'statechange') listeners.delete(listener)
    },
  } as unknown as MIDIAccess
  return {
    access,
    plug(input) {
      ports.set(input.id, input)
      changed()
    },
    unplug(id) {
      const input = ports.get(id)
      if (input === undefined) return
      input.state = 'disconnected'
      changed()
    },
  }
}
