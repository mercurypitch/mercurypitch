// ============================================================
// RunPod bridge — request/response handling tests (mocked fetch)
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunpodConfig } from '@/lib/runpod'
import { coerceFormString, decodeStemKey, extFromName, handleRunpodRequest, parseStems, rejectUnconfiguredRunpod, } from '@/lib/runpod-bridge'

const CFG: RunpodConfig = {
  apiKey: 'key-123',
  endpoints: { gpu: 'ep-gpu', cpu: 'ep-cpu' },
  defaultTier: 'gpu',
  baseUrl: 'https://api.runpod.ai/v2',
}
const GPU_ONLY: RunpodConfig = { ...CFG, endpoints: { gpu: 'ep-gpu' } }

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return vi.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  } as Response)
}

function req(path: string, init?: RequestInit): { request: Request; url: URL } {
  const request = new Request(`https://x.test${path}`, init)
  return { request, url: new URL(request.url) }
}

// Build a process request with a stubbed formData() so the File instance is
// our global File (a real Request body round-trip mixes jsdom/undici types,
// breaking `instanceof File`).
function processReq(
  path: string,
  opts: {
    headers?: Record<string, string>
    fields?: Record<string, string>
    file?: File
  } = {},
): { request: Request; url: URL } {
  const url = new URL(`https://x.test${path}`)
  const fd = new FormData()
  if (opts.file !== undefined) fd.append('file', opts.file)
  for (const [k, v] of Object.entries(opts.fields ?? {})) fd.append(k, v)
  const request = {
    headers: new Headers(opts.headers ?? {}),
    formData: () => Promise.resolve(fd),
  } as unknown as Request
  return { request, url }
}

function smallFile(): File {
  const bytes = new Uint8Array([1, 2, 3])
  const f = new File([bytes], 'song.mp3', { type: 'audio/mpeg' })
  // jsdom's File may lack arrayBuffer(); the bridge needs it for base64 input.
  if (typeof f.arrayBuffer !== 'function') {
    Object.defineProperty(f, 'arrayBuffer', {
      value: () => Promise.resolve(bytes.buffer),
    })
  }
  return f
}

/** A File that reports `size` bytes without allocating them, with a stub
 *  stream() (the R2 upload path streams the body). */
function bigFile(size: number, name = 'big.mp3'): File {
  const f = new File([new Uint8Array(1)], name, { type: 'audio/mpeg' })
  Object.defineProperty(f, 'size', { value: size })
  Object.defineProperty(f, 'stream', {
    value: () => new ReadableStream(),
  })
  return f
}

/** Minimal R2 bucket stub recording put() calls. */
function mockBucket() {
  return {
    put: vi.fn((_key: string, _value?: unknown, _opts?: unknown) =>
      Promise.resolve({}),
    ),
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

// ── process ─────────────────────────────────────────────────────

describe('handleRunpodRequest — process', () => {
  it('returns null without the opt-in (falls through to the container)', async () => {
    const { request, url } = processReq('/api/uvr/process', {
      file: smallFile(),
    })
    expect(await handleRunpodRequest(request, url, 'POST', CFG)).toBeNull()
  })

  it('submits to the GPU endpoint by default and returns an rp_gpu_ session', async () => {
    const spy = mockFetchOnce({ id: 'job-1', status: 'IN_QUEUE' })
    const { request, url } = processReq('/api/uvr/process', {
      headers: { 'x-uvr-provider': 'runpod' },
      file: smallFile(),
    })

    const res = await handleRunpodRequest(request, url, 'POST', CFG)
    expect(res?.status).toBe(200)
    const body = (await res?.json()) as { session_id: string; status: string }
    expect(body.session_id).toBe('rp_gpu_job-1')
    expect(body.status).toBe('processing')
    expect(spy.mock.calls[0][0]).toBe('https://api.runpod.ai/v2/ep-gpu/run')
  })

  it('routes the cpu tier to the cpu endpoint with an rp_cpu_ session', async () => {
    const spy = mockFetchOnce({ id: 'job-2' })
    const { request, url } = processReq(
      '/api/uvr/process?provider=runpod-cpu',
      {
        file: smallFile(),
      },
    )

    const res = await handleRunpodRequest(request, url, 'POST', CFG)
    const body = (await res?.json()) as { session_id: string }
    expect(body.session_id).toBe('rp_cpu_job-2')
    expect(spy.mock.calls[0][0]).toBe('https://api.runpod.ai/v2/ep-cpu/run')
  })

  it('falls back to the default tier when the requested one is absent', async () => {
    const spy = mockFetchOnce({ id: 'job-3' })
    const { request, url } = processReq(
      '/api/uvr/process?provider=runpod-cpu',
      {
        file: smallFile(),
      },
    )

    // GPU-only config: a cpu request resolves to gpu.
    const res = await handleRunpodRequest(request, url, 'POST', GPU_ONLY)
    const body = (await res?.json()) as { session_id: string }
    expect(body.session_id).toBe('rp_gpu_job-3')
    expect(spy.mock.calls[0][0]).toBe('https://api.runpod.ai/v2/ep-gpu/run')
  })

  it('400s when no file is provided', async () => {
    const { request, url } = processReq('/api/uvr/process', {
      headers: { 'x-uvr-provider': 'runpod' },
      fields: { model: 'roformer' },
    })
    const res = await handleRunpodRequest(request, url, 'POST', CFG)
    expect(res?.status).toBe(400)
  })

  it('400s an unknown model without submitting a job', async () => {
    const spy = mockFetchOnce({ id: 'never' })
    const { request, url } = processReq('/api/uvr/process', {
      headers: { 'x-uvr-provider': 'runpod' },
      file: smallFile(),
      fields: { model: 'evil_random_weights.ckpt' },
    })
    const res = await handleRunpodRequest(request, url, 'POST', CFG)
    expect(res?.status).toBe(400)
    const body = (await res?.json()) as { error: string }
    expect(body.error).toContain('Unknown model')
    expect(spy).not.toHaveBeenCalled()
  })

  it('passes allowlisted models through, including the legacy name', async () => {
    for (const model of ['roformer', 'karaoke', 'UVR-MDX-NET-Inst_HQ_3']) {
      // Re-spying on the same global fetch accumulates calls across loop
      // iterations — always assert on the latest submit.
      const spy = mockFetchOnce({ id: `job-${model}` })
      const { request, url } = processReq('/api/uvr/process', {
        headers: { 'x-uvr-provider': 'runpod' },
        file: smallFile(),
        fields: { model },
      })
      const res = await handleRunpodRequest(request, url, 'POST', CFG)
      expect(res?.status).toBe(200)
      const lastCall = spy.mock.calls.at(-1)
      const sent = JSON.parse(lastCall?.[1]?.body as string) as {
        input: { model: string }
      }
      expect(sent.input.model).toBe(model)
    }
  })

  it('503s a >7 MB upload when no R2 bucket is wired', async () => {
    const { request, url } = processReq('/api/uvr/process', {
      headers: { 'x-uvr-provider': 'runpod' },
      file: bigFile(8 * 1024 * 1024, 'big.wav'),
    })
    const res = await handleRunpodRequest(request, url, 'POST', CFG)
    expect(res?.status).toBe(503)
  })

  it('413s an upload over the 50 MB hard cap', async () => {
    const { request, url } = processReq('/api/uvr/process', {
      headers: { 'x-uvr-provider': 'runpod' },
      file: bigFile(51 * 1024 * 1024, 'huge.wav'),
    })
    const res = await handleRunpodRequest(
      request,
      url,
      'POST',
      CFG,
      null,
      mockBucket(),
    )
    expect(res?.status).toBe(413)
  })

  it('streams a >7 MB file to R2 and passes audio_s3_key (not base64)', async () => {
    const spy = mockFetchOnce({ id: 'job-big' })
    const bucket = mockBucket()
    const { request, url } = processReq('/api/uvr/process', {
      headers: { 'x-uvr-provider': 'runpod' },
      file: bigFile(20 * 1024 * 1024, 'My Song.mp3'),
    })
    const res = await handleRunpodRequest(
      request,
      url,
      'POST',
      CFG,
      null,
      bucket,
    )
    expect(res?.status).toBe(200)
    // Uploaded once, under input/ with a .mp3 extension.
    expect(bucket.put).toHaveBeenCalledTimes(1)
    const key = bucket.put.mock.calls[0][0] as string
    expect(key).toMatch(/^input\/[0-9a-f-]+\.mp3$/)
    // The job carries the key, not inline base64.
    const sent = JSON.parse(spy.mock.calls[0][1]?.body as string) as {
      input: { audio_s3_key?: string; audio_base64?: string }
    }
    expect(sent.input.audio_s3_key).toBe(key)
    expect(sent.input.audio_base64).toBeUndefined()
  })

  it('inlines a ≤7 MB file as base64 (no R2 upload)', async () => {
    const spy = mockFetchOnce({ id: 'job-small' })
    const bucket = mockBucket()
    const { request, url } = processReq('/api/uvr/process', {
      headers: { 'x-uvr-provider': 'runpod' },
      file: smallFile(),
    })
    await handleRunpodRequest(request, url, 'POST', CFG, null, bucket)
    expect(bucket.put).not.toHaveBeenCalled()
    const sent = JSON.parse(spy.mock.calls[0][1]?.body as string) as {
      input: { audio_base64?: string; audio_s3_key?: string }
    }
    expect(sent.input.audio_base64).toBeDefined()
    expect(sent.input.audio_s3_key).toBeUndefined()
  })

  it('passes audio_url through instead of inlining base64', async () => {
    const spy = mockFetchOnce({ id: 'job-4' })
    const { request, url } = processReq('/api/uvr/process', {
      headers: { 'x-uvr-provider': 'runpod' },
      file: smallFile(),
      fields: { audio_url: 'https://r2.test/song.mp3' },
    })

    await handleRunpodRequest(request, url, 'POST', CFG)
    const sent = JSON.parse(spy.mock.calls[0][1]?.body as string) as {
      input: { audio_url?: string; audio_base64?: string }
    }
    expect(sent.input.audio_url).toBe('https://r2.test/song.mp3')
    expect(sent.input.audio_base64).toBeUndefined()
  })

  it('502s when RunPod returns no job id', async () => {
    mockFetchOnce({ error: 'no capacity' })
    const { request, url } = processReq('/api/uvr/process', {
      headers: { 'x-uvr-provider': 'runpod' },
      file: smallFile(),
    })
    const res = await handleRunpodRequest(request, url, 'POST', CFG)
    expect(res?.status).toBe(502)
  })
})

// ── status ──────────────────────────────────────────────────────

describe('handleRunpodRequest — status', () => {
  it('maps a completed job to the app status contract', async () => {
    mockFetchOnce({
      status: 'COMPLETED',
      output: {
        stems: [{ stem: 'vocal', filename: 'v.flac', url: 'https://r2/v' }],
      },
    })
    const { request, url } = req('/api/uvr/status/rp_gpu_job-1')
    const res = await handleRunpodRequest(request, url, 'GET', CFG)
    const body = (await res?.json()) as {
      status: string
      files: { path: string }[]
    }
    expect(body.status).toBe('completed')
    expect(body.files[0].path).toBe('/api/uvr/output/rp_gpu_job-1/vocal')
  })

  it('returns null for a non-RunPod (container UUID) session', async () => {
    const { request, url } = req(
      '/api/uvr/status/123e4567-e89b-12d3-a456-426614174000',
    )
    expect(await handleRunpodRequest(request, url, 'GET', CFG)).toBeNull()
  })

  it('404s when the session tier is not configured', async () => {
    const { request, url } = req('/api/uvr/status/rp_cpu_job-1')
    const res = await handleRunpodRequest(request, url, 'GET', GPU_ONLY)
    expect(res?.status).toBe(404)
  })
})

// ── output ──────────────────────────────────────────────────────

describe('handleRunpodRequest — output', () => {
  it('redirects to the stem storage URL', async () => {
    mockFetchOnce({
      status: 'COMPLETED',
      output: {
        stems: [{ stem: 'vocal', filename: 'v.flac', url: 'https://r2/v' }],
      },
    })
    const { request, url } = req('/api/uvr/output/rp_gpu_job-1/vocal')
    const res = await handleRunpodRequest(request, url, 'GET', CFG)
    expect(res?.status).toBe(302)
    expect(res?.headers.get('location')).toBe('https://r2/v')
  })

  it('streams inline base64 stems with the right content type', async () => {
    mockFetchOnce({
      status: 'COMPLETED',
      output: {
        stems: [
          {
            stem: 'vocal',
            filename: 'v.flac',
            data_base64: globalThis.btoa('hello'),
          },
        ],
      },
    })
    const { request, url } = req('/api/uvr/output/rp_gpu_job-1/vocal')
    const res = await handleRunpodRequest(request, url, 'GET', CFG)
    expect(res?.status).toBe(200)
    expect(res?.headers.get('content-type')).toBe('audio/flac')
    expect(new TextDecoder().decode(await res!.arrayBuffer())).toBe('hello')
  })

  it('404s when the job is not complete yet', async () => {
    mockFetchOnce({ status: 'IN_PROGRESS' })
    const { request, url } = req('/api/uvr/output/rp_gpu_job-1/vocal')
    const res = await handleRunpodRequest(request, url, 'GET', CFG)
    expect(res?.status).toBe(404)
  })
})

// ── session (cancel) ────────────────────────────────────────────

describe('handleRunpodRequest — cancel', () => {
  it('cancels the job and reports success', async () => {
    const spy = mockFetchOnce({})
    const { request, url } = req('/api/uvr/session/rp_cpu_job-9', {
      method: 'DELETE',
    })
    const res = await handleRunpodRequest(request, url, 'DELETE', CFG)
    expect(res?.status).toBe(200)
    expect(spy.mock.calls[0][0]).toBe(
      'https://api.runpod.ai/v2/ep-cpu/cancel/job-9',
    )
  })
})

// ── pure helpers ────────────────────────────────────────────────

describe('decodeStemKey', () => {
  it('returns a bare stem key unchanged', () => {
    expect(decodeStemKey('vocal', 'rp_gpu_job-1')).toBe('vocal')
  })

  it('strips a client-double-prefixed, url-encoded path', () => {
    const doubled = encodeURIComponent('/api/uvr/output/rp_gpu_job-1/vocal')
    expect(decodeStemKey(doubled, 'rp_gpu_job-1')).toBe('vocal')
  })

  it('handles a missing rest segment', () => {
    expect(decodeStemKey(undefined, 'rp_gpu_job-1')).toBe('')
  })
})

describe('coerceFormString', () => {
  it('returns non-empty strings, else undefined', () => {
    expect(coerceFormString('x')).toBe('x')
    expect(coerceFormString('')).toBeUndefined()
    expect(coerceFormString(null)).toBeUndefined()
    expect(coerceFormString(new File([], 'a'))).toBeUndefined()
  })
})

describe('parseStems', () => {
  it('parses a JSON string array', () => {
    expect(parseStems('["vocal","instrumental"]')).toEqual([
      'vocal',
      'instrumental',
    ])
  })

  it('rejects non-arrays, non-string arrays, and junk', () => {
    expect(parseStems('')).toBeUndefined()
    expect(parseStems(null)).toBeUndefined()
    expect(parseStems('not json')).toBeUndefined()
    expect(parseStems('[1,2]')).toBeUndefined()
  })
})

// ── metering (debit on accept, refund on failure/cancel) ───────

describe('handleRunpodRequest — metering', () => {
  const METER = { baseUrl: 'https://db.test', serviceKey: 'svc' }

  /** Fetch mock dispatching by URL; records calls for assertions. */
  function mockRoutes(
    routes: Record<string, { body: unknown; status?: number }>,
  ) {
    const calls: { url: string; init?: RequestInit }[] = []
    vi.spyOn(global, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      calls.push({ url, init })
      const hit = Object.entries(routes).find(([k]) => url.includes(k))
      const status = hit?.[1].status ?? 200
      return Promise.resolve({
        ok: status < 400,
        status,
        statusText: 'x',
        json: () => Promise.resolve(hit?.[1].body ?? {}),
      } as Response)
    })
    return calls
  }

  it('debits the accepted job with the forwarded Authorization', async () => {
    const calls = mockRoutes({
      '/run': { body: { id: 'job-1' } },
      '/api/billing/debit': { body: { debited: 2, balance: 8 } },
    })
    const { request, url } = processReq('/api/uvr/process', {
      headers: { 'x-uvr-provider': 'runpod', Authorization: 'Bearer tok' },
      file: smallFile(),
    })

    const res = await handleRunpodRequest(request, url, 'POST', CFG, METER)
    expect(res?.status).toBe(200)
    const debit = calls.find((c) => c.url.includes('/api/billing/debit'))
    expect(debit).toBeDefined()
    expect((debit?.init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer tok',
    )
    expect(JSON.parse(debit?.init?.body as string)).toEqual({
      tier: 'gpu',
      jobRef: 'rp_gpu_job-1',
    })
  })

  it('cancels the job and returns 402 when the debit is refused', async () => {
    const calls = mockRoutes({
      '/run': { body: { id: 'job-1' } },
      '/api/billing/debit': {
        body: { error: 'Insufficient credits', required: 2, balance: 0 },
        status: 402,
      },
      '/cancel/': { body: {} },
    })
    const { request, url } = processReq('/api/uvr/process', {
      headers: { 'x-uvr-provider': 'runpod', Authorization: 'Bearer tok' },
      file: smallFile(),
    })

    const res = await handleRunpodRequest(request, url, 'POST', CFG, METER)
    expect(res?.status).toBe(402)
    const body = (await res?.json()) as { error: string; balance: number }
    expect(body.error).toBe('Insufficient credits')
    expect(body.balance).toBe(0)
    expect(calls.some((c) => c.url.includes('/cancel/job-1'))).toBe(true)
  })

  it('does not meter when metering is off (null)', async () => {
    const calls = mockRoutes({ '/run': { body: { id: 'job-1' } } })
    const { request, url } = processReq('/api/uvr/process', {
      headers: { 'x-uvr-provider': 'runpod' },
      file: smallFile(),
    })
    const res = await handleRunpodRequest(request, url, 'POST', CFG)
    expect(res?.status).toBe(200)
    expect(calls.some((c) => c.url.includes('/api/billing/'))).toBe(false)
  })

  it('refunds a job whose status ends in error', async () => {
    const calls = mockRoutes({
      '/status/': { body: { status: 'FAILED', error: 'boom' } },
      '/api/billing/refund': { body: { refunded: 2 } },
    })
    const { request, url } = req('/api/uvr/status/rp_gpu_job-1')
    const res = await handleRunpodRequest(request, url, 'GET', CFG, METER)
    const body = (await res?.json()) as { status: string }
    expect(body.status).toBe('error')
    const refund = calls.find((c) => c.url.includes('/api/billing/refund'))
    expect(refund).toBeDefined()
    expect(
      (refund?.init?.headers as Record<string, string>)['X-Service-Key'],
    ).toBe('svc')
    expect(JSON.parse(refund?.init?.body as string)).toEqual({
      jobRef: 'rp_gpu_job-1',
    })
  })

  it('does not refund a completed status', async () => {
    const calls = mockRoutes({
      '/status/': {
        body: {
          status: 'COMPLETED',
          output: { stems: [{ stem: 'vocal', filename: 'v.flac', url: 'u' }] },
        },
      },
    })
    const { request, url } = req('/api/uvr/status/rp_gpu_job-1')
    await handleRunpodRequest(request, url, 'GET', CFG, METER)
    expect(calls.some((c) => c.url.includes('/api/billing/refund'))).toBe(false)
  })

  it('refunds a cancel of a still-queued job (no GPU spend yet)', async () => {
    const calls = mockRoutes({
      '/status/': { body: { status: 'IN_QUEUE' } },
      '/cancel/': { body: {} },
      '/api/billing/refund': { body: { refunded: 2 } },
    })
    const { request, url } = req('/api/uvr/session/rp_gpu_job-1')
    const res = await handleRunpodRequest(request, url, 'DELETE', CFG, METER)
    expect(res?.status).toBe(200)
    expect(calls.some((c) => c.url.includes('/cancel/job-1'))).toBe(true)
    expect(calls.some((c) => c.url.includes('/api/billing/refund'))).toBe(true)
  })

  it('keeps the debit when cancelling a RUNNING job (GPU time already spent)', async () => {
    const calls = mockRoutes({
      '/status/': { body: { status: 'IN_PROGRESS' } },
      '/cancel/': { body: {} },
      '/api/billing/refund': { body: { refunded: 2 } },
    })
    const { request, url } = req('/api/uvr/session/rp_gpu_job-1')
    const res = await handleRunpodRequest(request, url, 'DELETE', CFG, METER)
    expect(res?.status).toBe(200)
    expect(calls.some((c) => c.url.includes('/cancel/job-1'))).toBe(true)
    expect(calls.some((c) => c.url.includes('/api/billing/refund'))).toBe(false)
  })

  it('does not refund a CANCELLED job via the status route', async () => {
    // The cancel path already decided refundability; polling a cancelled
    // job must not claw the credit back.
    const calls = mockRoutes({
      '/status/': { body: { status: 'CANCELLED' } },
      '/api/billing/refund': { body: { refunded: 2 } },
    })
    const { request, url } = req('/api/uvr/status/rp_gpu_job-1')
    const res = await handleRunpodRequest(request, url, 'GET', CFG, METER)
    const body = (await res?.json()) as { status: string }
    expect(body.status).toBe('error')
    expect(calls.some((c) => c.url.includes('/api/billing/refund'))).toBe(false)
  })

  it('does not refund deleting an already-completed session', async () => {
    const calls = mockRoutes({
      '/status/': {
        body: {
          status: 'COMPLETED',
          output: { stems: [{ stem: 'vocal', filename: 'v.flac', url: 'u' }] },
        },
      },
      '/cancel/': { body: {} },
    })
    const { request, url } = req('/api/uvr/session/rp_gpu_job-1')
    const res = await handleRunpodRequest(request, url, 'DELETE', CFG, METER)
    expect(res?.status).toBe(200)
    expect(calls.some((c) => c.url.includes('/cancel/job-1'))).toBe(true)
    expect(calls.some((c) => c.url.includes('/api/billing/refund'))).toBe(false)
  })
})

// ── unconfigured RunPod guard (server mode is GPU-only) ────────

describe('rejectUnconfiguredRunpod', () => {
  it('503s an opted-in process request', async () => {
    const { request, url } = req('/api/uvr/process', {
      method: 'POST',
      headers: { 'x-uvr-provider': 'runpod' },
    })
    const res = rejectUnconfiguredRunpod(request, url, 'POST')
    expect(res?.status).toBe(503)
    const body = (await res?.json()) as { error: string }
    expect(body.error).toContain('Use Browser mode')
  })

  it('lets non-opted process requests fall through to the container', () => {
    const { request, url } = req('/api/uvr/process', { method: 'POST' })
    expect(rejectUnconfiguredRunpod(request, url, 'POST')).toBeNull()
  })

  it('503s follow-ups for rp_* sessions', () => {
    const { request, url } = req('/api/uvr/status/rp_gpu_job-1')
    expect(rejectUnconfiguredRunpod(request, url, 'GET')?.status).toBe(503)
  })

  it('lets container (UUID) sessions fall through', () => {
    const { request, url } = req(
      '/api/uvr/status/123e4567-e89b-12d3-a456-426614174000',
    )
    expect(rejectUnconfiguredRunpod(request, url, 'GET')).toBeNull()
  })
})

describe('extFromName', () => {
  it('keeps a sane lowercased extension', () => {
    expect(extFromName('My Song.MP3')).toBe('.mp3')
    expect(extFromName('track.flac')).toBe('.flac')
  })
  it('takes the last valid segment as the extension', () => {
    expect(extFromName('weird.name.with.wav')).toBe('.wav')
  })
  it('falls back to .mp3 for missing/odd extensions', () => {
    expect(extFromName('noext')).toBe('.mp3')
    expect(extFromName('bad.<script>')).toBe('.mp3')
    expect(extFromName('song.verylongext')).toBe('.mp3')
  })
})
