// Asset transport ownership — real Three parsing must survive an unrelated attempt's cancellation.
import type { Object3D } from 'three'
import { BufferGeometry, FileLoader } from 'three'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { loadProfiledAssetScene } from './asset-scene-loader'
import { releaseAssetTextureImages } from './asset-texture-profile'
import { disposeObject } from './dispose'

interface PendingRequest {
  readonly url: string
  readonly signal: AbortSignal
  readonly resolve: (response: Response) => void
  readonly reject: (error: Error) => void
}

const emptyDocument = {
  asset: { version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [] }],
}
const triangle = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])

function meshDocument(buffer = 'mesh.bin') {
  return {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ uri: buffer, byteLength: triangle.byteLength }],
    bufferViews: [{ buffer: 0, byteLength: triangle.byteLength }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
  }
}

function jsonResponse(document: unknown, status = 200) {
  return new Response(JSON.stringify(document), { status })
}

function deferredNetwork() {
  const requests: PendingRequest[] = []
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const resolved =
      typeof input === 'string' && typeof document !== 'undefined'
        ? new URL(input, document.baseURI).href
        : input
    const request = new Request(resolved, init)
    return new Promise<Response>((resolve, reject) => {
      const aborted = () => {
        queueMicrotask(() =>
          reject(new DOMException('Request cancelled.', 'AbortError')),
        )
      }
      request.signal.addEventListener('abort', aborted, { once: true })
      if (request.signal.aborted) aborted()
      requests.push({
        url: request.url,
        signal: request.signal,
        resolve,
        reject,
      })
    })
  })
  vi.stubGlobal('fetch', fetch)
  return { requests, fetch }
}

const loaded: Object3D[] = []

function settle(load: Promise<Object3D>): Promise<unknown> {
  return load.then(
    (scene) => {
      loaded.push(scene)
    },
    (error: unknown) => error,
  )
}

beforeEach(() => {
  // Node lacks browser progress events; all loader/parsing behavior stays real.
  vi.stubGlobal(
    'ProgressEvent',
    class extends Event {
      constructor(type: string, properties: ProgressEventInit) {
        super(type)
        Object.assign(this, properties)
      }
    },
  )
})

afterEach(() => {
  loaded.splice(0).forEach((scene) => {
    releaseAssetTextureImages(scene)
    disposeObject(scene)
  })
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('keeps an immediate same-URL retry independent of the retired container request', async () => {
  const network = deferredNetwork()
  const old = new AbortController()
  const oldLoad = loadProfiledAssetScene('https://assets.invalid/retry.glb', {
    signal: old.signal,
  })
  const oldResult = settle(oldLoad)
  await vi.waitFor(() => expect(network.requests).toHaveLength(1))
  old.abort()
  const nextLoad = loadProfiledAssetScene('https://assets.invalid/retry.glb', {
    signal: new AbortController().signal,
  })
  const nextResult = settle(nextLoad)
  await vi.waitFor(() => expect(network.requests).toHaveLength(2))
  expect(network.requests[0]!.signal.aborted).toBe(true)
  expect(network.requests[1]!.signal.aborted).toBe(false)
  network.requests[1]!.resolve(jsonResponse(emptyDocument))
  expect(await oldResult).toMatchObject({ name: 'AbortError' })
  expect(await nextResult).toBeUndefined()
  expect(loaded).toHaveLength(1)
})

it('does not cancel an already waiting concurrent consumer of the same container URL', async () => {
  const network = deferredNetwork()
  const first = new AbortController()
  const firstLoad = loadProfiledAssetScene(
    'https://assets.invalid/shared.glb',
    {
      signal: first.signal,
    },
  )
  const firstResult = settle(firstLoad)
  const secondLoad = loadProfiledAssetScene(
    'https://assets.invalid/shared.glb',
    {
      signal: new AbortController().signal,
    },
  )
  const secondResult = settle(secondLoad)
  await vi.waitFor(() => expect(network.requests).toHaveLength(2))
  first.abort()
  network.requests[1]!.resolve(jsonResponse(emptyDocument))
  expect(await firstResult).toMatchObject({ name: 'AbortError' })
  expect(await secondResult).toBeUndefined()
  expect(loaded).toHaveLength(1)
})

it('rejects a pre-aborted attempt without starting a container request', async () => {
  const network = deferredNetwork()
  const controller = new AbortController()
  controller.abort()
  await expect(
    loadProfiledAssetScene('https://assets.invalid/unused.glb', {
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({ name: 'AbortError' })
  expect(network.fetch).not.toHaveBeenCalled()
})

it('rejects an unavailable container before parsing an otherwise valid document', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse(emptyDocument, 404)),
  )
  await expect(
    loadProfiledAssetScene('https://assets.invalid/missing.glb', {
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow(
    'Asset request failed (404): https://assets.invalid/missing.glb',
  )
})

it.each([true, false])(
  'accepts Capacitor status-zero media only with readable bytes (%s)',
  async (hasBytes) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 0,
        url: 'capacitor://localhost/games/model.glb',
        arrayBuffer: async () =>
          hasBytes
            ? new TextEncoder().encode(JSON.stringify(emptyDocument)).buffer
            : new ArrayBuffer(0),
      })),
    )
    const result = loadProfiledAssetScene(
      'capacitor://localhost/games/model.glb',
      {
        signal: new AbortController().signal,
      },
    )
    if (hasBytes) loaded.push(await result)
    else await expect(result).rejects.toThrow('Asset was empty:')
  },
)

it('resolves relative dependencies against the container directory and preserves a live dependency consumer', async () => {
  const network = deferredNetwork()
  const dependencyLoads = vi.spyOn(FileLoader.prototype, 'load')
  const old = new AbortController()
  const url = 'https://assets.invalid/course/model.gltf?version=/reviewed'
  const oldLoad = loadProfiledAssetScene(url, { signal: old.signal })
  const oldResult = settle(oldLoad)
  await vi.waitFor(() => expect(network.requests).toHaveLength(1))
  network.requests[0]!.resolve(jsonResponse(meshDocument('../shared/mesh.bin')))
  await vi.waitFor(() => expect(network.requests).toHaveLength(2))
  const dependency = network.requests[1]!
  expect(dependency.url).toBe('https://assets.invalid/shared/mesh.bin')
  const nextLoad = loadProfiledAssetScene(url, {
    signal: new AbortController().signal,
  })
  const nextResult = settle(nextLoad)
  await vi.waitFor(() => expect(network.requests).toHaveLength(3))
  network.requests[2]!.resolve(jsonResponse(meshDocument('../shared/mesh.bin')))
  // Wait until the second real parser has reached the existing shared request.
  await vi.waitFor(() =>
    expect(
      dependencyLoads.mock.calls.filter(
        ([url]) =>
          typeof url === 'string' && new URL(url).href === dependency.url,
      ),
    ).toHaveLength(2),
  )
  old.abort()
  expect(dependency.signal.aborted).toBe(false)
  dependency.resolve(new Response(triangle))
  expect(await oldResult).toMatchObject({ name: 'AbortError' })
  expect(await nextResult).toBeUndefined()
  expect(loaded[0]!.children).toHaveLength(1)
  expect(network.fetch).toHaveBeenCalledTimes(3)
})

it('resolves relative Capacitor containers and their external resources from the app origin', async () => {
  vi.stubGlobal('document', { baseURI: 'capacitor://localhost/index.html' })
  const network = deferredNetwork()
  const result = settle(
    loadProfiledAssetScene('/games/course/model.gltf', {
      signal: new AbortController().signal,
    }),
  )
  await vi.waitFor(() => expect(network.requests).toHaveLength(1))
  expect(network.requests[0]!.url).toBe(
    'capacitor://localhost/games/course/model.gltf',
  )
  network.requests[0]!.resolve(jsonResponse(meshDocument('../shared/mesh.bin')))
  await vi.waitFor(() => expect(network.requests).toHaveLength(2))
  expect(network.requests[1]!.url).toBe(
    'capacitor://localhost/games/shared/mesh.bin',
  )
  network.requests[1]!.resolve(new Response(triangle))
  expect(await result).toBeUndefined()
  expect(loaded[0]!.children).toHaveLength(1)
})

it('keeps redirected container dependencies relative to the final response location', async () => {
  const network = deferredNetwork()
  const result = settle(
    loadProfiledAssetScene('https://assets.invalid/redirect.gltf', {
      signal: new AbortController().signal,
    }),
  )
  await vi.waitFor(() => expect(network.requests).toHaveLength(1))
  const response = jsonResponse(meshDocument())
  Object.defineProperty(response, 'url', {
    value: 'https://cdn.invalid/final/model.gltf',
  })
  network.requests[0]!.resolve(response)
  await vi.waitFor(() => expect(network.requests).toHaveLength(2))
  expect(network.requests[1]!.url).toBe('https://cdn.invalid/final/mesh.bin')
  network.requests[1]!.resolve(new Response(triangle))
  expect(await result).toBeUndefined()
})

it('retains cross-attempt admission until aborted real parses and their cleanup settle', async () => {
  const network = deferredNetwork()
  const dispose = vi.spyOn(BufferGeometry.prototype, 'dispose')
  const dependencies = vi.spyOn(FileLoader.prototype, 'load')
  const first = new AbortController()
  const second = new AbortController()
  const old = [first, second].map((controller, index) =>
    settle(
      loadProfiledAssetScene(`https://assets.invalid/old-${index}.gltf`, {
        signal: controller.signal,
      }),
    ),
  )
  await vi.waitFor(() => expect(network.requests).toHaveLength(2))
  network.requests
    .slice()
    .forEach((request) =>
      request.resolve(jsonResponse(meshDocument('held.bin'))),
    )
  await vi.waitFor(() => expect(dependencies.mock.calls).toHaveLength(2))
  expect(network.requests).toHaveLength(3)
  first.abort()
  second.abort()
  const retry = [0, 1].map((index) =>
    settle(
      loadProfiledAssetScene(`https://assets.invalid/retry-${index}.gltf`, {
        signal: new AbortController().signal,
      }),
    ),
  )
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(network.requests).toHaveLength(3)
  network.requests[2]!.resolve(new Response(triangle))
  expect(await Promise.all(old)).toEqual([
    expect.objectContaining({ name: 'AbortError' }),
    expect.objectContaining({ name: 'AbortError' }),
  ])
  await vi.waitFor(() => expect(network.requests).toHaveLength(5))
  expect(dispose).toHaveBeenCalledTimes(2)
  expect(dispose.mock.invocationCallOrder[0]!).toBeLessThan(
    network.fetch.mock.invocationCallOrder[3]!,
  )
  expect(dispose.mock.invocationCallOrder[1]!).toBeLessThan(
    network.fetch.mock.invocationCallOrder[4]!,
  )
  network.requests
    .slice(3)
    .forEach((request) => request.resolve(jsonResponse(emptyDocument)))
  expect(await Promise.all(retry)).toEqual([undefined, undefined])
})

function texturedDocument(images: string[]) {
  return {
    ...meshDocument(
      `data:application/octet-stream;base64,${Buffer.from(triangle.buffer).toString('base64')}`,
    ),
    scenes: [{ nodes: images.map((_, index) => index) }],
    nodes: images.map((_, mesh) => ({ mesh })),
    meshes: images.map((_, material) => ({
      primitives: [{ attributes: { POSITION: 0 }, material }],
    })),
    materials: images.map((_, index) => ({
      pbrMetallicRoughness: { baseColorTexture: { index } },
    })),
    textures: images.map((_, source) => ({ source })),
    images: images.map((uri) => ({ uri })),
  }
}

it('profiles a real parsed mobile texture before registering its surviving decoded image', async () => {
  const network = deferredNetwork()
  vi.stubGlobal('self', globalThis)
  const original = { width: 2048, height: 1024, close: vi.fn() }
  const replacement = { width: 1024, height: 512, close: vi.fn() }
  const decode = vi.fn(async (source: unknown) =>
    source === original ? replacement : original,
  )
  vi.stubGlobal('createImageBitmap', decode)
  const onDecodedImage = vi.fn()
  const result = settle(
    loadProfiledAssetScene('https://assets.invalid/mobile.gltf', {
      signal: new AbortController().signal,
      assetProfile: 'mobile',
      onDecodedImage,
    }),
  )
  await vi.waitFor(() => expect(network.requests).toHaveLength(1))
  network.requests[0]!.resolve(jsonResponse(texturedDocument(['mobile.png'])))
  await vi.waitFor(() => expect(network.requests).toHaveLength(3))
  network.requests
    .find((request) => request.url.startsWith('data:'))!
    .resolve(new Response(triangle))
  network.requests
    .find((request) => request.url.endsWith('mobile.png'))!
    .resolve(new Response('image'))
  expect(await result).toBeUndefined()
  expect(decode).toHaveBeenCalledTimes(2)
  expect(decode).toHaveBeenLastCalledWith(
    original,
    expect.objectContaining({
      resizeWidth: 1024,
      resizeHeight: 512,
      imageOrientation: 'none',
    }),
  )
  expect(original.close).toHaveBeenCalledOnce()
  expect(replacement.close).not.toHaveBeenCalled()
  expect(onDecodedImage).toHaveBeenCalledExactlyOnceWith(replacement)
})

it('rejects a missing parser image dependency and releases images from the unpublished scene', async () => {
  const network = deferredNetwork()
  vi.stubGlobal('self', globalThis)
  const bitmap = { width: 2, height: 2, close: vi.fn() }
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => bitmap),
  )
  const onDecodedImage = vi.fn()
  const result = settle(
    loadProfiledAssetScene('https://assets.invalid/textured.gltf', {
      signal: new AbortController().signal,
      onDecodedImage,
    }),
  )
  await vi.waitFor(() => expect(network.requests).toHaveLength(1))
  network.requests[0]!.resolve(
    jsonResponse(texturedDocument(['good.png', 'missing.png'])),
  )
  await vi.waitFor(() => expect(network.requests).toHaveLength(4))
  network.requests
    .find((request) => request.url.startsWith('data:'))!
    .resolve(new Response(triangle))
  network.requests
    .find((request) => request.url.endsWith('good.png'))!
    .resolve(new Response('image'))
  network.requests
    .find((request) => request.url.endsWith('missing.png'))!
    .reject(new Error('Image unavailable'))
  expect(await result).toMatchObject({
    message:
      'Asset has unavailable dependencies: https://assets.invalid/missing.png',
  })
  expect(onDecodedImage).not.toHaveBeenCalled()
  expect(bitmap.close).toHaveBeenCalledOnce()
})

it('closes late decoded images and geometry without publishing a cancelled parser result', async () => {
  const network = deferredNetwork()
  vi.stubGlobal('self', globalThis)
  const controller = new AbortController()
  const bitmap = { width: 2, height: 2, close: vi.fn() }
  let finishDecode: ((image: unknown) => void) | undefined
  const decode = vi.fn(
    () =>
      new Promise((resolve) => {
        finishDecode = resolve
      }),
  )
  vi.stubGlobal('createImageBitmap', decode)
  const onDecodedImage = vi.fn()
  const dispose = vi.spyOn(BufferGeometry.prototype, 'dispose')
  const result = settle(
    loadProfiledAssetScene('https://assets.invalid/late.gltf', {
      signal: controller.signal,
      onDecodedImage,
    }),
  )
  await vi.waitFor(() => expect(network.requests).toHaveLength(1))
  network.requests[0]!.resolve(jsonResponse(texturedDocument(['late.png'])))
  await vi.waitFor(() => expect(network.requests).toHaveLength(3))
  network.requests
    .find((request) => request.url.startsWith('data:'))!
    .resolve(new Response(triangle))
  network.requests
    .find((request) => request.url.endsWith('late.png'))!
    .resolve(new Response('image'))
  await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce())
  controller.abort()
  expect(bitmap.close).not.toHaveBeenCalled()
  finishDecode?.(bitmap)
  expect(await result).toMatchObject({ name: 'AbortError' })
  expect(onDecodedImage).not.toHaveBeenCalled()
  expect(bitmap.close).toHaveBeenCalledOnce()
  expect(dispose).toHaveBeenCalledOnce()
})
