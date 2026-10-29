// @vitest-environment node
// Studio audio client tests — a restore's audio checked in the worker and moved, never copied; kept whole when the worker cannot take it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { studioAssetFixture } from '@/db/services/studio.fixture'
import type { StudioAssetBytes } from '@/lib/studio/model/types'
import { sha256Bytes } from './canonical-pcm'
import type { StudioAudioRequest } from './studio-audio-jobs'
import { answerStudioAudioJob } from './studio-audio-jobs'

type Mode = 'works' | 'never-loads' | 'dies-holding-bytes'

/** A worker with the browser's transfer rules: what is sent is gone from the sender. */
class FakeWorker {
  static mode: Mode = 'works'
  static received: StudioAudioRequest[] = []
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  terminated = false

  constructor() {
    setTimeout(() => {
      if (FakeWorker.mode === 'never-loads') this.onerror?.()
      else this.reply({ ready: true })
    })
  }

  postMessage(message: StudioAudioRequest, transfer: Transferable[] = []) {
    const request = structuredClone(message, { transfer })
    FakeWorker.received.push(request)
    if (FakeWorker.mode === 'dies-holding-bytes') {
      setTimeout(() => this.onerror?.())
      return
    }
    void answerStudioAudioJob(request).then(
      (bytes) => this.reply({ id: request.id, ok: true, bytes }, bytes),
      (error: Error) =>
        this.reply({ id: request.id, ok: false, message: error.message }),
    )
  }

  terminate() {
    this.terminated = true
  }

  private reply(data: unknown, transfer: Transferable[] = []) {
    const answer = structuredClone(data, { transfer })
    setTimeout(() => this.onmessage?.({ data: answer }))
  }
}

async function heldBytes(): Promise<StudioAssetBytes> {
  const data = await studioAssetFixture('song')
  return {
    asset: data.asset,
    original: await data.original.arrayBuffer(),
    canonicalPcm: await data.canonicalPcm.arrayBuffer(),
  }
}

async function load() {
  vi.resetModules()
  const client = await import('./studio-audio-client')
  const preparation = await import('./prepare-studio-asset')
  return { ...client, ...preparation }
}

beforeEach(() => {
  FakeWorker.mode = 'works'
  FakeWorker.received = []
  vi.stubGlobal('Worker', FakeWorker)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Studio audio client', () => {
  it("checks a restore's audio in the worker and keeps the bytes it hands back, moved rather than copied", async () => {
    const { installStudioAudioWorker, checkPreparedStudioBytes } = await load()
    const uninstall = installStudioAudioWorker()
    const data = await heldBytes()
    const checked = await checkPreparedStudioBytes(data)
    expect(FakeWorker.received.map((request) => request.kind)).toEqual([
      'bytes',
    ])
    // Sent, not copied: the page no longer holds the buffers it handed over.
    expect(data.original.byteLength).toBe(0)
    expect(data.canonicalPcm.byteLength).toBe(0)
    expect(checked.original.byteLength).toBe(data.asset.byteLength)
    expect(await sha256Bytes(checked.original)).toBe(data.asset.sha256)
    expect(await sha256Bytes(checked.canonicalPcm)).toBe(
      data.asset.canonicalPcmSha256,
    )
    uninstall()
  })

  it('refuses a damaged take in the worker with the message a check here gives', async () => {
    const { installStudioAudioWorker, checkPreparedStudioBytes } = await load()
    const uninstall = installStudioAudioWorker()
    const data = await heldBytes()
    await expect(
      checkPreparedStudioBytes({
        ...data,
        asset: { ...data.asset, sha256: 'a'.repeat(64) },
      }),
    ).rejects.toThrow('Original audio checksum failed')
    expect(FakeWorker.received).toHaveLength(1)
    uninstall()
  })

  it('keeps the bytes whole and checks them here when the worker never loads', async () => {
    FakeWorker.mode = 'never-loads'
    const { installStudioAudioWorker, checkPreparedStudioBytes } = await load()
    const uninstall = installStudioAudioWorker()
    const data = await heldBytes()
    const checked = await checkPreparedStudioBytes(data)
    expect(FakeWorker.received).toEqual([])
    expect(checked.original).toBe(data.original)
    expect(checked.original.byteLength).toBe(data.asset.byteLength)
    await expect(
      checkPreparedStudioBytes({
        ...data,
        asset: { ...data.asset, sha256: 'a'.repeat(64) },
      }),
    ).rejects.toThrow('Original audio checksum failed')
    uninstall()
  })

  it('says memory, not damage, when the worker dies holding the bytes', async () => {
    FakeWorker.mode = 'dies-holding-bytes'
    const { installStudioAudioWorker, checkPreparedStudioBytes } = await load()
    const uninstall = installStudioAudioWorker()
    await expect(checkPreparedStudioBytes(await heldBytes())).rejects.toThrow(
      expect.objectContaining({ name: 'StudioMemoryError' }),
    )
    uninstall()
  })

  it('checks here again once the Studio closes', async () => {
    const { installStudioAudioWorker, checkPreparedStudioBytes } = await load()
    installStudioAudioWorker()()
    const data = await heldBytes()
    const checked = await checkPreparedStudioBytes(data)
    expect(FakeWorker.received).toEqual([])
    expect(checked.original).toBe(data.original)
  })
})
