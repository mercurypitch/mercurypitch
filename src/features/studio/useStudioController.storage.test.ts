// Studio controller storage — the first import on a device asks how its audio is kept, a remembered answer is never asked again, and the first kept take asks the browser to keep the songs.
import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PrepareStudioAssetOptions, StudioAssetInfo, } from '@/lib/studio/audio/prepare-studio-asset'
import type { StudioAssetData } from '@/lib/studio/model/types'
import { controllerServiceFixture, preparedFixture, } from './controller/controller.fixture'
import type { StudioPersistenceDependencies } from './storage/studio-persistence'
import type { StudioStorageAnswer } from './storage/studio-storage-ask'
import type { StudioControllerOptions } from './useStudioController'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  localStorage.clear()
})

/** A page load: the visit's storage answer starts empty; this device's storage stays. */
async function visit(options: StudioControllerOptions = {}) {
  vi.resetModules()
  const { useStudioController } = await import('./useStudioController')
  const { createStudioPersistence } =
    await import('./storage/studio-persistence')
  const browser: StudioPersistenceDependencies = {
    ensure: vi.fn(async () => true),
    persisted: vi.fn(async () => false),
  }
  // Each take is kept with the format it was asked for, as prepareStudioAsset keeps it.
  const formats: (string | undefined)[] = []
  const prepareFile = vi.fn(
    async (
      _blob: Blob,
      info: StudioAssetInfo,
      prepared: PrepareStudioAssetOptions = {},
    ): Promise<StudioAssetData> => {
      formats.push(prepared.canonicalFormat)
      const data = preparedFixture(info)
      return {
        ...data,
        asset: { ...data.asset, sha256: `${formats.length}`.padEnd(64, 'a') },
      }
    },
  )
  let serial = 0
  let controller!: ReturnType<typeof useStudioController>
  createRoot((dispose) => {
    cleanups.push(dispose)
    controller = useStudioController({
      service: controllerServiceFixture(),
      createId: () => `id-${++serial}`,
      prepareFile,
      persistence: createStudioPersistence(browser),
      ...options,
    })
  })
  await controller.open('one')
  return { controller, prepareFile, formats, browser }
}

const wav = (name: string) => new File(['abc'], name, { type: 'audio/wav' })
const answer = (quality: StudioStorageAnswer['quality'], remember: boolean) =>
  vi.fn(async () => ({ quality, remember }))

describe('Studio controller storage', () => {
  it('asks on the first import, keeps the take as answered, and never asks again once remembered', async () => {
    const askStorage = answer('compact', true)
    const first = await visit({ askStorage })

    await first.controller.addFile(wav('One.wav'))
    await first.controller.addFile(wav('Two.wav'))
    const later = await visit({ askStorage })
    await later.controller.addFile(wav('Three.wav'))

    expect(askStorage).toHaveBeenCalledOnce()
    expect(first.formats).toEqual(['int16', 'int16'])
    expect(later.formats).toEqual(['int16'])
    expect(first.controller.project()?.clips).toHaveLength(2)
  })

  it('holds an answer not remembered for the visit, and asks again on the next', async () => {
    const askStorage = answer('compact', false)
    const first = await visit({ askStorage })

    await first.controller.addFile(wav('One.wav'))
    await first.controller.addFile(wav('Two.wav'))
    const later = await visit({ askStorage })
    await later.controller.addFile(wav('Three.wav'))

    expect(askStorage).toHaveBeenCalledTimes(2)
    expect([...first.formats, ...later.formats]).toEqual([
      'int16',
      'int16',
      'int16',
    ])
  })

  it('asks once for all the files of one import', async () => {
    const askStorage = answer('full', false)
    const { controller, formats } = await visit({ askStorage })

    await controller.addFiles([
      wav('One.wav'),
      wav('Two.wav'),
      wav('Three.wav'),
    ])

    expect(askStorage).toHaveBeenCalledOnce()
    expect(formats).toEqual(['float32', 'float32', 'float32'])
  })

  it('stops the import without a word when the question is cancelled', async () => {
    const askStorage = vi.fn(async () => null)
    const { controller, prepareFile, browser } = await visit({ askStorage })

    const added = await controller.addFile(wav('One.wav'))

    expect(added).toBe(false)
    expect(prepareFile).not.toHaveBeenCalled()
    expect(controller.problem()).toBeNull()
    expect(controller.importing()).toBe(false)
    expect(controller.project()?.clips).toHaveLength(0)
    expect(browser.ensure).not.toHaveBeenCalled()
  })

  it('keeps a take recorded here as the setting stands, never holding it on the question', async () => {
    const askStorage = answer('compact', true)
    const { controller, formats } = await visit({ askStorage })

    const kept = await controller.addRecording({
      wav: new Blob(['take'], { type: 'audio/wav' }),
      title: 'Take 1',
      startFrame: 0,
      sourceInFrame: 0,
      trackId: null,
    })

    expect(kept).toBe(true)
    expect(askStorage).not.toHaveBeenCalled()
    expect(formats).toEqual(['float32'])
  })

  it('asks the browser to keep the songs after the first kept take only, and reads its answer back', async () => {
    const { controller, browser } = await visit({
      askStorage: answer('full', true),
    })
    vi.mocked(browser.persisted).mockResolvedValue(true)
    expect(browser.ensure).not.toHaveBeenCalled()

    await controller.addFile(wav('One.wav'))
    await controller.addFile(wav('Two.wav'))

    expect(browser.ensure).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(controller.protection()).toBe('protected'))
  })
})
