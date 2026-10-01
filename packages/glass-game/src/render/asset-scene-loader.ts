// Profiled asset scenes — one cancellable Meshopt loader shared by gallery and runner presentation.
import type { Object3D } from 'three'
import { LoadingManager } from 'three'
import type { MeshoptDecoder as MeshoptDecoderValue } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { applyAssetTextureProfile, collectAssetTextureImages, releaseAssetTextureImages, } from './asset-texture-profile'
import { disposeObject } from './dispose'
import type { GlassAssetQualityProfile } from './render-quality'

type MeshoptDecoder = typeof MeshoptDecoderValue
type LoaderMeshoptDecoder = Pick<
  MeshoptDecoder,
  'decodeGltfBufferAsync' | 'supported'
>
type MeshoptDecodeArguments = Parameters<
  MeshoptDecoder['decodeGltfBufferAsync']
>

let decoderReady: Promise<MeshoptDecoder> | undefined

function loadMeshoptDecoder(): Promise<MeshoptDecoder> {
  decoderReady ??= import('three/addons/libs/meshopt_decoder.module.js')
    .then((module) => module.MeshoptDecoder)
    .catch((error: unknown) => {
      decoderReady = undefined
      throw error
    })
  return decoderReady
}

const lazyMeshoptDecoder = {
  supported: typeof WebAssembly !== 'undefined',
  decodeGltfBufferAsync: (...args: MeshoptDecodeArguments) => {
    return loadMeshoptDecoder().then((decoder) => {
      if (!decoder.supported)
        throw new Error('Meshopt decoding is unsupported in this runtime.')
      return decoder.decodeGltfBufferAsync(...args)
    })
  },
} satisfies LoaderMeshoptDecoder

export interface ProfiledAssetSceneOptions {
  readonly signal: AbortSignal
  readonly assetProfile?: GlassAssetQualityProfile
  readonly onDecodedImage?: (image: TexImageSource) => void
}

export async function loadProfiledAssetScene(
  url: string,
  options: ProfiledAssetSceneOptions,
): Promise<Object3D> {
  const abortError = () =>
    new DOMException('Asset loading was aborted.', 'AbortError')
  if (options.signal.aborted) throw abortError()
  const failedDependencies: string[] = []
  const manager = new LoadingManager()
  manager.onError = (dependency) => failedDependencies.push(dependency)
  const abort = () => manager.abort()
  options.signal.addEventListener('abort', abort, { once: true })
  let scene: Object3D | undefined
  try {
    scene = (
      await new GLTFLoader(manager)
        .setMeshoptDecoder(lazyMeshoptDecoder as MeshoptDecoder)
        .loadAsync(url)
    ).scene
    if (options.signal.aborted) throw abortError()
    if (failedDependencies.length > 0)
      throw new Error(
        `Asset has unavailable dependencies: ${failedDependencies.join(', ')}`,
      )
    await applyAssetTextureProfile(
      scene,
      options.assetProfile ?? 'full',
      undefined,
      options.signal,
    )
    if (options.signal.aborted) throw abortError()
    collectAssetTextureImages(scene).forEach((image) =>
      options.onDecodedImage?.(image),
    )
    return scene
  } catch (error) {
    if (scene) {
      releaseAssetTextureImages(scene)
      disposeObject(scene)
    }
    throw error
  } finally {
    options.signal.removeEventListener('abort', abort)
  }
}
