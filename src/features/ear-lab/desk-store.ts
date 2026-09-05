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
  /**
   * 0..100 through the render, and what it is doing. Null and empty when
   * there is nothing to report — the house loop renders in one step. The
   * song path opens three stems first, which is seconds of silence on a
   * phone unless it says so.
   */
  pct: number | null
  note: string
}

const IDLE: DeskSourceState = {
  status: 'idle',
  source: null,
  error: '',
  pct: null,
  note: '',
}
const [state, setState] = createSignal<DeskSourceState>(IDLE)
let inFlight: Promise<DeskSource> | null = null
/** Bumped by every reset, so a render in flight at the reset cannot
 *  land afterwards. */
let epoch = 0

export function deskSourceState(): DeskSourceState {
  return state()
}

export interface DeskLoaders {
  /** The user's song, or null when the library has none. */
  song: () => Promise<DeskSource | null>
  house: () => Promise<DeskSource>
}

/** What the render is doing, for the loader to call as it goes. Ignored
 *  unless a render is running, so a late report cannot overwrite the
 *  finished state. */
export function reportDeskProgress(pct: number | null, note: string): void {
  setState((current) =>
    current.status === 'rendering' ? { ...current, pct, note } : current,
  )
}

/** The source, rendered on first call; shared by the desk's page and
 *  its drills. A failed song falls back to the house loop. */
export function ensureDeskSource(loaders: DeskLoaders): Promise<DeskSource> {
  if (inFlight) return inFlight
  const renderEpoch = epoch
  setState({
    status: 'rendering',
    source: null,
    error: '',
    pct: null,
    note: '',
  })
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
      // A reset while this rendered (the lab was left) must win: the
      // render's result would otherwise repopulate the store after it.
      if (renderEpoch !== epoch) return source
      setState({ status: 'ready', source, error: '', pct: null, note: '' })
      return source
    })
    .catch((error: unknown) => {
      if (renderEpoch !== epoch) throw error
      inFlight = null
      setState({
        status: 'error',
        source: null,
        pct: null,
        note: '',
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
  setState({ status: 'ready', source, error: '', pct: null, note: '' })
}

export function resetDeskStore(): void {
  epoch += 1
  inFlight = null
  setState(IDLE)
}
