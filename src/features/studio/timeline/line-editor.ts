// Studio line editor — which lane's line is open, the point in hand, and the line a moving hand draws before it saves.
//
// One lane's line is open at a time, over that lane's clips
// (StudioLaneLine.tsx), with its commands in a bar at the arrangement's
// foot (StudioLineBar.tsx). A point that moves, by pointer or by keys, is
// a draft until the gesture ends and saves as one undoable edit.
import { createSignal } from 'solid-js'
import type { StudioAutomationParam } from '@/lib/studio/model/automation'
import { hasStudioAutomation, studioAutomationLine, } from '@/lib/studio/model/automation'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAutomationPoint, StudioTrack, } from '@/lib/studio/model/types'
import { addStudioLinePoint, removeStudioLinePoint } from './lane-line'

/** The open line: its lane and the control it draws. */
export interface StudioLineView {
  readonly trackId: string
  readonly param: StudioAutomationParam
}

export interface StudioLineEditor {
  view(): StudioLineView | null
  /** The chosen point's place on the line shown. */
  selected(): number | null
  /** The line while a hand moves a point, before it saves. */
  draft(): readonly StudioAutomationPoint[] | null
  /** Open a lane's lines, on its pan line when that is the only one it has. */
  open(track: StudioTrack): void
  close(): void
  show(param: StudioAutomationParam): void
  select(index: number | null): void
  setDraft(points: readonly StudioAutomationPoint[] | null): void
}

export function createStudioLineEditor(): StudioLineEditor {
  const [view, setView] = createSignal<StudioLineView | null>(null)
  const [selected, setSelected] = createSignal<number | null>(null)
  const [draft, setDraft] = createSignal<
    readonly StudioAutomationPoint[] | null
  >(null)
  const reset = () => {
    setSelected(null)
    setDraft(null)
  }
  return {
    view,
    selected,
    draft,
    open(track) {
      const panOnly =
        hasStudioAutomation(track, 'pan') &&
        !hasStudioAutomation(track, 'volume')
      setView({ trackId: track.id, param: panOnly ? 'pan' : 'volume' })
      reset()
    },
    close() {
      setView(null)
      reset()
    },
    show(param) {
      const open = view()
      if (!open || open.param === param) return
      setView({ trackId: open.trackId, param })
      reset()
    },
    select: setSelected,
    setDraft,
  }
}

/** Focus point `index` of the open line on lane `trackId`, once it is drawn. */
export function focusStudioLinePoint(trackId: string, index: number): void {
  queueMicrotask(() => {
    const lane = [
      ...document.querySelectorAll<HTMLElement>('[data-studio-track]'),
    ].find((element) => element.dataset.studioTrack === trackId)
    lane
      ?.querySelector<HTMLElement>(`[data-studio-line-point="${index}"]`)
      ?.focus({ preventScroll: true })
  })
}

/** The open line's edits: each saves as one undoable command, then chooses and focuses a point. */
export interface StudioLineActions {
  /** The line as the song has it. */
  saved(): readonly StudioAutomationPoint[]
  commit(points: readonly StudioAutomationPoint[]): boolean
  /** Add a point, or choose the one already on its frame: false when the line is full. */
  add(point: StudioAutomationPoint): boolean
  /** Remove point `index` and choose its neighbour. */
  remove(index: number): void
  clear(): void
}

export function createStudioLineActions(options: {
  track(): StudioTrack
  param(): StudioAutomationParam
  editor(): StudioLineEditor
  onCommand(command: StudioCommand): boolean
}): StudioLineActions {
  const saved = () => studioAutomationLine(options.track(), options.param())
  const commit = (points: readonly StudioAutomationPoint[]) =>
    options.onCommand({
      type: 'set-lane-automation',
      trackId: options.track().id,
      param: options.param(),
      points,
    })
  const choose = (index: number | null) => {
    options.editor().select(index)
    if (index !== null) focusStudioLinePoint(options.track().id, index)
  }
  return {
    saved,
    commit,
    add(point) {
      const line = saved()
      const added = addStudioLinePoint(line, point)
      if (!added) return false
      if (added.points === line || commit(added.points)) choose(added.index)
      return true
    },
    remove(index) {
      const line = saved()
      if (index >= line.length) return
      const next = removeStudioLinePoint(line, index)
      if (commit(next))
        choose(next.length > 0 ? Math.min(index, next.length - 1) : null)
    },
    clear() {
      if (saved().length > 0 && commit([])) choose(null)
    },
  }
}
