// Profiled asset scenes — one cancellable Meshopt loader shared by gallery and runner presentation.
import { readAssetBytes } from '@irchiinnuss/mobile-runtime/asset-fetch'
import type { Object3D } from 'three'
import { LoaderUtils, LoadingManager } from 'three'
import type { MeshoptDecoder as MeshoptDecoderValue } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { withAssetLoadAdmission } from './asset-load-admission'
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

/** Share lazy Meshopt decoding with every game GLB loader. */
export function createGameGltfLoader(manager?: LoadingManager): GLTFLoader {
  return new GLTFLoader(manager).setMeshoptDecoder(
    lazyMeshoptDecoder as MeshoptDecoder,
  )
}

export interface ProfiledAssetSceneOptions {
  readonly signal: AbortSignal
  readonly assetProfile?: GlassAssetQualityProfile
  readonly onDecodedImage?: (image: TexImageSource) => void
}

function assetResourcePath(url: string): string {
  try {
    const base = typeof document === 'undefined' ? undefined : document.baseURI
    return new URL('.', new URL(url, base)).href
  } catch {
    // Preserve Three's path behavior for opaque data/blob container URLs.
    return LoaderUtils.extractUrlBase(url)
  }
}

export async function loadProfiledAssetScene(
  url: string,
  options: ProfiledAssetSceneOptions,
): Promise<Object3D> {
  const abortError = () =>
    new DOMException('Asset loading was aborted.', 'AbortError')
  if (options.signal.aborted) throw abortError()
  return withAssetLoadAdmission(options.signal, async () => {
    const failedDependencies: string[] = []
    const manager = new LoadingManager()
    manager.onError = (dependency) => failedDependencies.push(dependency)
    let scene: Object3D | undefined
    try {
      // FileLoader shares in-flight URLs across managers. Own the container
      // request so retiring one attempt cannot reject its immediate replacement.
      const response = await fetch(url, { signal: options.signal })
      const bytes = await readAssetBytes(url, response)
      if (options.signal.aborted) throw abortError()
      // Parser dependencies may still share FileLoader requests. Let them settle
      // without manager.abort(); only this attempt's late scene is retired below.
      scene = (
        await createGameGltfLoader(manager).parseAsync(
          bytes,
          assetResourcePath(response.url || url),
        )
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
    }
  })
}
