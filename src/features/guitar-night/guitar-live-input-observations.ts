// Live input observations expose existing raw-clock evidence without owning capture or assessment.
import { createSignal } from 'solid-js'
import type { GuitarInputCapture, GuitarInputPitch, GuitarInputSource, } from '@/lib/guitar/input-events'

export interface GuitarLiveInputRoute {
  generation: number
  source: GuitarInputSource
  sampleRate: number
  startedAtSeconds: number
  currentTimeSeconds(): number
}

export type GuitarLiveInputObservation =
  | { type: 'route-start'; route: GuitarLiveInputRoute }
  | { type: 'route-end' | 'reset'; generation: number; atSeconds: number }
  | {
      type: 'capture'
      generation: number
      id: string
      capture: GuitarInputCapture
    }
  | {
      type: 'pitch'
      generation: number
      sampleRate: number
      observedAtSeconds: number
      windowStartAtSeconds: number
      pitch: GuitarInputPitch | null
    }

export type GuitarLiveInputObserver = (
  observation: GuitarLiveInputObservation,
) => void

/** Subscribers are display-only: neither a failure nor a mutation can corrupt the audio owner. */
export function createGuitarLiveInputObservations() {
  const [route, setRoute] = createSignal<GuitarLiveInputRoute | null>(null)
  const observers = new Set<GuitarLiveInputObserver>()
  let generation = 0
  let sequence = 0
  const deliver = (
    observer: GuitarLiveInputObserver,
    observation: GuitarLiveInputObservation,
  ) => {
    try {
      observer(Object.freeze(observation))
    } catch {
      // A failed visual consumer must never interrupt analysis or monitoring.
    }
  }
  const publish = (observation: GuitarLiveInputObservation) => {
    for (const observer of [...observers]) deliver(observer, observation)
  }
  const end = () => {
    const current = route()
    if (current === null) return
    setRoute(null)
    publish({
      type: 'route-end',
      generation: current.generation,
      atSeconds: current.currentTimeSeconds(),
    })
  }
  return {
    route,
    subscribe(observer: GuitarLiveInputObserver) {
      observers.add(observer)
      const current = route()
      if (current !== null)
        deliver(observer, { type: 'route-start', route: current })
      return () => {
        observers.delete(observer)
      }
    },
    start(context: AudioContext, source: GuitarInputSource) {
      end()
      sequence = 0
      const current = Object.freeze({
        generation: ++generation,
        source,
        sampleRate: context.sampleRate,
        startedAtSeconds: context.currentTime,
        currentTimeSeconds: () => context.currentTime,
      })
      setRoute(current)
      publish({ type: 'route-start', route: current })
    },
    end,
    reset() {
      const current = route()
      if (current !== null)
        publish({
          type: 'reset',
          generation: current.generation,
          atSeconds: current.currentTimeSeconds(),
        })
    },
    capture(capture: GuitarInputCapture) {
      const current = route()
      if (current === null || observers.size === 0) return
      publish({
        type: 'capture',
        generation: current.generation,
        id: `live-${current.generation}-${++sequence}`,
        capture: Object.freeze({
          ...capture,
          clock: Object.freeze({ ...capture.clock }),
          pitch:
            capture.pitch === null ? null : Object.freeze({ ...capture.pitch }),
        }),
      })
    },
    pitch(
      observedAtSeconds: number,
      windowStartAtSeconds: number,
      pitch: GuitarInputPitch | null,
    ) {
      const current = route()
      if (current === null || observers.size === 0) return
      publish({
        type: 'pitch',
        generation: current.generation,
        sampleRate: current.sampleRate,
        observedAtSeconds,
        windowStartAtSeconds,
        pitch: pitch === null ? null : Object.freeze({ ...pitch }),
      })
    },
    dispose() {
      end()
      observers.clear()
    },
  }
}
