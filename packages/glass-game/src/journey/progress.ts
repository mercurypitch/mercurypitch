// Journey progress display — apply saved stars and earned portrait art without owning game progress.

import type { Material, Mesh, Object3D } from 'three'
import { DoubleSide, MeshBasicMaterial, SRGBColorSpace, Texture } from 'three'
import type { MuseumJourneyDefinition } from '../content/museum-journey'

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

function abortError(): DOMException {
  return new DOMException('Journey portrait request cancelled.', 'AbortError')
}

async function loadPortraitTexture(
  url: string,
  signal: AbortSignal,
): Promise<Texture> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('The earned portrait could not be loaded.')
  const bitmap = await globalThis.createImageBitmap(await response.blob(), {
    imageOrientation: 'flipY',
    premultiplyAlpha: 'none',
  })
  if (signal.aborted) {
    bitmap.close()
    throw abortError()
  }
  const texture = new Texture(bitmap)
  texture.name = `journey-earned-portrait:${url}`
  texture.colorSpace = SRGBColorSpace
  // ImageBitmap uploads ignore Texture.flipY. The bitmap is flipped above so
  // the explicit texture state remains correct for Three's bitmap path.
  texture.flipY = false
  texture.needsUpdate = true
  return texture
}

function disposeTexture(texture: Texture): void {
  texture.dispose()
  const image = texture.image as { close?: () => void } | undefined
  image?.close?.()
}

function savedStars(value: unknown): 0 | 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3 ? value : 0
}

function cropTextureToSurface(texture: Texture, surface: Mesh): void {
  if (surface.userData.journeyPortraitUv === 'authored') {
    // The donor inset already maps its arched 2:3 opening. Its monument is
    // turned around to face the camera, so reverse U. Its glTF V runs from one
    // at the bottom to zero at the top, unlike PlaneGeometry, so reverse V on
    // the already-upright ImageBitmap too while preserving the authored crop.
    texture.repeat.set(-1, -1)
    texture.offset.set(1, 1)
    texture.needsUpdate = true
    return
  }
  const image = texture.image as
    | { readonly width?: number; readonly height?: number }
    | undefined
  const width = image?.width
  const height = image?.height
  surface.geometry.computeBoundingBox()
  const bounds = surface.geometry.boundingBox
  if (
    width === undefined ||
    height === undefined ||
    width <= 0 ||
    height <= 0 ||
    bounds === null
  )
    return
  const surfaceWidth =
    Math.abs(bounds.max.x - bounds.min.x) * Math.abs(surface.scale.x)
  const surfaceHeight =
    Math.abs(bounds.max.y - bounds.min.y) * Math.abs(surface.scale.y)
  if (surfaceWidth <= 0 || surfaceHeight <= 0) return
  const imageAspect = width / height
  const surfaceAspect = surfaceWidth / surfaceHeight
  texture.repeat.set(1, 1)
  texture.offset.set(0, 0)
  if (imageAspect > surfaceAspect) {
    texture.repeat.x = surfaceAspect / imageAspect
    texture.offset.x = (1 - texture.repeat.x) / 2
  } else if (imageAspect < surfaceAspect) {
    texture.repeat.y = imageAspect / surfaceAspect
    texture.offset.y = (1 - texture.repeat.y) / 2
  }
  texture.needsUpdate = true
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
  const loadTexture = options.loadTexture ?? loadPortraitTexture
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
      disposeTexture(state.texture)
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
          disposeTexture(texture)
          return
        }
        state.request = undefined
        cropTextureToSurface(texture, state.surface)
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
