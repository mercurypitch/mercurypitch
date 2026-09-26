// Runtime asset response tests — iOS custom-origin bytes remain distinct from empty and HTTP failures.

import { describe, expect, it, vi } from 'vitest'
import type { GlassAssetResponse } from './asset-response'
import { readGlassAssetBlob } from './asset-response'

function response(
  fields: Pick<GlassAssetResponse, 'ok' | 'status'>,
  body: Blob,
): GlassAssetResponse {
  return { ...fields, blob: vi.fn().mockResolvedValue(body) }
}

describe('runtime asset responses', () => {
  it('accepts an ordinary non-empty HTTP response', async () => {
    const body = new Blob(['audio'], { type: 'audio/mpeg' })
    await expect(
      readGlassAssetBlob(
        '/games/adventure-voice-v6/light/r60-p100.mp3',
        response({ ok: true, status: 200 }, body),
      ),
    ).resolves.toBe(body)
  })

  it('rejects an empty ordinary HTTP response', async () => {
    await expect(
      readGlassAssetBlob(
        '/games/adventure-voice-v6/light/r60-p100.mp3',
        response({ ok: true, status: 200 }, new Blob()),
      ),
    ).rejects.toThrow(
      'Asset was empty: /games/adventure-voice-v6/light/r60-p100.mp3',
    )
  })

  it('accepts the non-empty status-0 body returned for bundled iOS media', async () => {
    const body = new Blob(['audio'], { type: 'audio/mpeg' })
    await expect(
      readGlassAssetBlob(
        '/games/adventure-voice-v6/light/r60-p100.mp3',
        response({ ok: false, status: 0 }, body),
      ),
    ).resolves.toBe(body)
  })

  it('rejects an empty status-0 body', async () => {
    await expect(
      readGlassAssetBlob(
        '/games/adventure-voice-v6/light/r60-p100.mp3',
        response({ ok: false, status: 0 }, new Blob()),
      ),
    ).rejects.toThrow(
      'Asset was empty: /games/adventure-voice-v6/light/r60-p100.mp3',
    )
  })

  it('rejects a genuine HTTP failure without reading its body', async () => {
    const failed = response({ ok: false, status: 404 }, new Blob(['missing']))
    await expect(
      readGlassAssetBlob(
        '/games/adventure-voice-v6/light/r60-p100.mp3',
        failed,
      ),
    ).rejects.toThrow(
      'Asset request failed (404): /games/adventure-voice-v6/light/r60-p100.mp3',
    )
    expect(failed.blob).not.toHaveBeenCalled()
  })

  it('propagates a body-read failure', async () => {
    const readFailure = new TypeError('Body stream failed')
    const failed: GlassAssetResponse = {
      ok: true,
      status: 200,
      blob: vi.fn().mockRejectedValue(readFailure),
    }

    await expect(
      readGlassAssetBlob(
        '/games/adventure-voice-v6/light/r60-p100.mp3',
        failed,
      ),
    ).rejects.toBe(readFailure)
  })
})
