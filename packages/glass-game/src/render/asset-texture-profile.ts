// Mobile asset textures — shrink decoded GLB images before their first GPU upload.

import type { Material, Object3D, Texture } from 'three'
import type { GlassAssetQualityProfile } from './render-quality'

const COLOR_OR_NORMAL_LIMIT = 1024
const PACKED_DATA_LIMIT = 512

const TEXTURE_LIMITS = {
  map: COLOR_OR_NORMAL_LIMIT,
  normalMap: COLOR_OR_NORMAL_LIMIT,
  emissiveMap: COLOR_OR_NORMAL_LIMIT,
  roughnessMap: PACKED_DATA_LIMIT,
  metalnessMap: PACKED_DATA_LIMIT,
  aoMap: PACKED_DATA_LIMIT,
} as const

type TextureSlot = keyof typeof TEXTURE_LIMITS

interface ImageDimensions {
  readonly height: number
  readonly width: number
}

export type ResizeAssetImage = (
  image: TexImageSource,
  dimensions: ImageDimensions,
) => Promise<TexImageSource>

export interface AssetTextureProfileMetrics {
  readonly resizedSources: number
  readonly releasedSources: number
}

function dimensions(image: TexImageSource): ImageDimensions | undefined {
  const candidate = image as TexImageSource & {
    readonly height?: number
    readonly naturalHeight?: number
    readonly naturalWidth?: number
    readonly videoHeight?: number
    readonly videoWidth?: number
    readonly width?: number
  }
  const width =
    candidate.naturalWidth ?? candidate.videoWidth ?? candidate.width ?? 0
  const height =
    candidate.naturalHeight ?? candidate.videoHeight ?? candidate.height ?? 0
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return undefined
  return { width, height }
}

function constrainedDimensions(
  image: TexImageSource,
  maximumDimension: number,
): ImageDimensions | undefined {
  const source = dimensions(image)
  if (source === undefined) return undefined
  const scale = Math.min(
    1,
    maximumDimension / Math.max(source.width, source.height),
  )
  if (scale === 1) return undefined
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  }
}

export function releaseAssetImage(image: TexImageSource): boolean {
  const candidate = image as TexImageSource & { close?: () => void }
  if (typeof candidate.close !== 'function') return false
  candidate.close()
  return true
}

async function resizeBrowserImage(
  image: TexImageSource,
  target: ImageDimensions,
): Promise<TexImageSource> {
  if (typeof globalThis.createImageBitmap === 'function') {
    try {
      const resized = await globalThis.createImageBitmap(
        image as ImageBitmapSource,
        {
          colorSpaceConversion: 'none',
          imageOrientation: 'none',
          premultiplyAlpha: 'none',
          resizeHeight: target.height,
          resizeQuality: 'high',
          resizeWidth: target.width,
        },
      )
      const actual = dimensions(resized)
      if (actual?.width === target.width && actual.height === target.height)
        return resized
      if (resized !== image) releaseAssetImage(resized)
    } catch {
      // Some WebKit builds expose createImageBitmap without resize options.
    }
  }
  if (typeof document === 'undefined')
    throw new Error('This browser cannot resize mobile GLB textures.')
  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  const context = canvas.getContext('2d')
  if (context === null)
    throw new Error('This browser could not allocate a mobile texture canvas.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    image as CanvasImageSource,
    0,
    0,
    target.width,
    target.height,
  )
  return canvas
}

function materials(object: Object3D): readonly Material[] {
  const material = (
    object as Object3D & {
      readonly material?: Material | readonly Material[]
    }
  ).material
  if (material === undefined) return []
  return Array.isArray(material)
    ? (material as readonly Material[])
    : [material as Material]
}

function materialTextures(material: Material): readonly Texture[] {
  return Object.values(material).filter(
    (value): value is Texture =>
      typeof value === 'object' &&
      value !== null &&
      (value as Texture).isTexture === true,
  )
}

function imageStates(root: Object3D) {
  const states = new Map<
    TexImageSource,
    {
      maximumDimension: number
      sources: Set<Texture['source']>
      textures: Set<Texture>
    }
  >()
  root.traverse((object) => {
    for (const material of materials(object)) {
      for (const texture of materialTextures(material)) {
        const image = texture.source.data as TexImageSource | undefined
        if (image === undefined) continue
        const state = states.get(image) ?? {
          maximumDimension: 0,
          sources: new Set<Texture['source']>(),
          textures: new Set<Texture>(),
        }
        state.sources.add(texture.source)
        state.textures.add(texture)
        states.set(image, state)
      }
      for (const [slot, maximumDimension] of Object.entries(TEXTURE_LIMITS) as [
        TextureSlot,
        number,
      ][]) {
        const texture = (
          material as Material & Partial<Record<TextureSlot, Texture>>
        )[slot]
        if (texture?.isTexture !== true) continue
        const image = texture.source.data as TexImageSource | undefined
        if (image === undefined) continue
        const state = states.get(image)!
        // A shared image used for both color and packed data keeps the larger cap.
        state.maximumDimension = Math.max(
          state.maximumDimension,
          maximumDimension,
        )
      }
    }
  })
  return states
}

/** Returns every decoded image directly owned by one unpublished GLB scene. */
export function collectAssetTextureImages(root: Object3D): Set<TexImageSource> {
  return new Set(imageStates(root).keys())
}

/** Releases an unpublished scene's unique decoded images after its textures. */
export function releaseAssetTextureImages(root: Object3D): number {
  let released = 0
  for (const image of collectAssetTextureImages(root))
    if (releaseAssetImage(image)) released++
  return released
}

function assetProfileAbortError(): DOMException {
  return new DOMException(
    'Mobile asset texture preparation was aborted.',
    'AbortError',
  )
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true
}

/** Applies a deterministic decoded-image budget without changing geometry. */
export async function applyAssetTextureProfile(
  root: Object3D,
  profile: GlassAssetQualityProfile,
  resizeImage: ResizeAssetImage = resizeBrowserImage,
  signal?: AbortSignal,
): Promise<AssetTextureProfileMetrics> {
  if (isAborted(signal)) throw assetProfileAbortError()
  if (profile === 'full') return { resizedSources: 0, releasedSources: 0 }

  const byImage = imageStates(root)

  let resizedSources = 0
  let releasedSources = 0
  for (const [image, state] of byImage) {
    if (isAborted(signal)) throw assetProfileAbortError()
    if (state.maximumDimension === 0) continue
    const target = constrainedDimensions(image, state.maximumDimension)
    if (target === undefined) continue
    const resized = await resizeImage(image, target)
    if (isAborted(signal)) {
      if (resized !== image) releaseAssetImage(resized)
      throw assetProfileAbortError()
    }
    const actual = dimensions(resized)
    if (actual?.width !== target.width || actual.height !== target.height) {
      if (resized !== image) releaseAssetImage(resized)
      throw new Error(
        'The mobile GLB texture resize returned invalid dimensions.',
      )
    }
    state.sources.forEach((source) => {
      source.data = resized
    })
    state.textures.forEach((texture) => {
      texture.needsUpdate = true
    })
    resizedSources++
    if (resized !== image && releaseAssetImage(image)) releasedSources++
  }
  return { resizedSources, releasedSources }
}
