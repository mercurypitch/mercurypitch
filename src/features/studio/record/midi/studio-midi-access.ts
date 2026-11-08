// ============================================================
// Studio MIDI access — whether the page may use MIDI and the ports the browser lists, asked for only from a press
// ============================================================
//
// Web MIDI is asked for from a press only: Allow in the Inputs view, the
// lane picker's button, or the arm of a MIDI lane. The answer reads one of
// these ways: not asked yet; asking; allowed, with the ports, kept up to
// date as keyboards come and go; denied, by the person or the site's
// settings; failed for another reason; or not there to ask, in a browser
// without Web MIDI (Safari, and every browser on iOS). A denial reads apart
// from any other failure, as Drum Night tells them apart, since only a
// denial is put right in the site's settings.
import { createSignal } from 'solid-js'

export type StudioMidiState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'failed'
  | 'unsupported'

export interface StudioMidiPort {
  readonly id: string
  readonly name: string
  readonly manufacturer: string | null
}

export interface StudioMidiAccessOptions {
  /** Ask the browser for MIDI; null where it has no Web MIDI. Defaults to navigator.requestMIDIAccess. */
  request?(): Promise<MIDIAccess> | null
}

function browserRequest(): Promise<MIDIAccess> | null {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.requestMIDIAccess !== 'function'
  )
    return null
  return navigator.requestMIDIAccess()
}

/** The browser or the person said no, as a denial: not a failure of any other kind. */
function isDenial(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name
  return name === 'NotAllowedError' || name === 'SecurityError'
}

/** The ports a MIDI access lists now, connected ones only, by name. */
export function studioMidiPorts(access: MIDIAccess): StudioMidiPort[] {
  return [...access.inputs.values()]
    .filter((input) => input.state !== 'disconnected')
    .map((input) => ({
      id: input.id,
      name: input.name ?? 'MIDI input',
      manufacturer: input.manufacturer ?? null,
    }))
}

export function createStudioMidiAccess(options: StudioMidiAccessOptions = {}) {
  const ask = options.request ?? browserRequest
  const supported =
    options.request !== undefined ||
    (typeof navigator !== 'undefined' &&
      typeof navigator.requestMIDIAccess === 'function')
  const [state, setState] = createSignal<StudioMidiState>(
    supported ? 'idle' : 'unsupported',
  )
  const [ports, setPorts] = createSignal<readonly StudioMidiPort[]>([])
  let access: MIDIAccess | null = null
  let pending: Promise<MIDIAccess | null> | null = null
  const list = () => {
    if (access !== null) setPorts(studioMidiPorts(access))
  }

  /**
   * Ask for MIDI, from a press: the browser's answer is asked for before
   * anything is awaited. Gives the access once allowed, null while it is not.
   */
  function request(): Promise<MIDIAccess | null> {
    if (access !== null) return Promise.resolve(access)
    if (pending !== null) return pending
    const asked = ask()
    if (asked === null) {
      setState('unsupported')
      return Promise.resolve(null)
    }
    setState('requesting')
    pending = asked
      .then(
        (granted) => {
          access = granted
          granted.addEventListener('statechange', list)
          list()
          setState('granted')
          return granted
        },
        (error: unknown) => {
          setState(isDenial(error) ? 'denied' : 'failed')
          return null
        },
      )
      .finally(() => {
        pending = null
      })
    return pending
  }

  return {
    state,
    /** The ports the browser lists now; none until MIDI is allowed. */
    ports,
    request,
    /** The access once allowed; null until then. */
    access: () => access,
    dispose(): void {
      access?.removeEventListener('statechange', list)
    },
  }
}

export type StudioMidiAccess = ReturnType<typeof createStudioMidiAccess>
