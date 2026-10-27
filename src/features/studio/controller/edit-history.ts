// Studio editor history — command labels accompany pure undo snapshots without entering saved data.
import type { StudioCommand, StudioCommandOptions, StudioEdit, } from '@/lib/studio/model/commands'
import type { StudioHistory } from '@/lib/studio/model/history'
import { createStudioHistory, executeStudioCommand, redoStudioCommand, undoStudioCommand, } from '@/lib/studio/model/history'
import type { StudioProject } from '@/lib/studio/model/types'

export interface StudioEditHistory {
  state: StudioHistory
  pastLabels: readonly string[]
  futureLabels: readonly string[]
}

const EDIT_LABELS: Record<StudioEdit['type'], string> = {
  'rename-project': 'rename project',
  'add-track': 'add lane',
  'add-clip': 'add clip',
  'add-audio': 'add take',
  'remove-track': 'remove lane',
  'update-track': 'change lane',
  'set-track-role': 'change lane role',
  'remove-clip': 'remove clip',
  'move-clip': 'move clip',
  'move-clip-to-new-track': 'move clip to new lane',
  'paste-clip': 'paste clip',
  'trim-head': 'trim start',
  'trim-tail': 'trim end',
  'split-clip': 'split clip',
  'duplicate-clip': 'duplicate clip',
  'set-fades': 'change fades',
  'set-clip-gain': 'change clip volume',
  'set-project-settings': 'change song settings',
  'set-sound-flavour': 'change flavour',
  'set-sound-macros': 'adjust sound',
  'set-master-preset': 'change master target',
  'apply-auto-balance': 'auto-balance',
}

type TrackChanges = Extract<StudioEdit, { type: 'update-track' }>['changes']

/** What one lane edit changed, in the words of the control that changed it. */
function trackChangeLabel(changes: TrackChanges): string {
  const keys = Object.keys(changes)
  if (keys.length !== 1) return EDIT_LABELS['update-track']
  if (changes.gainDb !== undefined) return 'volume'
  if (changes.pan !== undefined) return 'pan'
  if (changes.mute !== undefined) return changes.mute ? 'mute' : 'unmute'
  if (changes.solo !== undefined) return changes.solo ? 'solo' : 'unsolo'
  if (changes.name !== undefined) return 'rename lane'
  return EDIT_LABELS['update-track']
}

function commandLabel(command: StudioCommand): string {
  if (command.type === 'update-track') return trackChangeLabel(command.changes)
  if (command.type !== 'batch') return EDIT_LABELS[command.type]
  return command.commands.every((edit) => edit.type === 'add-audio')
    ? 'add takes'
    : 'edit arrangement'
}

export function createStudioEditHistory(
  project: StudioProject,
): StudioEditHistory {
  return {
    state: createStudioHistory(project),
    pastLabels: [],
    futureLabels: [],
  }
}

export function executeStudioEdit(
  history: StudioEditHistory,
  command: StudioCommand,
  options: StudioCommandOptions,
): StudioEditHistory {
  const state = executeStudioCommand(history.state, command, options)
  if (state === history.state) return history
  return {
    state,
    pastLabels: [...history.pastLabels, commandLabel(command)].slice(
      -state.limit,
    ),
    futureLabels: [],
  }
}

export function travelStudioHistory(
  history: StudioEditHistory,
  direction: 'undo' | 'redo',
  options: StudioCommandOptions,
): StudioEditHistory {
  const state =
    direction === 'undo'
      ? undoStudioCommand(history.state, options)
      : redoStudioCommand(history.state, options)
  if (state === history.state) return history
  if (direction === 'undo') {
    return {
      state,
      pastLabels: history.pastLabels.slice(0, -1),
      futureLabels: [
        history.pastLabels.at(-1) ?? 'edit arrangement',
        ...history.futureLabels,
      ],
    }
  }
  return {
    state,
    pastLabels: [
      ...history.pastLabels,
      history.futureLabels[0] ?? 'edit arrangement',
    ].slice(-state.limit),
    futureLabels: history.futureLabels.slice(1),
  }
}
