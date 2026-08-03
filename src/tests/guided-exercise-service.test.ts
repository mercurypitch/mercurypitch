import { afterEach, describe, expect, it, vi } from 'vitest'
import { ZEN_EXERCISES } from '@/features/zen/exercise-catalog'

const API = 'https://guided-api.test'

async function loadService() {
  vi.stubEnv('VITE_API_BASE_URL', API)
  vi.resetModules()
  return import('@/features/zen/guided-exercise-service')
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('guided exercise service', () => {
  it('accepts only a fully valid published catalogue', async () => {
    const exercise = {
      ...ZEN_EXERCISES[0],
      exampleAudio: {
        src: '/api/guided-media/example-id',
        durationMs: 2_000,
        locale: 'en-GB' as const,
        source: 'coach' as const,
        transcript: 'Ah',
      },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ exercises: [exercise] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const service = await loadService()

    await expect(service.listPublishedGuidedExercises()).resolves.toEqual([
      exercise,
    ])
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API}/api/guided-exercises`,
      undefined,
    )
  })

  it('returns null instead of replacing seeds with malformed cloud content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ exercises: [{ id: 'broken' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const service = await loadService()

    await expect(service.listPublishedGuidedExercises()).resolves.toBeNull()
  })

  it('loads an exact pinned version', async () => {
    const exercise = ZEN_EXERCISES[0]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ exercise }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const service = await loadService()

    await expect(
      service.getPublishedGuidedExercise(exercise.id, exercise.version),
    ).resolves.toEqual(exercise)
    expect(fetchMock).toHaveBeenCalledWith(
      `${API}/api/guided-exercises/${exercise.id}/versions/${exercise.version}`,
      undefined,
    )
  })

  it('surfaces optimistic draft conflicts as an ApiResult', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'Draft changed in another editor',
          issues: [{ path: 'title', message: 'Reload before saving.' }],
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )
    const service = await loadService()

    await expect(
      service.saveGuidedExerciseDraft(
        ZEN_EXERCISES[0].id,
        ZEN_EXERCISES[0],
        1,
        'admin-key',
      ),
    ).resolves.toEqual({
      ok: false,
      error: 'Draft changed in another editor',
      status: 409,
      issues: [{ path: 'title', message: 'Reload before saving.' }],
    })
  })

  it('rejects oversized playback before reserving cloud storage', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const service = await loadService()
    const file = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.mp3', {
      type: 'audio/mpeg',
    })

    await expect(
      service.uploadGuidedExerciseMedia(
        file,
        {
          durationMs: 5_000,
          source: 'coach',
          transcript: 'Nay',
        },
        'admin-key',
      ),
    ).resolves.toEqual({
      ok: false,
      error: 'Playback exceeds the 2 MiB upload limit',
      status: 413,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uploads an Opus browser recording with its playable content type', async () => {
    const media = {
      id: 'media-recorded',
      status: 'ready' as const,
      locale: 'en-GB' as const,
      source: 'coach' as const,
      transcript: 'NG',
      durationMs: 4_800,
      mimeType: 'audio/webm',
      byteLength: 14,
      createdAt: '2026-08-03T10:00:00.000Z',
      updatedAt: '2026-08-03T10:00:01.000Z',
      readyAt: '2026-08-03T10:00:01.000Z',
      url: '/api/guided-media/media-recorded',
    }
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            media: { ...media, status: 'uploading', url: null },
            uploadUrl: '/api/admin/guided-media/media-recorded/content',
            maxByteLength: 2 * 1024 * 1024,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ media }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    const service = await loadService()
    const file = new File(['recorded voice'], 'zen-example.webm', {
      type: 'audio/webm;codecs=opus',
    })

    await expect(
      service.uploadGuidedExerciseMedia(
        file,
        {
          durationMs: 4_800,
          source: 'coach',
          transcript: 'NG',
        },
        'admin-key',
      ),
    ).resolves.toEqual({ ok: true, data: media })
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${API}/api/admin/guided-media/media-recorded/content`,
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'audio/webm;codecs=opus',
          'X-Admin-Key': 'admin-key',
        }),
        body: file,
      }),
    )
  })
})
