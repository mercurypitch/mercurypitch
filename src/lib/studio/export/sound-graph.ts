// Studio resolved sound — one master specification shared by preview and export finish passes.
import { masterBusChain, masterChain, masterFinishChain, } from '@/lib/studio-fx/master'
import type { StudioProject } from '../model/types'

export interface StudioMasterGain {
  gainDb: number
  safetyGainDb: number
}

export interface StudioMasterGainToken extends StudioMasterGain {
  projectId: string
  revision: number
}

export function resolveStudioSoundGraph(
  project: StudioProject,
  measured: StudioMasterGain = { gainDb: 0, safetyGainDb: 0 },
) {
  const sound = {
    macros: project.mix.macros,
    masterEq: project.master.masterEq,
  }
  const finish = { ...measured, ceilingDb: project.master.ceilingDbtp }
  return {
    bus: masterBusChain(sound),
    finish: masterFinishChain(
      finish.gainDb,
      finish.ceilingDb,
      finish.safetyGainDb,
    ),
    full: masterChain({ ...sound, ...finish }),
  }
}
