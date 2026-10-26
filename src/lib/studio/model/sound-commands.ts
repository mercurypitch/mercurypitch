// Studio sound commands — resolve presets from their base and apply measured balance atomically.
import { defaultEffectParams } from '@/lib/studio-fx/chain-spec'
import { LOUDNESS_PRESETS, MASTER_CEILING_DB } from '@/lib/studio-fx/master'
import type { MixMacros } from '@/lib/studio-fx/mix-macros'
import { MIX_FLAVOURS } from '@/lib/studio-fx/mix-macros'
import type { StudioProject } from './types'
import { numberValue, requireValue } from './validation-values'

export type StudioSoundEdit =
  | { readonly type: 'set-sound-flavour'; readonly flavourId: string }
  | { readonly type: 'set-sound-macros'; readonly macros: MixMacros }
  | { readonly type: 'set-master-preset'; readonly presetId: string }
  | {
      readonly type: 'apply-auto-balance'
      readonly sourceRevision: number
      readonly balanceGainDbByTrack: Readonly<Record<string, number>>
    }

function applyBalance(
  project: StudioProject,
  edit: Extract<StudioSoundEdit, { type: 'apply-auto-balance' }>,
): StudioProject {
  requireValue(
    edit.sourceRevision === project.revision,
    'mix.autoBalanceRevision',
    'The song changed. Run Auto-balance again.',
  )
  const trackIds = new Set(project.tracks.map((track) => track.id))
  for (const [id, gain] of Object.entries(edit.balanceGainDbByTrack)) {
    requireValue(trackIds.has(id), `track.${id}`, 'Lane does not exist')
    numberValue(gain, `track.${id}.balanceGainDb`, -24, 24)
  }
  if (Object.keys(edit.balanceGainDbByTrack).length === 0) return project
  return {
    ...project,
    mix: { ...project.mix, autoBalanceRevision: project.revision + 1 },
    tracks: project.tracks.map((track) => ({
      ...track,
      balanceGainDb: edit.balanceGainDbByTrack[track.id] ?? track.balanceGainDb,
    })),
  }
}

export function applyStudioSoundEdit(
  project: StudioProject,
  edit: StudioSoundEdit,
): StudioProject {
  switch (edit.type) {
    case 'set-sound-flavour': {
      const flavour = MIX_FLAVOURS.find((item) => item.id === edit.flavourId)
      requireValue(flavour !== undefined, 'mix.flavourId', 'Unknown flavour')
      return {
        ...project,
        mix: {
          ...project.mix,
          flavourId: flavour.id,
          macros: { ...flavour.macros },
        },
        master: {
          ...project.master,
          masterEq: {
            ...defaultEffectParams('eq'),
            lowCutHz: 25,
            ...flavour.masterEq,
          },
        },
      }
    }
    case 'set-sound-macros':
      return { ...project, mix: { ...project.mix, macros: { ...edit.macros } } }
    case 'set-master-preset': {
      const preset = LOUDNESS_PRESETS.find((item) => item.id === edit.presetId)
      requireValue(
        preset !== undefined,
        'master.presetId',
        'Unknown master preset',
      )
      return {
        ...project,
        master: {
          ...project.master,
          presetId: preset.id,
          targetLufs: preset.targetLufs,
          maxLimitingDb: preset.maxLimitingDb,
          ceilingDbtp: MASTER_CEILING_DB,
        },
      }
    }
    case 'apply-auto-balance':
      return applyBalance(project, edit)
  }
}

export function isStudioSoundEdit(edit: {
  type: string
}): edit is StudioSoundEdit {
  return [
    'set-sound-flavour',
    'set-sound-macros',
    'set-master-preset',
    'apply-auto-balance',
  ].includes(edit.type)
}
