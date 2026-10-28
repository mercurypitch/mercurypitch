// ============================================================
// The stage a drill view renders: the bench's (EarStage.tsx) on the web
// and in the store build, Merc's drill room where EAR_LAB_WITH_MERC is
// on. The constant folds, so each build carries one.
//
// Apart from EarStage.tsx on purpose: the room's chunk borrows the
// bench's pads and keys from there, so the lazy import that loads the
// chunk must not live in the module the chunk imports.
// ============================================================

import type { Component } from 'solid-js'
import { lazy } from 'solid-js'
import { EAR_LAB_WITH_MERC } from '@/lib/native-build'
import type { EarStageProps } from './EarStage'
import { BenchStage } from './EarStage'

/** The native room, loaded only behind the switch: a store build and the
 *  web fold the import away with the branch. */
const MercStage: Component<EarStageProps> = EAR_LAB_WITH_MERC
  ? lazy(async () =>
      import('./merc/entry').then((module) => ({
        default: module.MercDrillRoom,
      })),
    )
  : () => null

/** The stage: the native room on a build with the Ear Lab with Merc, the
 *  web's stage everywhere else. */
export const EarStage: Component<EarStageProps> = EAR_LAB_WITH_MERC
  ? MercStage
  : BenchStage
