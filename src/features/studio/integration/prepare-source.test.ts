// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { sampledAudio } from '@/lib/studio/audio/audio.fixture'
import { prepareStudioSource } from './prepare-source'
import type { StudioSourceEntry } from './source-catalog'

const source: StudioSourceEntry = {
  id: 'guitar-take:kept-id',
  source: 'guitar-night',
  title: 'Dry guitar',
  sourceLabel: 'Guitar',
  audioDescription: 'Dry input. Amp effects are not included.',
  suggestedRole: 'acoustic-guitar',
  durationMs: 1,
  sizeBytes: 3,
  capturedAt: '2026-10-26T10:00:00.000Z',
  mimeType: 'audio/wav',
}
const info = {
  id: 'asset-1',
  projectId: 'project-1',
  importedAt: '2026-10-26T10:01:00.000Z',
}

describe('selected kept audio import', () => {
  it('preserves the actual source identity without bringing practice data into the asset', async () => {
    const reader = {
      listVoiceTakes: vi.fn(),
      getVoiceTakeBlob: vi.fn(
        async () => new Blob(['abc'], { type: 'audio/wav' }),
      ),
    }
    const decode = vi.fn(async () => sampledAudio([[0, 0.25]]))
    const data = await prepareStudioSource(source, info, {
      reader,
      createDecodeContext: () => ({
        sampleRate: 48000,
        decodeAudioData: decode,
      }),
    })
    expect(reader.getVoiceTakeBlob).toHaveBeenCalledExactlyOnceWith(source.id)
    expect(reader.listVoiceTakes).not.toHaveBeenCalled()
    expect(decode).toHaveBeenCalledTimes(1)
    expect(data.asset.provenance).toEqual({
      kind: 'guitar-night',
      sourceId: source.id,
      importedAt: info.importedAt,
    })
    expect(data.asset.originalName).toBe('Dry guitar')
    expect(Object.keys(data.asset.provenance).sort()).toEqual([
      'importedAt',
      'kind',
      'sourceId',
    ])
  })

  it('uses catalogue limits to reject a large take before loading its payload', async () => {
    const reader = { listVoiceTakes: vi.fn(), getVoiceTakeBlob: vi.fn() }
    await expect(
      prepareStudioSource({ ...source, sizeBytes: 100 }, info, {
        reader,
        limits: { maxEncodedBytes: 50 },
      }),
    ).rejects.toThrow('too large')
    await expect(
      prepareStudioSource({ ...source, durationMs: 301000 }, info, { reader }),
    ).rejects.toThrow('too large')
    expect(reader.getVoiceTakeBlob).not.toHaveBeenCalled()
  })
})
