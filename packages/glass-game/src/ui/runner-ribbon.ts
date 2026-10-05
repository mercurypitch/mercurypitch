// Runner ribbon model — one window of judged notes, with an explicit complete phrase for accessibility.
import type { RunnerNotationNote } from '../runner/notation'
import { clampRunnerNotationFill, runnerMidiName } from '../runner/notation'

export interface RunnerRibbonNote {
  readonly index: number
  readonly pitch: string
  readonly duration: string | null
  readonly fill: number
  readonly state: RunnerNotationNote['state']
  readonly active: boolean
}

export function runnerRibbon(
  notes: readonly RunnerNotationNote[],
  activeIndex: number | null,
  durations: readonly string[] = [],
) {
  const active = Math.max(
    0,
    Math.min(
      notes.length - 1,
      Number.isFinite(activeIndex) ? Math.floor(activeIndex!) : 0,
    ),
  )
  const all: readonly RunnerRibbonNote[] = notes.map((note, position) => {
    const start = runnerMidiName(note.startMidi).text
    const end = runnerMidiName(note.endMidi).text
    return {
      index: note.index,
      pitch: start === end ? start : `${start} → ${end}`,
      duration: durations[position] ?? null,
      fill: clampRunnerNotationFill(note.fillProgress),
      state: note.state,
      active: position === active,
    }
  })
  const visible = all.slice(active, active + 3)
  return {
    all,
    visible,
    activeProgress: all[active]?.fill ?? 0,
    remaining: Math.max(0, all.length - active - visible.length),
    position: `${all.length ? active + 1 : 0}/${all.length}`,
  }
}
