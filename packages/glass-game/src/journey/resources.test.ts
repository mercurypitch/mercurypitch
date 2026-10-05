// Journey resource tests — retired parses dispose and hidden time cannot leak.

import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { acceptJourneyResource, createJourneyFrameLoop, loadJourneyGltf, MAXIMUM_JOURNEY_FRAME_SECONDS, } from './resources'

describe('journey glTF loading', () => {
  it('closes each owned decoded image once after its document is retired', async () => {
    const bitmap = { width: 512, height: 512, close: vi.fn() }
    const texture = new Texture(bitmap as unknown as ImageBitmap)
    const sharedImageTexture = new Texture(bitmap as unknown as ImageBitmap)
    const textureDispose = vi.spyOn(texture, 'dispose')
    const sharedTextureDispose = vi.spyOn(sharedImageTexture, 'dispose')
    const geometry = new BoxGeometry()
    const scene = new Group()
    scene.add(
      new Mesh(geometry, new MeshBasicMaterial({ map: texture })),
      new Mesh(geometry, new MeshBasicMaterial({ map: sharedImageTexture })),
    )
    const document = await loadJourneyGltf(
      '/map.glb',
      new AbortController().signal,
      {
        fetch: vi.fn().mockResolvedValue(new Response(new Uint8Array(64))),
        parse: vi.fn().mockResolvedValue({ scene, animations: [] }),
      },
    )

    expect(bitmap.close).not.toHaveBeenCalled()
    document.dispose()
    document.dispose()

    expect(textureDispose).toHaveBeenCalledOnce()
    expect(sharedTextureDispose).toHaveBeenCalledOnce()
    expect(bitmap.close).toHaveBeenCalledOnce()
    expect(bitmap.close.mock.invocationCallOrder[0]).toBeGreaterThan(
      sharedTextureDispose.mock.invocationCallOrder[0]!,
    )
  })

  it('loads an ordinary glTF document through the real parser and default fetch', async () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        asset: { version: '2.0' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: 'museum-root' }],
      }),
    )
    const fetchAsset = vi.fn().mockResolvedValue(new Response(bytes))
    vi.stubGlobal('fetch', fetchAsset)
    try {
      const controller = new AbortController()
      const document = await loadJourneyGltf('/map.gltf', controller.signal)
      expect(fetchAsset).toHaveBeenCalledExactlyOnceWith('/map.gltf', {
        signal: controller.signal,
      })
      expect(document.scene.getObjectByName('museum-root')).toBeDefined()
      document.dispose()
      document.dispose()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rejects a real HTTP failure without reading or parsing an error page', async () => {
    const arrayBuffer = vi.fn()
    const parse = vi.fn()
    await expect(
      loadJourneyGltf('/missing.glb', new AbortController().signal, {
        fetch: vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          arrayBuffer,
        }) as unknown as typeof fetch,
        parse,
      }),
    ).rejects.toThrow('Journey asset unavailable: /missing.glb')
    expect(arrayBuffer).not.toHaveBeenCalled()
    expect(parse).not.toHaveBeenCalled()
  })

  it.each([true, false])(
    'cancels before parsing after navigation, with DOMException available: %s',
    async (hasDOMException) => {
      if (!hasDOMException) vi.stubGlobal('DOMException', undefined)
      try {
        const controller = new AbortController()
        const parse = vi.fn()
        await expect(
          loadJourneyGltf('/map.glb', controller.signal, {
            fetch: vi.fn().mockResolvedValue({
              ok: true,
              arrayBuffer: async () => {
                controller.abort()
                return new ArrayBuffer(8)
              },
            }) as unknown as typeof fetch,
            parse,
          }),
        ).rejects.toMatchObject({ name: 'AbortError' })
        expect(parse).not.toHaveBeenCalled()
      } finally {
        vi.unstubAllGlobals()
      }
    },
  )

  it('accepts a non-empty status-0 body from the native bundled asset handler', async () => {
    const scene = new Group()
    const bytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46]).buffer
    const parse = vi.fn().mockResolvedValue({ scene, animations: [] })

    const document = await loadJourneyGltf(
      '/games/journey-map-v1/map.glb',
      new AbortController().signal,
      {
        fetch: vi.fn().mockResolvedValue({
          ok: false,
          status: 0,
          arrayBuffer: () => Promise.resolve(bytes),
        }) as unknown as typeof fetch,
        parse,
      },
    )

    expect(parse).toHaveBeenCalledExactlyOnceWith(
      bytes,
      '/games/journey-map-v1/',
    )
    document.dispose()
  })

  it('rejects an empty status-0 body before parsing', async () => {
    const parse = vi.fn()

    await expect(
      loadJourneyGltf(
        '/games/journey-map-v1/map.glb',
        new AbortController().signal,
        {
          fetch: vi.fn().mockResolvedValue({
            ok: false,
            status: 0,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
          }) as unknown as typeof fetch,
          parse,
        },
      ),
    ).rejects.toThrow(
      'Journey asset unavailable: /games/journey-map-v1/map.glb',
    )
    expect(parse).not.toHaveBeenCalled()
  })

  it('reports an unresolved Git LFS asset before asking Three to parse it', async () => {
    const parse = vi.fn()
    const pointer = new TextEncoder().encode(
      'version https://git-lfs.github.com/spec/v1\n' +
        'oid sha256:17294f9ccec6aa5fb18c9a3a3c31ce501750fd4375d0a2abbfdcdb33c7a00709\n' +
        'size 6831200\n',
    )

    await expect(
      loadJourneyGltf(
        '/games/journey-map-v1/map.glb',
        new AbortController().signal,
        {
          fetch: vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(pointer.buffer),
          }) as unknown as typeof fetch,
          parse,
        },
      ),
    ).rejects.toThrow(
      'Journey asset is an unresolved Git LFS pointer: /games/journey-map-v1/map.glb. Hydrate the runtime game assets with Git LFS, then reload the museum.',
    )
    expect(parse).not.toHaveBeenCalled()
  })

  it('keeps the asset URL and parser cause when glTF parsing fails', async () => {
    const parseFailure = new SyntaxError('Unexpected token v')
    let received: unknown
    try {
      await loadJourneyGltf(
        '/games/journey-map-v1/map.glb',
        new AbortController().signal,
        {
          fetch: vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
          }) as unknown as typeof fetch,
          parse: vi.fn().mockRejectedValue(parseFailure),
        },
      )
    } catch (error) {
      received = error
    }

    expect(received).toBeInstanceOf(Error)
    expect((received as Error).message).toBe(
      'Journey asset could not be parsed: /games/journey-map-v1/map.glb. Unexpected token v',
    )
    expect((received as Error).cause).toBe(parseFailure)
  })

  it('keeps cancellation semantics when parsing rejects after an abort', async () => {
    let rejectParse: ((reason?: unknown) => void) | undefined
    const controller = new AbortController()
    const pending = loadJourneyGltf('/map.glb', controller.signal, {
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      }) as unknown as typeof fetch,
      parse: () =>
        new Promise((_, reject) => {
          rejectParse = reject
        }),
    })

    await vi.waitFor(() => expect(rejectParse).toBeTypeOf('function'))
    controller.abort()
    rejectParse?.(new Error('Parser stopped'))

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('preserves context when a decoder rejects with a non-Error cause', async () => {
    const cause = { code: 'decoder-unavailable' }
    await expect(
      loadJourneyGltf('/map.glb', new AbortController().signal, {
        fetch: vi.fn().mockResolvedValue(new Response(new Uint8Array(64))),
        parse: vi.fn().mockRejectedValue(cause),
      }),
    ).rejects.toMatchObject({
      message: 'Journey asset could not be parsed: /map.glb.',
      cause,
    })
  })

  it('disposes a parse that finishes after cancellation', async () => {
    let finishParse:
      | ((value: { scene: Group; animations: [] }) => void)
      | undefined
    const geometry = new BoxGeometry()
    const bitmap = { width: 512, height: 512, close: vi.fn() }
    const texture = new Texture(bitmap as unknown as ImageBitmap)
    const material = new MeshBasicMaterial({ map: texture })
    const disposeGeometry = vi.spyOn(geometry, 'dispose')
    const disposeMaterial = vi.spyOn(material, 'dispose')
    const scene = new Group()
    scene.add(new Mesh(geometry, material))
    const controller = new AbortController()
    const pending = loadJourneyGltf('/map.glb', controller.signal, {
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      }) as unknown as typeof fetch,
      parse: () =>
        new Promise((resolve) => {
          finishParse = resolve
        }),
    })
    await vi.waitFor(() => expect(finishParse).toBeTypeOf('function'))
    controller.abort()
    finishParse?.({ scene, animations: [] })
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(disposeGeometry).toHaveBeenCalledOnce()
    expect(disposeMaterial).toHaveBeenCalledOnce()
    expect(bitmap.close).toHaveBeenCalledOnce()
  })
})

describe('journey frame loop', () => {
  it('ignores an already queued hidden frame and stops when disposed inside its browser callback', () => {
    const callbacks: FrameRequestCallback[] = []
    const cancel = vi.fn()
    const request = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    vi.stubGlobal('requestAnimationFrame', request)
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const update = vi.fn(() => loop.dispose())
    const loop = createJourneyFrameLoop(update)
    try {
      loop.setForeground(true)
      loop.setForeground(false)
      expect(cancel).toHaveBeenCalledExactlyOnceWith(1)
      callbacks[0]!(100)
      expect(update).not.toHaveBeenCalled()
      loop.setForeground(true)
      callbacks[1]!(500)
      expect(update).toHaveBeenCalledExactlyOnceWith(0, 0)
      loop.setForeground(true)
      loop.dispose()
      callbacks[1]!(600)
      expect(request).toHaveBeenCalledTimes(2)
      expect(update).toHaveBeenCalledOnce()
    } finally {
      loop.dispose()
      vi.unstubAllGlobals()
    }
  })

  it('owns one frame and excludes hidden time after resume', () => {
    let nextId = 0
    const callbacks = new Map<number, FrameRequestCallback>()
    const cancel = vi.fn((id: number) => callbacks.delete(id))
    const scheduler = {
      request(callback: FrameRequestCallback) {
        const id = ++nextId
        callbacks.set(id, callback)
        return id
      },
      cancel,
    }
    const updates = vi.fn()
    const loop = createJourneyFrameLoop(updates, scheduler)
    const run = (time: number) => {
      const [id, callback] = [...callbacks][0]!
      callbacks.delete(id)
      callback(time)
    }

    loop.setForeground(true)
    loop.setForeground(true)
    expect(callbacks.size).toBe(1)
    run(100)
    run(120)
    expect(updates).toHaveBeenLastCalledWith(0.02, 0.02)
    run(620)
    expect(updates).toHaveBeenLastCalledWith(
      0.02 + MAXIMUM_JOURNEY_FRAME_SECONDS,
      MAXIMUM_JOURNEY_FRAME_SECONDS,
    )
    run(600)
    expect(updates).toHaveBeenLastCalledWith(
      0.02 + MAXIMUM_JOURNEY_FRAME_SECONDS,
      0,
    )
    run(Number.NaN)
    expect(updates).toHaveBeenLastCalledWith(
      0.02 + MAXIMUM_JOURNEY_FRAME_SECONDS,
      0,
    )
    run(900)
    expect(updates).toHaveBeenLastCalledWith(
      0.02 + MAXIMUM_JOURNEY_FRAME_SECONDS,
      0,
    )
    loop.setForeground(false)
    expect(callbacks.size).toBe(0)
    loop.setForeground(true)
    run(10_000)
    expect(updates).toHaveBeenLastCalledWith(
      0.02 + MAXIMUM_JOURNEY_FRAME_SECONDS,
      0,
    )
    expect(loop.visibleSeconds()).toBeCloseTo(
      0.02 + MAXIMUM_JOURNEY_FRAME_SECONDS,
    )
    loop.dispose()
    expect(callbacks.size).toBe(0)
    expect(cancel).toHaveBeenCalled()
  })
})

describe('journey late resource acceptance', () => {
  it('installs into a live museum and retires a resource arriving after normal exit', async () => {
    const resource = { dispose: vi.fn() }
    const install = vi.fn()
    await acceptJourneyResource(
      Promise.resolve(resource),
      () => 'active',
      install,
    )
    expect(install).toHaveBeenCalledExactlyOnceWith(resource)
    expect(resource.dispose).not.toHaveBeenCalled()

    const retired = { dispose: vi.fn() }
    await acceptJourneyResource(
      Promise.resolve(retired),
      () => 'disposed',
      install,
    )
    expect(retired.dispose).toHaveBeenCalledOnce()
    expect(install).toHaveBeenCalledOnce()
  })

  it('keeps a context-loss failure after deferred models finish', async () => {
    let resolve!: (value: { dispose(): void }) => void
    const dispose = vi.fn()
    const pending = new Promise<{ dispose(): void }>((done) => {
      resolve = done
    })
    let state: 'active' | 'failed' = 'active'
    const installed = vi.fn()
    const accepted = acceptJourneyResource(pending, () => state, installed)

    state = 'failed'
    resolve({ dispose })

    await expect(accepted).rejects.toThrow('lost its graphics context')
    expect(dispose).toHaveBeenCalledOnce()
    expect(installed).not.toHaveBeenCalled()
  })
})
