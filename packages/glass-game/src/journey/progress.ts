// Journey progress display — apply saved stars and earned portrait art without owning game progress.

import type { Material, Mesh, Object3D, Texture } from 'three'
import { DoubleSide, MeshBasicMaterial } from 'three'
import type { MuseumJourneyDefinition } from '../content/museum-journey'
import { disposeJourneyPortraitTexture, fitJourneyPortraitTexture, loadJourneyPortraitTexture, } from './portrait-texture'

export interface MuseumJourneyPortraitProgress {
  /** Saved collectible evidence; the authored stage still chooses the monument. */
  readonly id?: string
  readonly imageUrl: string
}

export interface MuseumJourneyStageProgress {
  readonly stageId: string
  readonly stars?: 1 | 2 | 3
  readonly portrait?: MuseumJourneyPortraitProgress
}

export type JourneyProgressStarMarkers = readonly [Object3D, Object3D, Object3D]

export interface JourneyProgressTargets {
  readonly starMarkers: ReadonlyMap<string, JourneyProgressStarMarkers>
  readonly portraitSurfaces: ReadonlyMap<string, Mesh>
  readonly portraitMysteries: ReadonlyMap<string, Object3D>
}

export interface JourneyProgressDisplay {
  setProgress(progress: readonly MuseumJourneyStageProgress[]): void
  dispose(): void
}

export interface JourneyProgressSnapshot {
  readonly stars: Readonly<Record<string, 0 | 1 | 2 | 3>>
  readonly earnedPortraitIds: readonly string[]
}

export interface JourneyProgressDisplayOptions {
  loadTexture?: (url: string, signal: AbortSignal) => Promise<Texture>
  onChange?: (snapshot: JourneyProgressSnapshot) => void
}

interface PortraitState {
  surface: Mesh
  mystery: Object3D | undefined
  originalMaterial: Material | Material[]
  originalSurfaceVisible: boolean
  originalMysteryVisible: boolean | undefined
  originalProgressState: unknown
  hadProgressState: boolean
  installedUrl?: string
  material?: MeshBasicMaterial
  texture?: Texture
  request?: {
    url: string
    controller: AbortController
    token: number
  }
}

interface StarState {
  markers: JourneyProgressStarMarkers
  originalVisibility: readonly [boolean, boolean, boolean]
}

function savedStars(value: unknown): 0 | 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3 ? value : 0
}

/**
 * The adapter owns only its replacement materials and textures. Authored map
 * materials can be shared by cloned kit meshes and are restored, never mutated.
 */
export function createJourneyProgressDisplay(
  definition: MuseumJourneyDefinition,
  targets: JourneyProgressTargets,
  options: JourneyProgressDisplayOptions = {},
): JourneyProgressDisplay {
  const loadTexture = options.loadTexture ?? loadJourneyPortraitTexture
  const stagesById = new Map(
    definition.stages.map((stage) => [stage.id, stage]),
  )
  const stars = new Map<string, StarState>()
  for (const [stageId, markers] of targets.starMarkers) {
    if (!stagesById.has(stageId)) continue
    stars.set(stageId, {
      markers,
      originalVisibility: [
        markers[0].visible,
        markers[1].visible,
        markers[2].visible,
      ],
    })
  }

  const portraits = new Map<string, PortraitState>()
  for (const stage of definition.stages) {
    const portraitId = stage.portrait?.portraitId
    if (portraitId === undefined || portraits.has(portraitId)) continue
    const surface = targets.portraitSurfaces.get(portraitId)
    if (surface === undefined) continue
    const mystery = targets.portraitMysteries.get(portraitId)
    portraits.set(portraitId, {
      surface,
      mystery,
      originalMaterial: surface.material,
      originalSurfaceVisible: surface.visible,
      originalMysteryVisible: mystery?.visible,
      originalProgressState: surface.userData.journeyPortraitState,
      hadProgressState: Object.hasOwn(surface.userData, 'journeyPortraitState'),
    })
  }

  let disposed = false
  let requestToken = 0
  const currentStars = new Map<string, 0 | 1 | 2 | 3>()

  function publish(): void {
    if (disposed) return
    const saved: Record<string, 0 | 1 | 2 | 3> = {}
    for (const stage of definition.stages)
      saved[stage.id] = currentStars.get(stage.id) ?? 0
    options.onChange?.({
      stars: saved,
      earnedPortraitIds: [...portraits]
        .filter(([, state]) => state.installedUrl !== undefined)
        .map(([portraitId]) => portraitId),
    })
  }

  function restorePortrait(state: PortraitState): void {
    state.request?.controller.abort()
    state.request = undefined
    if (state.material !== undefined) {
      if (state.surface.material === state.material)
        state.surface.material = state.originalMaterial
      state.material.dispose()
      state.material = undefined
    }
    if (state.texture !== undefined) {
      disposeJourneyPortraitTexture(state.texture)
      state.texture = undefined
    }
    state.installedUrl = undefined
    state.surface.visible = state.originalSurfaceVisible
    if (state.hadProgressState)
      state.surface.userData.journeyPortraitState = state.originalProgressState
    else delete state.surface.userData.journeyPortraitState
    if (state.mystery !== undefined)
      state.mystery.visible = state.originalMysteryVisible ?? true
  }

  function requestPortrait(state: PortraitState, url: string): void {
    if (state.installedUrl === url || state.request?.url === url) return
    restorePortrait(state)
    const controller = new AbortController()
    const token = ++requestToken
    state.request = { url, controller, token }
    void loadTexture(url, controller.signal).then(
      (texture) => {
        if (
          disposed ||
          state.request?.token !== token ||
          controller.signal.aborted
        ) {
          disposeJourneyPortraitTexture(texture)
          return
        }
        state.request = undefined
        fitJourneyPortraitTexture(texture, state.surface)
        const material = new MeshBasicMaterial({
          map: texture,
          side: DoubleSide,
          toneMapped: false,
        })
        material.name = `journey-earned-portrait-material:${url}`
        state.texture = texture
        state.material = material
        state.installedUrl = url
        state.surface.material = material
        state.surface.visible = true
        state.surface.userData.journeyPortraitState = 'earned'
        if (state.mystery !== undefined) state.mystery.visible = false
        publish()
      },
      () => {
        if (state.request?.token === token) state.request = undefined
      },
    )
  }

  return {
    setProgress(progress) {
      if (disposed) return
      const progressByStage = new Map<string, MuseumJourneyStageProgress>()
      for (const entry of progress)
        if (stagesById.has(entry.stageId))
          progressByStage.set(entry.stageId, entry)

      for (const [stageId, state] of stars) {
        const count = savedStars(progressByStage.get(stageId)?.stars)
        currentStars.set(stageId, count)
        state.markers.forEach((marker, index) => {
          marker.visible = index < count
        })
      }

      const desiredPortraits = new Map<string, string>()
      for (const stage of definition.stages) {
        const portraitId = stage.portrait?.portraitId
        const imageUrl = progressByStage.get(stage.id)?.portrait?.imageUrl
        if (
          portraitId !== undefined &&
          typeof imageUrl === 'string' &&
          imageUrl.trim() !== ''
        )
          desiredPortraits.set(portraitId, imageUrl)
      }
      for (const [portraitId, state] of portraits) {
        const url = desiredPortraits.get(portraitId)
        if (url === undefined) restorePortrait(state)
        else requestPortrait(state, url)
      }
      publish()
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const state of portraits.values()) restorePortrait(state)
      for (const state of stars.values())
        state.markers.forEach((marker, index) => {
          marker.visible = state.originalVisibility[index]!
        })
    },
  }
}
