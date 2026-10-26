// ============================================================
// A server separation completes only with both stems on this device
// ============================================================
//
// The pipeline collected the job's stems and called the session completed as
// soon as one of them was saved. A song with one stem on the phone was then a
// ready song that could not play, and the import queue never offered the free
// collect-again it has for a song that failed to save. The real pipeline and
// stem store run over an in-memory db; only the server is faked.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OutputFile } from '@/lib/uvr-api'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'

const adapter = new InMemoryAdapter()
const server = vi.hoisted(() => ({
  files: [] as OutputFile[],
  broken: new Set<string>(),
}))

vi.mock('@/db', () => ({ getDb: async () => adapter }))
vi.mock('@/db/persistent-storage', () => ({
  ensurePersistentStorage: async () => Promise.resolve(true),
}))
vi.mock('@/lib/uvr-api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  pollForCompletion: async (
    _id: string,
    _onProgress: unknown,
    onComplete: (files: OutputFile[]) => Promise<void>,
  ) => onComplete(server.files),
  getOutputFile: async (_id: string, path: string) => {
    if (server.broken.has(path)) throw new TypeError('Failed to fetch')
    return Promise.resolve(new Response(new Blob([`audio of ${path}`])))
  },
}))

const API_SESSION = 'rp_gpu_both-stems'
const stem = (name: 'vocal' | 'instrumental'): OutputFile => ({
  stem: name,
  filename: `song_${name}.mp3`,
  path: `/out/${name}.mp3`,
  duration: 201,
  size: 1024,
})

beforeEach(async () => {
  vi.resetModules()
  await adapter.destroy()
  localStorage.clear()
  server.files = [stem('vocal'), stem('instrumental')]
  server.broken.clear()
})

async function collect() {
  const store = await import('@/stores/uvr-store')
  const pipeline = await import('@/lib/uvr-processing-pipeline')
  const sessionId = store.startUvrSession(
    'song.mp3',
    5,
    'audio/mpeg',
    'separate',
    'server',
  )
  const callbacks = {
    onProgress: vi.fn(),
    onComplete: vi.fn(async () => Promise.resolve()),
    onError: vi.fn(),
  }
  await pipeline.resumeServerSession(sessionId, API_SESSION, callbacks)
  return callbacks
}

describe('collecting a separated song', () => {
  it('completes with both stems saved', async () => {
    const callbacks = await collect()

    expect(callbacks.onError).not.toHaveBeenCalled()
    expect(callbacks.onComplete).toHaveBeenCalledTimes(1)
  })

  it('fails to save when one stem did not download', async () => {
    server.broken.add('/out/instrumental.mp3')

    const callbacks = await collect()

    expect(callbacks.onComplete).not.toHaveBeenCalled()
    expect(callbacks.onError).toHaveBeenCalledWith(
      'Could not save the separated stems locally. Please try again.',
    )
  })

  it('fails to save when the server sent one stem', async () => {
    server.files = [stem('vocal')]

    const callbacks = await collect()

    expect(callbacks.onComplete).not.toHaveBeenCalled()
    expect(callbacks.onError).toHaveBeenCalledTimes(1)
  })
})
