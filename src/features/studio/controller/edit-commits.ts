// Studio edit commits — an edit kept with its undo step, a render kept without one, and a step back or forward, each staged for saving and shown at once.
import type { Accessor } from 'solid-js'
import { batch, createSignal } from 'solid-js'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioAssetData, StudioProject, } from '@/lib/studio/model/types'
import type { StudioEditHistory } from './edit-history'
import { amendStudioEdit, executeStudioEdit, travelStudioHistory, } from './edit-history'
import type { StudioSaveQueue } from './save-queue'

export interface StudioEditCommitOptions {
  history: Accessor<StudioEditHistory | null>
  setHistory(next: StudioEditHistory): void
  queue(): StudioSaveQueue | null
  canEdit(): boolean
  assets: Accessor<readonly StudioAsset[]>
  setAssets(assets: readonly StudioAsset[]): void
  setProject(project: StudioProject): void
  now(): Date
  report(error: unknown): void
}

/** Whether two asset lists hold the same records, in the same order. */
function sameAssets(
  a: readonly StudioAsset[],
  b: readonly StudioAsset[],
): boolean {
  return a.length === b.length && a.every((asset, index) => asset === b[index])
}

export function createStudioEditCommits(options: StudioEditCommitOptions) {
  // Undo and redo, counted: a MIDI render service keeps a render a step
  // lands on (src/features/studio/midi).
  const [travels, setTravels] = createSignal(0)

  /** The history and the queue, while this tab may edit the song. */
  function open(): {
    history: StudioEditHistory
    queue: StudioSaveQueue
  } | null {
    const history = options.history()
    const queue = options.queue()
    return options.canEdit() && queue !== null && history !== null
      ? { history, queue }
      : null
  }

  /**
   * Stage the new present with the audio it brought, show it, and save it.
   * The song and its audio change in one batch: written apart, every effect
   * ran between them with the new song and the old audio, and the transport,
   * playing, stopped on a clip whose audio was not there yet ("Owned source
   * is missing").
   */
  function land(
    queue: StudioSaveQueue,
    next: StudioEditHistory,
    prepared: readonly StudioAssetData[],
    assets: readonly StudioAsset[],
  ): void {
    queue.stage(next.state.present, prepared)
    // An edit that brings no audio leaves the list as it was. A fresh copy
    // would make everything read from the list recompute inside the batch,
    // before the transport follows the edit, so a playing song heard a gain
    // change an audio block later.
    const unchanged = sameAssets(options.assets(), assets)
    batch(() => {
      options.setHistory(next)
      options.setProject(next.state.present)
      if (!unchanged) options.setAssets(assets)
    })
    void queue.flush()
  }

  /**
   * Make `command` an edit, kept and saved. A refusal goes to `refused`: the
   * page's banner by default, an import's own notice for an import's
   * commands, so a song with no room for a file says so where every other
   * refusal of that file is said.
   */
  function commit(
    command: StudioCommand,
    prepared: readonly StudioAssetData[] = [],
    refused: (error: unknown) => void = options.report,
  ): boolean {
    const editing = open()
    if (editing === null) return false
    try {
      const assets = [
        ...options.assets(),
        ...prepared.map((data) => data.asset),
      ]
      const next = executeStudioEdit(editing.history, command, {
        assets,
        now: options.now(),
      })
      if (next !== editing.history) land(editing.queue, next, prepared, assets)
      return true
    } catch (error) {
      refused(error)
      return false
    }
  }

  /**
   * Change the present without an undo step: a MIDI render kept as its
   * clips' audio. False when nothing changed, as when the notes it was
   * rendered from are gone; its audio is then not kept. A refusal throws.
   */
  function amend(
    command: StudioCommand,
    prepared: readonly StudioAssetData[] = [],
  ): boolean {
    const editing = open()
    if (editing === null) return false
    const assets = [...options.assets(), ...prepared.map((data) => data.asset)]
    const next = amendStudioEdit(editing.history, command, {
      assets,
      now: options.now(),
    })
    if (next === editing.history) return false
    land(editing.queue, next, prepared, assets)
    return true
  }

  function travel(direction: 'undo' | 'redo'): boolean {
    const editing = open()
    if (editing === null) return false
    try {
      const next = travelStudioHistory(editing.history, direction, {
        assets: options.assets(),
        now: options.now(),
      })
      if (next === editing.history) return true
      land(editing.queue, next, [], options.assets())
      setTravels((count) => count + 1)
      return true
    } catch (error) {
      options.report(error)
      return false
    }
  }

  return {
    commit,
    amend,
    travel,
    /** How many times undo or redo moved the song. */
    travels,
  }
}
