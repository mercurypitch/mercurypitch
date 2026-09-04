// The rule that a zero status is not a failure.
// ============================================================
//
// This is the whole iOS silence, in four tests. See asset-fetch.ts for
// why status 0 arrives at all; what matters here is that the guard which
// used to sit in both audio loaders -- `if (!response.ok) throw` -- is
// gone for good, and cannot come back without one of these failing.

import { describe, expect, it } from 'vitest'
import type { AssetResponse } from './asset-fetch'
import { assetResponseFailed, readAssetBytes } from './asset-fetch'

const bytes = (length: number): ArrayBuffer => new ArrayBuffer(length)

const response = (
  init: Partial<AssetResponse> & { body?: ArrayBuffer },
): AssetResponse => ({
  ok: init.ok ?? false,
  status: init.status ?? 0,
  arrayBuffer: async () => init.body ?? bytes(1024),
})

describe('what counts as a failed asset read', () => {
  // The case this module exists for. Capacitor's iOS scheme handler
  // answers a non-range GET for any media extension with a bare
  // URLResponse, so WebKit reports status 0 -- with the entire file in
  // the body. Android's local server sets an explicit 200 for the same
  // bytes, which is the whole reason this was iOS-only and invisible.
  it('accepts the status-0 response Capacitor gives iOS for media', () => {
    expect(assetResponseFailed(response({ ok: false, status: 0 }))).toBe(false)
  })

  it('accepts an ordinary 200', () => {
    expect(assetResponseFailed(response({ ok: true, status: 200 }))).toBe(false)
  })

  it.each([400, 403, 404, 500])('still rejects %i', (status) => {
    expect(assetResponseFailed(response({ ok: false, status }))).toBe(true)
  })
})

describe('reading the bytes', () => {
  it('hands back the body of a status-0 response', async () => {
    const body = bytes(2048)
    await expect(
      readAssetBytes('capacitor://localhost/score.m4a', response({ body })),
    ).resolves.toBe(body)
  })

  it('names the url and the status when it really did fail', async () => {
    await expect(
      readAssetBytes(
        'capacitor://localhost/score.m4a',
        response({ ok: false, status: 404 }),
      ),
    ).rejects.toThrow(/404.*score\.m4a/)
  })

  // The one case a zero status could genuinely be hiding, and the reason
  // the check is on the bytes rather than only on the status.
  it.each([0, 200])(
    'rejects an empty body even when status %i is otherwise accepted',
    async (status) => {
      const ok = status === 200
      await expect(
        readAssetBytes(
          'capacitor://localhost/score.m4a',
          response({ ok, status, body: bytes(0) }),
        ),
      ).rejects.toThrow(/empty/)
    },
  )
})
