// ============================================================
// The upload's progress reaches the processAudio call (plan S8 §6.4)
// ============================================================
//
// The native room shows "Sending · 45%" while a song goes up. The pipeline
// is the web's own, so the progress is an option it passes through, and a
// caller that does not ask for it gets the fetch the web has always used.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/uvr-api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  processAudio: vi.fn(),
  pollForCompletion: vi.fn(),
  deleteSession: vi.fn(),
}))
vi.mock('@/lib/audio-duration', () => ({
  audioDurationSecs: async () => Promise.resolve(200),
}))
vi.mock('@/db/persistent-storage', () => ({
  ensurePersistentStorage: async () => Promise.resolve(true),
}))
vi.mock('@/stores/uvr-store', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  setUvrSessionApiIdDurable: vi.fn(async () => Promise.resolve(true)),
}))

import { pollForCompletion, processAudio } from '@/lib/uvr-api'
import { runUvrPipeline } from '@/lib/uvr-processing-pipeline'

const processed = vi.mocked(processAudio)

beforeEach(() => {
  processed.mockReset()
  processed.mockResolvedValue({
    session_id: 'rp_gpu_job-4',
    status: 'processing',
    message: 'Processing started',
    model: 'roformer',
    output_format: 'WAV',
  })
  vi.mocked(pollForCompletion).mockResolvedValue(undefined)
})

const callbacks = () => ({
  onProgress: vi.fn(),
  onComplete: vi.fn(),
  onError: vi.fn(),
})

describe('a server separation', () => {
  it('hands the upload progress to the request', async () => {
    const onUploadProgress = vi.fn()

    await runUvrPipeline(
      new File([new Uint8Array([1])], 'song.m4a'),
      'session-1',
      'server',
      callbacks(),
      { onUploadProgress },
    )

    expect(processed).toHaveBeenCalledTimes(1)
    expect(processed.mock.calls[0]?.[3]).toBe(onUploadProgress)
  })

  it('asks for none when the caller does not', async () => {
    await runUvrPipeline(
      new File([new Uint8Array([1])], 'song.mp3'),
      'session-2',
      'server',
      callbacks(),
    )

    expect(processed.mock.calls[0]?.[3]).toBeUndefined()
  })
})
