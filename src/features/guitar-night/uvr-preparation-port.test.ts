// ============================================================
// Guitar Night UVR preparation-port tests protect local-only work and paid-job recovery
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const dependencies = vi.hoisted(() => ({
  prepareUvrSong: vi.fn(),
  autoResumeServerSessions: vi.fn(),
  refreshUvrSessionFromDb: vi.fn(),
}))

vi.mock('@/lib/uvr-song-preparation', () => ({
  prepareUvrSong: dependencies.prepareUvrSong,
}))
vi.mock('@/lib/uvr-auto-resume', () => ({
  autoResumeServerSessions: dependencies.autoResumeServerSessions,
}))
vi.mock('@/stores/uvr-store', () => ({
  refreshUvrSessionFromDb: dependencies.refreshUvrSessionFromDb,
}))

import { createUvrGuitarNightPreparationPort } from './uvr-preparation-port'

function sourceFile(): File {
  return new File(['audio'], 'room.wav', { type: 'audio/wav' })
}

describe('createUvrGuitarNightPreparationPort', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dependencies.autoResumeServerSessions.mockResolvedValue(undefined)
    dependencies.refreshUvrSessionFromDb.mockResolvedValue(true)
  })

  it('always prepares new Guitar Night files on this device', async () => {
    dependencies.prepareUvrSong.mockResolvedValue({
      status: 'completed',
      sessionId: 'session-room',
    })
    const signal = new AbortController().signal
    const onUpdate = vi.fn()
    const onWarning = vi.fn()

    await createUvrGuitarNightPreparationPort().prepare(sourceFile(), {
      signal,
      onUpdate,
      onWarning,
    })

    expect(dependencies.prepareUvrSong).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({
        mode: 'local',
        focus: false,
        signal,
        onUpdate,
      }),
    )
    expect(dependencies.autoResumeServerSessions).not.toHaveBeenCalled()
    expect(dependencies.refreshUvrSessionFromDb).not.toHaveBeenCalled()
  })

  it('re-attaches a matching recoverable server job instead of duplicating it', async () => {
    dependencies.prepareUvrSong.mockResolvedValue({
      status: 'in-flight',
      sessionId: 'session-paid-job',
      requiresHydration: true,
    })

    await createUvrGuitarNightPreparationPort().prepare(sourceFile(), {
      signal: new AbortController().signal,
      onUpdate: vi.fn(),
      onWarning: vi.fn(),
    })

    expect(dependencies.refreshUvrSessionFromDb).toHaveBeenCalledWith(
      'session-paid-job',
    )
    expect(dependencies.autoResumeServerSessions).toHaveBeenCalledTimes(1)
  })

  it('reports recovery trouble when a durable job cannot be hydrated', async () => {
    dependencies.prepareUvrSong.mockResolvedValue({
      status: 'in-flight',
      sessionId: 'session-missing-job',
      requiresHydration: true,
    })
    dependencies.refreshUvrSessionFromDb.mockResolvedValue(false)

    await expect(
      createUvrGuitarNightPreparationPort().prepare(sourceFile(), {
        signal: new AbortController().signal,
        onUpdate: vi.fn(),
        onWarning: vi.fn(),
      }),
    ).resolves.toMatchObject({
      status: 'error',
      sessionId: 'session-missing-job',
    })
    expect(dependencies.autoResumeServerSessions).not.toHaveBeenCalled()
  })
})
