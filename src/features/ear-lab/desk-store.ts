// ============================================================
// desk-store — the mixing desk's source, rendered once.
//
// The desk plays the user's own song when the karaoke library has a
// finished separation (vocal and instrumental summed over an
// excerpt) and the house loop otherwise. Either is rendered once per
// app lifetime and held here; every drill slices it. Nothing here
// touches the Column.
// ============================================================

import { createSignal } from 'solid-js'

export interface DeskSource {
  buffer: AudioBuffer
  /** "the house loop" or the song's name — the stage's progress word. */
  label: string
}

export type DeskSourceStatus = 'idle' | 'rendering' | 'ready' | 'error'

export interface DeskSourceState {
  status: DeskSourceStatus
  source: DeskSource | null
  error: string
}

const IDLE: DeskSourceState = { status: 'idle', source: null, error: '' }
const [state, setState] = createSignal<DeskSourceState>(IDLE)
let inFlight: Promise<DeskSource> | null = null

export function deskSourceState(): DeskSourceState {
  return state()
}

export interface DeskLoaders {
  /** The user's song, or null when the library has none. */
  song: () => Promise<DeskSource | null>
  house: () => Promise<DeskSource>
}

/** The source, rendered on first call; shared by the desk's page and
 *  its drills. A failed song falls back to the house loop. */
export function ensureDeskSource(loaders: DeskLoaders): Promise<DeskSource> {
  if (inFlight) return inFlight
  setState({ status: 'rendering', source: null, error: '' })
  inFlight = (async () => {
    let source: DeskSource | null = null
    try {
      source = await loaders.song()
    } catch {
      source = null
    }
    return source ?? (await loaders.house())
  })()
    .then((source) => {
      setState({ status: 'ready', source, error: '' })
      return source
    })
    .catch((error: unknown) => {
      inFlight = null
      setState({
        status: 'error',
        source: null,
        error:
          error instanceof Error
            ? error.message
            : 'The desk could not render its source.',
      })
      throw error
    })
  return inFlight
}

export function primeDeskSource(source: DeskSource): void {
  inFlight = Promise.resolve(source)
  setState({ status: 'ready', source, error: '' })
}

export function resetDeskStore(): void {
  inFlight = null
  setState(IDLE)
}
