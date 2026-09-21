// Floating museum journey — stable map stages and authored scene placement.

import type { GalleryChapter } from './campaign'

export type JourneyPoint = readonly [x: number, y: number, z: number]

export interface MuseumJourneyLandmass {
  id: string
  position: JourneyPoint
  yaw: number
  scale: JourneyPoint
  terraceScale: JourneyPoint
}

export interface MuseumJourneyPortraitMonument {
  position: JourneyPoint
  yaw: number
  /** Stable seam for replacing the mystery silhouette with earned art later. */
  portraitId: string
}

export interface MuseumJourneyStage {
  id: string
  chapterIds: readonly string[]
  islandId: string
  /** Selectable path medallion and label anchor. */
  position: JourneyPoint
  /** Building anchor, separate so labels never sit under architecture. */
  architecturePosition: JourneyPoint
  yaw: number
  scale: number
  focus: JourneyPoint
  merc: JourneyPoint
  portrait?: MuseumJourneyPortraitMonument
  kind: 'pavilion' | 'garden' | 'rotunda' | 'twins' | 'conservatory'
  accent: 'jade' | 'gold' | 'amber-celadon' | 'celadon'
}

export interface MuseumJourneyBridge {
  id: string
  fromStageId: string
  toStageId: string
  from: JourneyPoint
  to: JourneyPoint
  width: number
  kind: 'promenade' | 'skybridge'
  /** Signed horizontal bow in metres. */
  curve: number
}

export interface MuseumJourneySpillway {
  id: string
  stageId: string
  position: JourneyPoint
  width: number
  height: number
  yaw: number
  basin?: boolean
}

export interface MuseumJourneyDefinition {
  id: string
  modelAssetId: string
  sculpturalAssetId?: string
  landmasses: readonly MuseumJourneyLandmass[]
  stages: readonly MuseumJourneyStage[]
  bridges: readonly MuseumJourneyBridge[]
  spillways: readonly MuseumJourneySpillway[]
}

export const FLOATING_MUSEUM_JOURNEY: MuseumJourneyDefinition = {
  id: 'floating-museum-v1',
  modelAssetId: 'floating-museum-map-kit-v1',
  sculpturalAssetId: 'floating-museum-sculpture-kit-v3',
  landmasses: [
    {
      id: 'first-light-landmass',
      position: [-5.15, 0.22, 2.55],
      yaw: -0.12,
      scale: [1.86, 1.08, 1.45],
      terraceScale: [1.7, 1, 1.25],
    },
    {
      id: 'twin-galleries-landmass',
      position: [0.25, 0.7, 0.05],
      yaw: 0.04,
      scale: [1.8, 1.25, 1.58],
      terraceScale: [1.65, 1, 1.42],
    },
    {
      id: 'resonance-conservatory-landmass',
      position: [5.15, 1.03, -3.05],
      yaw: 0.18,
      scale: [1.56, 1.12, 1.38],
      terraceScale: [1.45, 1, 1.23],
    },
  ],
  stages: [
    {
      id: 'first-light-isle',
      chapterIds: ['first-light'],
      islandId: 'first-light-landmass',
      position: [-6.1, 0.3, 4.15],
      architecturePosition: [-5.34, 0.28, 1.67],
      yaw: -0.18,
      scale: 0.94,
      focus: [-5.7, 1.05, 2.75],
      merc: [-5.72, 0.38, 3.98],
      portrait: {
        position: [-6.72, 0.27, 2.84],
        yaw: 0.22,
        portraitId: 'first-light-mystery-portrait',
      },
      kind: 'pavilion',
      accent: 'jade',
    },
    {
      id: 'glassworks-isle',
      chapterIds: ['glassworks'],
      islandId: 'first-light-landmass',
      position: [-4.02, 0.3, 3.55],
      architecturePosition: [-3.96, 0.28, 2.35],
      yaw: 0.12,
      scale: 0.88,
      focus: [-4.3, 1.05, 2.15],
      merc: [-4.31, 0.38, 3.38],
      kind: 'garden',
      accent: 'gold',
    },
    {
      id: 'twin-galleries-isle',
      chapterIds: ['twin-galleries'],
      islandId: 'twin-galleries-landmass',
      position: [0.1, 0.78, 2.03],
      architecturePosition: [0.18, 0.76, -0.02],
      yaw: -0.08,
      scale: 1.28,
      focus: [0.25, 1.65, 0.1],
      merc: [-0.02, 0.86, 1.87],
      portrait: {
        position: [2.1, 0.75, 0.73],
        yaw: -0.34,
        portraitId: 'twin-galleries-mystery-portrait',
      },
      kind: 'twins',
      accent: 'amber-celadon',
    },
    {
      id: 'resonance-conservatory-isle',
      chapterIds: ['resonance-conservatory'],
      islandId: 'resonance-conservatory-landmass',
      position: [4.72, 1.11, -1.2],
      architecturePosition: [5.18, 1.09, -3.16],
      yaw: 0.18,
      scale: 0.76,
      focus: [5.08, 1.85, -2.85],
      merc: [4.66, 1.18, -1.42],
      portrait: {
        position: [3.85, 1.08, -2.73],
        yaw: -0.38,
        portraitId: 'conservatory-mystery-portrait',
      },
      kind: 'conservatory',
      accent: 'celadon',
    },
  ],
  bridges: [
    {
      id: 'first-light-to-glassworks',
      fromStageId: 'first-light-isle',
      toStageId: 'glassworks-isle',
      from: [-5.87, 0.3, 4.08],
      to: [-4.24, 0.3, 3.55],
      width: 0.72,
      kind: 'promenade',
      curve: 0.28,
    },
    {
      id: 'glassworks-to-twins',
      fromStageId: 'glassworks-isle',
      toStageId: 'twin-galleries-isle',
      from: [-2.83, 0.28, 1.62],
      to: [-1.54, 0.75, 0.95],
      width: 0.82,
      kind: 'skybridge',
      curve: -0.22,
    },
    {
      id: 'twins-to-conservatory',
      fromStageId: 'twin-galleries-isle',
      toStageId: 'resonance-conservatory-isle',
      from: [1.88, 0.74, -0.8],
      to: [3.72, 1.05, -2.22],
      width: 0.8,
      kind: 'skybridge',
      curve: 0.42,
    },
  ],
  spillways: [
    {
      id: 'glassworks-falls',
      stageId: 'glassworks-isle',
      position: [-5.22, 0.26, 4.42],
      width: 0.72,
      height: 7.6,
      yaw: 0,
      basin: false,
    },
    {
      id: 'twin-falls',
      stageId: 'twin-galleries-isle',
      position: [0.1, 0.74, 2.63],
      width: 0.62,
      height: 6.7,
      yaw: 0,
      basin: false,
    },
    {
      id: 'conservatory-east-falls',
      stageId: 'resonance-conservatory-isle',
      position: [7.1, 1.07, -3.2],
      width: 0.65,
      height: 7.45,
      yaw: Math.PI / 2,
      basin: false,
    },
    {
      id: 'conservatory-south-falls',
      stageId: 'resonance-conservatory-isle',
      position: [6.15, 1.07, -1.45],
      width: 0.5,
      height: 7.45,
      yaw: 0,
      basin: false,
    },
  ],
}

/** Reject authoring drift before a scene tries to assemble incomplete islands. */
export function validateMuseumJourney(
  definition: MuseumJourneyDefinition,
  chapters: readonly GalleryChapter[],
): string[] {
  const errors: string[] = []
  const chapterIds = new Set(chapters.map((chapter) => chapter.id))
  const islandIds = new Set<string>()
  for (const island of definition.landmasses) {
    if (islandIds.has(island.id))
      errors.push(`Duplicate journey landmass: ${island.id}`)
    islandIds.add(island.id)
  }
  const stageIds = new Set<string>()
  const assigned = new Set<string>()
  for (const stage of definition.stages) {
    if (stageIds.has(stage.id))
      errors.push(`Duplicate journey stage: ${stage.id}`)
    stageIds.add(stage.id)
    if (!islandIds.has(stage.islandId))
      errors.push(`Unknown journey landmass: ${stage.islandId}`)
    if (stage.chapterIds.length === 0)
      errors.push(`Journey stage has no chapters: ${stage.id}`)
    for (const chapterId of stage.chapterIds) {
      if (!chapterIds.has(chapterId))
        errors.push(`Unknown journey chapter: ${chapterId}`)
      if (assigned.has(chapterId))
        errors.push(`Journey chapter assigned twice: ${chapterId}`)
      assigned.add(chapterId)
    }
  }
  for (const bridge of definition.bridges) {
    if (!stageIds.has(bridge.fromStageId))
      errors.push(`Unknown bridge origin: ${bridge.fromStageId}`)
    if (!stageIds.has(bridge.toStageId))
      errors.push(`Unknown bridge destination: ${bridge.toStageId}`)
  }
  for (const spillway of definition.spillways)
    if (!stageIds.has(spillway.stageId))
      errors.push(`Unknown spillway stage: ${spillway.stageId}`)
  for (const chapterId of chapterIds)
    if (!assigned.has(chapterId))
      errors.push(`Campaign chapter missing from journey: ${chapterId}`)
  return errors
}
