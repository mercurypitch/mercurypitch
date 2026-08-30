// ============================================================
// Guitar Night song-port tests — the failure code must survive the eager load
// ============================================================
//
// Guitar Night opens its backing lease eagerly, so a load() failure has to be
// flattened into the narrower openSession result. Flattening everything to
// `missing-local-audio` made a long song report as absent audio while the same
// files still played in the stem mixer and in Drum Night.

import { describe, expect, it, vi } from 'vitest'
import type { PlayAlongBackingSource } from '@/features/play-along/song-port'

const openSession = vi.fn()

vi.mock('@/features/play-along/uvr-song-port', () => ({
  createUvrPlayAlongSongPort: () => ({
    initialize: vi.fn(async () => undefined),
    completedSongs: () => [],
    openSession,
  }),
}))

const { createUvrGuitarNightSongPort } = await import('./uvr-song-port')

function selectedSource(load: PlayAlongBackingSource<'guitar'>['load']): {
  ok: true
  lease: PlayAlongBackingSource<'guitar'>
} {
  return {
    ok: true,
    lease: {
      sessionId: 'session-1',
      title: 'Heaven Can Wait',
      stemKinds: ['vocal', 'instrumental'],
      plannedMix: { kind: 'two-stem', audible: ['vocal', 'instrumental'] },
      source: 'device',
      load,
      release: vi.fn(),
    } as unknown as PlayAlongBackingSource<'guitar'>,
  }
}

describe('createUvrGuitarNightSongPort', () => {
  it('reports the encoded-byte ceiling instead of missing audio', async () => {
    const release = vi.fn()
    const selected = selectedSource(
      vi.fn(async () => ({
        ok: false as const,
        code: 'encoded-budget' as const,
        requiredBytes: 322 * 1024 * 1024,
        budgetBytes: 256 * 1024 * 1024,
      })),
    )
    selected.lease.release = release
    openSession.mockResolvedValueOnce(selected)

    const result = await createUvrGuitarNightSongPort().openSession(
      'session-1',
      new AbortController().signal,
    )

    expect(result).toEqual({
      ok: false,
      code: 'encoded-budget',
      requiredBytes: 322 * 1024 * 1024,
      budgetBytes: 256 * 1024 * 1024,
    })
    expect(release).toHaveBeenCalledOnce()
  })

  it('still reports genuinely absent audio as missing-local-audio', async () => {
    openSession.mockResolvedValueOnce(
      selectedSource(
        vi.fn(async () => ({
          ok: false as const,
          code: 'missing-local-audio' as const,
        })),
      ),
    )

    await expect(
      createUvrGuitarNightSongPort().openSession(
        'session-1',
        new AbortController().signal,
      ),
    ).resolves.toEqual({ ok: false, code: 'missing-local-audio' })
  })

  it('passes an abort straight through', async () => {
    openSession.mockResolvedValueOnce(
      selectedSource(
        vi.fn(async () => ({ ok: false as const, code: 'aborted' as const })),
      ),
    )

    await expect(
      createUvrGuitarNightSongPort().openSession(
        'session-1',
        new AbortController().signal,
      ),
    ).resolves.toEqual({ ok: false, code: 'aborted' })
  })
})
