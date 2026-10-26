// Studio history — one undo entry per committed command and fresh revisions for undo and redo.
import type { StudioCommand, StudioCommandOptions } from './commands'
import { applyStudioCommand, reviseStudioProject } from './commands'
import type { StudioProject } from './types'
import { validateStudioProject } from './validation'
import { frameValue } from './validation-values'

export interface StudioHistory {
  readonly past: readonly StudioProject[]
  readonly present: StudioProject
  readonly future: readonly StudioProject[]
  readonly limit: number
}

export function createStudioHistory(
  project: StudioProject,
  limit = 100,
): StudioHistory {
  frameValue(limit, 'history.limit', 1)
  return {
    past: [],
    present: validateStudioProject(project),
    future: [],
    limit,
  }
}

export function executeStudioCommand(
  history: StudioHistory,
  command: StudioCommand,
  options: StudioCommandOptions,
): StudioHistory {
  const next = applyStudioCommand(history.present, command, options)
  if (next === history.present) return history
  return {
    ...history,
    past: [...history.past, history.present].slice(-history.limit),
    present: next,
    future: [],
  }
}

export function undoStudioCommand(
  history: StudioHistory,
  options: StudioCommandOptions,
): StudioHistory {
  const previous = history.past.at(-1)
  if (!previous) return history
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: reviseStudioProject(history.present, previous, options),
    future: [history.present, ...history.future],
  }
}

export function redoStudioCommand(
  history: StudioHistory,
  options: StudioCommandOptions,
): StudioHistory {
  if (history.future.length === 0) return history
  const next = history.future[0]
  return {
    ...history,
    past: [...history.past, history.present].slice(-history.limit),
    present: reviseStudioProject(history.present, next, options),
    future: history.future.slice(1),
  }
}
