// ============================================================
// The app asks the browser for nothing after a separation
// ============================================================
//
// On the web a finished separation asks the browser to keep its storage,
// and says why first: "Stems saved! ... allow persistent storage when
// prompted." In the app there is no browser and no prompt comes, and the
// line stayed twelve seconds over the room's library and paywall (review
// V2). So the app's pipeline does not ask, and the announcement is the
// web's alone.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const persistence = vi.hoisted(() => ({
  ensure: vi.fn(async () => Promise.resolve(true)),
}))

async function separate(native: boolean): Promise<void> {
  vi.resetModules()
  vi.doMock('@/lib/native-build', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    IS_NATIVE_BUILD: native,
  }))
  vi.doMock('@/lib/uvr-api', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    processAudio: vi.fn(async () =>
      Promise.resolve({
        session_id: 'rp_gpu_job-1',
        status: 'processing',
        message: 'Processing started',
        model: 'roformer',
        output_format: 'M4A',
      }),
    ),
    pollForCompletion: vi.fn(async () => Promise.resolve(undefined)),
    deleteSession: vi.fn(),
  }))
  vi.doMock('@/lib/audio-duration', () => ({
    audioDurationSecs: async () => Promise.resolve(200),
  }))
  vi.doMock('@/db/persistent-storage', () => ({
    ensurePersistentStorage: persistence.ensure,
  }))
  vi.doMock('@/stores/uvr-store', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    setUvrSessionApiIdDurable: vi.fn(async () => Promise.resolve(true)),
  }))
  const { runUvrPipeline } = await import('@/lib/uvr-processing-pipeline')
  const onError = vi.fn()
  await runUvrPipeline(
    new File([new Uint8Array([1])], 'Harbour Lights.m4a'),
    'session-1',
    'server',
    { onProgress: vi.fn(), onComplete: vi.fn(), onError },
  )
  expect(onError).not.toHaveBeenCalled()
}

beforeEach(() => {
  persistence.ensure.mockClear()
})

describe('a finished separation', () => {
  it('asks the browser to keep its storage on the web', async () => {
    await separate(false)

    expect(persistence.ensure).toHaveBeenCalledTimes(1)
  })

  it('asks nothing in the app, where no browser prompt exists', async () => {
    await separate(true)

    expect(persistence.ensure).not.toHaveBeenCalled()
  })
})
