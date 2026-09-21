// Floating museum journey — stable map stages and authored scene placement.

import type { GalleryChapter } from './campaign'

export type JourneyPoint = readonly [x: number, y: number, z: number]

export interface MuseumJourneyStage {
  id: string
  chapterIds: readonly string[]
  position: JourneyPoint
  yaw: number
  scale: number
  focus: JourneyPoint
  merc: JourneyPoint
  kind: 'pavilion' | 'rotunda' | 'twins' | 'conservatory'
  accent: 'jade' | 'gold' | 'amber-celadon' | 'celadon'
}

export interface MuseumJourneyBridge {
  id: string
  fromStageId: string
  toStageId: string
  from: JourneyPoint
  to: JourneyPoint
  width: number
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
  stages: readonly MuseumJourneyStage[]
  bridges: readonly MuseumJourneyBridge[]
  spillways: readonly MuseumJourneySpillway[]
}

export const FLOATING_MUSEUM_JOURNEY: MuseumJourneyDefinition = {
  id: 'floating-museum-v1',
  modelAssetId: 'floating-museum-map-kit-v1',
  stages: [
    {
      id: 'first-light-isle',
      chapterIds: ['first-light'],
      position: [-6.3, 0.3, 2.7],
      yaw: -0.18,
      scale: 1.05,
      focus: [-6.3, 0.8, 2.7],
      merc: [-5.25, 0.372, 2.2],
      kind: 'pavilion',
      accent: 'jade',
    },
    {
      id: 'glassworks-isle',
      chapterIds: ['glassworks'],
      position: [-2.15, -0.05, -1.25],
      yaw: 0.12,
      scale: 1.35,
      focus: [-2.15, 0.85, -1.25],
      merc: [-0.8, 0.031, -1.65],
      kind: 'rotunda',
      accent: 'gold',
    },
    {
      id: 'twin-galleries-isle',
      chapterIds: ['twin-galleries'],
      position: [3.05, 0.25, 2.0],
      yaw: -0.08,
      scale: 1.18,
      focus: [3.05, 0.95, 2.0],
      merc: [1.75, 0.325, 1.6],
      kind: 'twins',
      accent: 'amber-celadon',
    },
    {
      id: 'resonance-conservatory-isle',
      chapterIds: ['resonance-conservatory'],
      position: [7.1, -0.2, -2.15],
      yaw: 0.18,
      scale: 1.3,
      focus: [7.1, 1.05, -2.15],
      merc: [5.75, -0.121, -2.45],
      kind: 'conservatory',
      accent: 'celadon',
    },
  ],
  bridges: [
    {
      id: 'first-light-to-glassworks',
      fromStageId: 'first-light-isle',
      toStageId: 'glassworks-isle',
      from: [-5.35, 0.28, 1.75],
      to: [-3.25, 0.13, -0.25],
      width: 0.82,
    },
    {
      id: 'glassworks-to-twins',
      fromStageId: 'glassworks-isle',
      toStageId: 'twin-galleries-isle',
      from: [-0.75, 0.08, -0.45],
      to: [1.75, 0.26, 1.22],
      width: 0.88,
    },
    {
      id: 'twins-to-conservatory',
      fromStageId: 'twin-galleries-isle',
      toStageId: 'resonance-conservatory-isle',
      from: [4.15, 0.28, 1.1],
      to: [5.9, -0.04, -1.25],
      width: 0.86,
    },
  ],
  spillways: [
    {
      id: 'glassworks-falls',
      stageId: 'glassworks-isle',
      position: [-2.15, -0.01, 1.75],
      width: 0.72,
      height: 7.6,
      yaw: 0,
      basin: false,
    },
    {
      id: 'twin-falls',
      stageId: 'twin-galleries-isle',
      position: [3.05, 0.285, 4.72],
      width: 0.62,
      height: 6.7,
      yaw: 0,
      basin: false,
    },
    {
      id: 'conservatory-east-falls',
      stageId: 'resonance-conservatory-isle',
      position: [10.15, -0.161, -2.15],
      width: 0.65,
      height: 7.45,
      yaw: Math.PI / 2,
      basin: false,
    },
    {
      id: 'conservatory-south-falls',
      stageId: 'resonance-conservatory-isle',
      position: [7.1, -0.161, 0.88],
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
  const stageIds = new Set<string>()
  const assigned = new Set<string>()
  for (const stage of definition.stages) {
    if (stageIds.has(stage.id))
      errors.push(`Duplicate journey stage: ${stage.id}`)
    stageIds.add(stage.id)
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
