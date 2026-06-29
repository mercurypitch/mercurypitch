// ============================================================
// RunPod bridge — request/response handling tests (mocked fetch)
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunpodConfig } from '@/lib/runpod'
import { coerceFormString, decodeStemKey, handleRunpodRequest, parseStems, } from '@/lib/runpod-bridge'

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
      fields: { model: 'UVR-MDX-NET-Inst_HQ_3' },
    })
    const res = await handleRunpodRequest(request, url, 'POST', CFG)
    expect(res?.status).toBe(400)
  })

  it('413s for an oversized inline upload with no audio_url', async () => {
    const { request, url } = processReq('/api/uvr/process', {
      headers: { 'x-uvr-provider': 'runpod' },
      file: new File([new Uint8Array(8 * 1024 * 1024)], 'big.wav'),
    })
    const res = await handleRunpodRequest(request, url, 'POST', CFG)
    expect(res?.status).toBe(413)
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
