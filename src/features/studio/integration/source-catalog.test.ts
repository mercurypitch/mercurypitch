// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { VoiceTakeRecord, VoiceTakeSource } from '@/db/entities'
import type { StudioSourceReader } from './source-catalog'
import { listStudioSources, readStudioSourceBlob, studioSourceFromTake, } from './source-catalog'

function take(source: VoiceTakeSource, id = `take:${source}`): VoiceTakeRecord {
  return {
    id,
    source,
    title: 'Window seat',
    capturedAt: '2026-10-26T10:00:00.000Z',
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
    comparisonKey: 'private-practice-thread',
    contextVersion: 1,
    durationMs: 1200,
    mimeType: 'audio/wav',
    sizeBytes: 3,
    peaks: [0.2],
    favorite: false,
    contextJson: '{"device":"private"}',
    metricsJson: '{"score":99}',
    contourBytes: 200,
    contourPointCount: 100,
    contourVersion: 1,
    roomId: 'private-room',
  }
}

describe('Studio source catalogue', () => {
  it('lists metadata without fetching any audio or copying practice evidence', async () => {
    const reader: StudioSourceReader = {
      listVoiceTakes: vi.fn(async () => [take('karaoke'), take('piano-night')]),
      getVoiceTakeBlob: vi.fn(async () => new Blob(['abc'])),
    }
    const entries = await listStudioSources({ reader })
    expect(reader.getVoiceTakeBlob).not.toHaveBeenCalled()
    expect(
      entries.map((entry) => [entry.sourceLabel, entry.suggestedRole]),
    ).toEqual([
      ['Karaoke', 'voice'],
      ['Piano', 'piano'],
    ])
    expect(entries[0]).toEqual({
      id: 'take:karaoke',
      source: 'karaoke',
      title: 'Window seat',
      sourceLabel: 'Karaoke',
      audioDescription: 'Dry microphone audio. Backing is not included.',
      suggestedRole: 'voice',
      durationMs: 1200,
      sizeBytes: 3,
      capturedAt: '2026-10-26T10:00:00.000Z',
      mimeType: 'audio/wav',
    })
  })

  it.each([
    ['freeform', 'Hear Yourself', 'voice', 'microphone'],
    ['piano-night', 'Piano', 'piano', 'Felt-synth'],
    ['drum-night', 'Drums', 'drums', 'Live-kit'],
    ['guitar-night', 'Guitar', 'acoustic-guitar', 'Place it'],
  ] as const)(
    'keeps %s provenance separate from musical role',
    (source, label, role, description) => {
      const entry = studioSourceFromTake(take(source))
      expect(entry.source).toBe(source)
      expect(entry.sourceLabel).toBe(label)
      expect(entry.suggestedRole).toBe(role)
      expect(entry.audioDescription).toContain(description)
      expect(
        studioSourceFromTake(take('guitar-night', 'guitar-take:123'))
          .audioDescription,
      ).toBe('Dry input. Amp effects are not included.')
    },
  )

  it('reads only the selected source and reports removed or changed audio', async () => {
    const selected = studioSourceFromTake(take('drum-night'))
    const reader = {
      listVoiceTakes: vi.fn(),
      getVoiceTakeBlob: vi.fn(
        async (): Promise<Blob | null> => new Blob(['abc']),
      ),
    }
    expect((await readStudioSourceBlob(selected, { reader })).size).toBe(3)
    expect(reader.getVoiceTakeBlob).toHaveBeenCalledExactlyOnceWith(selected.id)
    reader.getVoiceTakeBlob.mockResolvedValueOnce(null)
    await expect(readStudioSourceBlob(selected, { reader })).rejects.toThrow(
      'no longer has audio',
    )
    reader.getVoiceTakeBlob.mockResolvedValueOnce(new Blob(['changed']))
    await expect(readStudioSourceBlob(selected, { reader })).rejects.toThrow(
      'changed',
    )
    expect(reader.listVoiceTakes).not.toHaveBeenCalled()
  })

  it('propagates storage failure and discards a stale catalogue response', async () => {
    const reader = {
      listVoiceTakes: vi.fn(async () => {
        throw new Error('Storage unavailable')
      }),
      getVoiceTakeBlob: vi.fn(),
    }
    await expect(listStudioSources({ reader })).rejects.toThrow(
      'Storage unavailable',
    )
    const abort = new AbortController()
    const stale = {
      listVoiceTakes: async () => {
        abort.abort()
        return [take('freeform')]
      },
      getVoiceTakeBlob: vi.fn(),
    }
    await expect(
      listStudioSources({ reader: stale, signal: abort.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(stale.getVoiceTakeBlob).not.toHaveBeenCalled()
  })
})
