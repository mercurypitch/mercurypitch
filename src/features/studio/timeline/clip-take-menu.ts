// Studio clip take menu — a clip's takes as menu rows, the one playing checked, then Show takes: what its right-click menu and the Takes list on its toolbar show.
//
// The rows are OverflowMenu's plain rows, so a shared Studio menu (a lane's
// own, for one) can take them in as they are. A row is a step of the takes,
// as T steps through them (clip-takes.ts): a take, or a pass of a loop take
// that is not comped. Picking the row already playing changes nothing.
import type { OverflowMenuItem } from '@/components/OverflowMenu'
import type { StudioTakeStep } from '@/lib/studio/model/clip-takes'
import { studioClipTakeList, studioClipTakeStep, studioClipTakeSteps, } from '@/lib/studio/model/clip-takes'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioClip } from '@/lib/studio/model/types'
import { studioClipTakeName } from './clip-take-name'
import { studioTakesClipId, toggleStudioTakes } from './comp-editor'

/** A step's name in the list: its take's file name, or "Take 2" for one without, and its pass or comp. */
export function studioTakeStepName(
  clip: StudioClip,
  step: StudioTakeStep,
  assets: ReadonlyMap<string, StudioAsset>,
): string {
  const take = studioClipTakeList(clip)[step.take]
  const name = studioClipTakeName(
    assets.get(take.assetId),
    `Take ${step.take + 1}`,
  )
  if (step.pass !== undefined && take.passes)
    return `${name}, pass ${step.pass + 1} of ${take.passes.count}`
  return take.comp ? `${name}, comp` : name
}

/** The command that plays a step. */
export function studioChooseTakeCommand(
  clip: StudioClip,
  step: StudioTakeStep,
): StudioCommand {
  return {
    type: 'choose-take',
    clipId: clip.id,
    take: step.take,
    ...(step.pass !== undefined && { pass: step.pass }),
  }
}

/**
 * The clip's takes as menu rows, oldest first, the playing one checked; then,
 * for a clip of several takes, Show takes, which stands them in rows under
 * its lane (StudioTakeLanes.tsx), or Hide takes while they stand there.
 */
export function studioClipTakeMenu(
  clip: StudioClip,
  assets: ReadonlyMap<string, StudioAsset>,
  onCommand: (command: StudioCommand) => boolean,
  writable: boolean,
): OverflowMenuItem[] {
  const rows = takeRows(clip, assets, onCommand, writable)
  if (clip.takes === undefined) return rows
  const shown = studioTakesClipId() === clip.id
  return [
    ...rows,
    {
      key: 'show-takes',
      label: shown ? 'Hide takes' : 'Show takes',
      separatorBefore: true,
      onSelect: () => toggleStudioTakes(clip.id),
    },
  ]
}

function takeRows(
  clip: StudioClip,
  assets: ReadonlyMap<string, StudioAsset>,
  onCommand: (command: StudioCommand) => boolean,
  writable: boolean,
): OverflowMenuItem[] {
  const playing = studioClipTakeStep(clip)
  return studioClipTakeSteps(clip).map((step, index) => ({
    key: `take-${step.take}-${step.pass ?? 'whole'}`,
    label: studioTakeStepName(clip, step, assets),
    checked: index === playing,
    checkType: 'radio',
    disabled: !writable,
    onSelect: () => {
      if (index !== playing) onCommand(studioChooseTakeCommand(clip, step))
    },
  }))
}
