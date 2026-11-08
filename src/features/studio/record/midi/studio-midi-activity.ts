// ============================================================
// Studio MIDI activity — which ports are sending now, for the Inputs view's lights
// ============================================================
//
// While the Inputs view is open and MIDI is allowed, every port the browser
// lists is listened to, and a message it sends lights it for a moment. The
// message is read with the Piano room's parser (parseWebMidiMessage), so a
// note, a pedal or a reset lights a port and anything else does not. The
// parser loads with import() once MIDI is allowed, never with the page.
// Listening stops when the view closes; an armed lane's own port listens on
// through its own listener all the while.
import { createEffect, createSignal, onCleanup } from 'solid-js'
import type { StudioMidiAccess } from './studio-midi-access'

/** How long a message lights its port, in ms. */
export const STUDIO_MIDI_LIGHT_MS = 250

/** Whether a message's bytes are a note, a pedal or a reset. */
export type StudioMidiReader = (data: Uint8Array | null) => boolean

function loadReader(): Promise<StudioMidiReader> {
  return import('@/features/piano/input/web-midi-input-port').then(
    (module) => (data) => module.parseWebMidiMessage(data) !== null,
  )
}

/** The ports lit now; listens while its owner lives. */
export function createStudioMidiActivity(
  access: StudioMidiAccess,
  load: () => Promise<StudioMidiReader> = loadReader,
) {
  const [lit, setLit] = createSignal<ReadonlySet<string>>(new Set())
  const [reader, setReader] = createSignal<StudioMidiReader | null>(null)
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  let loading = false

  function light(id: string): void {
    clearTimeout(timers.get(id))
    setLit((now) => new Set(now).add(id))
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id)
        setLit((now) => {
          const next = new Set(now)
          next.delete(id)
          return next
        })
      }, STUDIO_MIDI_LIGHT_MS),
    )
  }

  // Once MIDI is allowed: the reader loads, then every port listed listens.
  createEffect(() => {
    if (access.state() !== 'granted') return
    const read = reader()
    if (read === null) {
      if (!loading) {
        loading = true
        void load()
          .then((loaded) => setReader(() => loaded))
          .catch(() => undefined)
      }
      return
    }
    const listed = new Set(access.ports().map((port) => port.id))
    const inputs = [...(access.access()?.inputs.values() ?? [])].filter(
      (input) => listed.has(input.id),
    )
    const heard = inputs.map((input) => {
      const listener = (event: MIDIMessageEvent) => {
        if (read(event.data)) light(input.id)
      }
      input.addEventListener('midimessage', listener)
      return () => input.removeEventListener('midimessage', listener)
    })
    onCleanup(() => {
      for (const stop of heard) stop()
    })
  })
  onCleanup(() => {
    for (const timer of timers.values()) clearTimeout(timer)
  })

  return {
    /** Whether port `id` sent a message a moment ago. */
    lit: (id: string) => lit().has(id),
  }
}
