// ============================================================
// RunPod bridge — unit tests for the pure FastAPI<->RunPod mappers
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunpodConfig, RunpodStatus } from '@/lib/runpod'
import { base64ToBytes, buildJobInput, bytesToBase64, contentTypeForFilename, endpointFor, fetchJobStatus, findStemOutput, getRunpodConfig, isRunpodSessionId, mapStatusToResponse, parseSession, requestedRunpodTier, resolveTier, runpodEndpointUrl, runpodHeaders, submitJob, toSessionId, } from '@/lib/runpod'

const CFG: RunpodConfig = {
  apiKey: 'key-123',
  endpoints: { gpu: 'ep-gpu', cpu: 'ep-cpu' },
  defaultTier: 'gpu',
  baseUrl: 'https://api.runpod.ai/v2',
}

beforeEach(() => {
  vi.restoreAllMocks()
})

// ── getRunpodConfig ─────────────────────────────────────────────

describe('getRunpodConfig', () => {
  it('returns null without an api key or any endpoint', () => {
    expect(getRunpodConfig({})).toBeNull()
    expect(getRunpodConfig({ RUNPOD_ENDPOINT_ID_GPU: 'g' })).toBeNull()
    expect(getRunpodConfig({ RUNPOD_API_KEY: 'k' })).toBeNull()
    expect(
      getRunpodConfig({ RUNPOD_API_KEY: 'k', RUNPOD_ENDPOINT_ID_GPU: '' }),
    ).toBeNull()
  })

  it('treats the legacy RUNPOD_ENDPOINT_ID as the GPU endpoint', () => {
    const cfg = getRunpodConfig({
      RUNPOD_API_KEY: 'k',
      RUNPOD_ENDPOINT_ID: 'g',
    })
    expect(cfg).toEqual({
      apiKey: 'k',
      endpoints: { gpu: 'g' },
      defaultTier: 'gpu',
      baseUrl: 'https://api.runpod.ai/v2',
    })
  })

  it('reads both tiers and defaults to gpu', () => {
    const cfg = getRunpodConfig({
      RUNPOD_API_KEY: 'k',
      RUNPOD_ENDPOINT_ID_GPU: 'g',
      RUNPOD_ENDPOINT_ID_CPU: 'c',
    })
    expect(cfg?.endpoints).toEqual({ gpu: 'g', cpu: 'c' })
    expect(cfg?.defaultTier).toBe('gpu')
  })

  it('defaults to cpu when only the cpu endpoint is set', () => {
    const cfg = getRunpodConfig({
      RUNPOD_API_KEY: 'k',
      RUNPOD_ENDPOINT_ID_CPU: 'c',
    })
    expect(cfg?.endpoints).toEqual({ cpu: 'c' })
    expect(cfg?.defaultTier).toBe('cpu')
  })

  it('trims trailing slashes from an overridden base url', () => {
    const cfg = getRunpodConfig({
      RUNPOD_API_KEY: 'k',
      RUNPOD_ENDPOINT_ID_GPU: 'g',
      RUNPOD_BASE_URL: 'https://example.test/v2///',
    })
    expect(cfg?.baseUrl).toBe('https://example.test/v2')
  })
})

// ── endpointFor / resolveTier ───────────────────────────────────

describe('endpointFor / resolveTier', () => {
  it('returns the endpoint id for a configured tier, else null', () => {
    expect(endpointFor(CFG, 'gpu')).toBe('ep-gpu')
    expect(endpointFor(CFG, 'cpu')).toBe('ep-cpu')
    expect(
      endpointFor({ ...CFG, endpoints: { gpu: 'ep-gpu' } }, 'cpu'),
    ).toBeNull()
  })

  it('falls back to the default tier when the requested one is absent', () => {
    const gpuOnly: RunpodConfig = { ...CFG, endpoints: { gpu: 'ep-gpu' } }
    expect(resolveTier(gpuOnly, 'cpu')).toBe('gpu')
    expect(resolveTier(CFG, 'cpu')).toBe('cpu')
    expect(resolveTier(CFG, 'gpu')).toBe('gpu')
  })
})

// ── session id <-> {tier, job id} ───────────────────────────────

describe('session id <-> {tier, jobId}', () => {
  it('round-trips tier + job id through the session id', () => {
    expect(toSessionId('gpu', 'job-xyz')).toBe('rp_gpu_job-xyz')
    expect(toSessionId('cpu', 'job-xyz')).toBe('rp_cpu_job-xyz')
    expect(isRunpodSessionId('rp_gpu_job-xyz')).toBe(true)
    expect(parseSession('rp_gpu_job-xyz')).toEqual({
      tier: 'gpu',
      jobId: 'job-xyz',
    })
    expect(parseSession('rp_cpu_a-b-c')).toEqual({
      tier: 'cpu',
      jobId: 'a-b-c',
    })
  })

  it('rejects non-RunPod, untiered, and empty session ids', () => {
    expect(isRunpodSessionId('abc')).toBe(false)
    expect(parseSession('abc')).toBeNull()
    expect(parseSession('rp_job-xyz')).toBeNull() // no tier segment
    expect(parseSession('rp_gpu_')).toBeNull() // empty job id
  })
})

// ── requestedRunpodTier ─────────────────────────────────────────

describe('requestedRunpodTier', () => {
  it('maps the opt-in header to a tier (case-insensitive)', () => {
    const gpu = new Request('https://x.test/api/uvr/process', {
      headers: { 'X-UVR-Provider': 'RunPod' },
    })
    expect(requestedRunpodTier(gpu, new URL(gpu.url))).toBe('gpu')

    const gpu2 = new Request('https://x.test/api/uvr/process', {
      headers: { 'X-UVR-Provider': 'runpod-gpu' },
    })
    expect(requestedRunpodTier(gpu2, new URL(gpu2.url))).toBe('gpu')

    const cpu = new Request('https://x.test/api/uvr/process', {
      headers: { 'X-UVR-Provider': 'runpod-cpu' },
    })
    expect(requestedRunpodTier(cpu, new URL(cpu.url))).toBe('cpu')
  })

  it('maps the opt-in query param to a tier', () => {
    const req = new Request(
      'https://x.test/api/uvr/process?provider=runpod-cpu',
    )
    expect(requestedRunpodTier(req, new URL(req.url))).toBe('cpu')
  })

  it('is null without an opt-in signal', () => {
    const req = new Request('https://x.test/api/uvr/process')
    expect(requestedRunpodTier(req, new URL(req.url))).toBeNull()
  })
})

// ── buildJobInput ───────────────────────────────────────────────

describe('buildJobInput', () => {
  it('applies defaults', () => {
    const input = buildJobInput({ audioBase64: 'AAAA' })
    expect(input.model).toBe('UVR-MDX-NET-Inst_HQ_3')
    expect(input.output_format).toBe('FLAC')
    expect(input.stems).toEqual(['vocal', 'instrumental'])
    expect(input.filename).toBe('input')
    expect(input.audio_base64).toBe('AAAA')
    expect(input.audio_url).toBeUndefined()
  })

  it('prefers a url over base64 and upper-cases the format', () => {
    const input = buildJobInput({
      audioUrl: 'https://r2.test/song.mp3',
      audioBase64: 'AAAA',
      output_format: 'wav',
      filename: 'song.mp3',
    })
    expect(input.audio_url).toBe('https://r2.test/song.mp3')
    expect(input.audio_base64).toBeUndefined()
    expect(input.output_format).toBe('WAV')
  })
})

// ── mapStatusToResponse ─────────────────────────────────────────

describe('mapStatusToResponse', () => {
  it('maps a completed job to files + 100% progress', () => {
    const rp: RunpodStatus = {
      status: 'COMPLETED',
      output: {
        stems: [
          {
            stem: 'vocal',
            filename: 'v.flac',
            url: 'https://r2/v',
            size: 10,
            duration: 200,
          },
          { stem: 'instrumental', filename: 'i.flac', size: 20 },
        ],
      },
    }
    const res = mapStatusToResponse('rp_gpu_job1', rp)
    expect(res.status).toBe('completed')
    expect(res.progress).toBe(100)
    expect(res.files).toHaveLength(2)
    expect(res.files[0]).toEqual({
      stem: 'vocal',
      filename: 'v.flac',
      path: '/api/uvr/output/rp_gpu_job1/vocal',
      size: 10,
      duration: 200,
    })
  })

  it('maps a completed job whose handler reported an error to error', () => {
    const res = mapStatusToResponse('rp_gpu_job1', {
      status: 'COMPLETED',
      output: { error: 'separation produced no output stems' },
    })
    expect(res.status).toBe('error')
    expect(res.error).toBe('separation produced no output stems')
    expect(res.files).toEqual([])
  })

  it('maps a completed job with no stems to error (not a silent success)', () => {
    expect(
      mapStatusToResponse('rp_gpu_job1', { status: 'COMPLETED' }).status,
    ).toBe('error')
    const res = mapStatusToResponse('rp_gpu_job1', {
      status: 'COMPLETED',
      output: { stems: [] },
    })
    expect(res.status).toBe('error')
    expect(res.error).toBe('RunPod job completed without output stems')
  })

  it.each(['FAILED', 'CANCELLED', 'TIMED_OUT'])(
    'maps terminal state %s to error',
    (state) => {
      const res = mapStatusToResponse('rp_gpu_job1', {
        status: state,
        error: 'boom',
      })
      expect(res.status).toBe('error')
      expect(res.error).toBe('boom')
    },
  )

  it('maps queued/running to processing with an estimate', () => {
    const queued = mapStatusToResponse('rp_gpu_job1', { status: 'IN_QUEUE' })
    expect(queued.status).toBe('processing')
    expect(queued.estimated_total_secs).toBe(180)
    expect(queued.progress).toBeUndefined()
    expect(queued.message).toBe('Queued')

    const running = mapStatusToResponse('rp_gpu_job1', {
      status: 'IN_PROGRESS',
    })
    expect(running.status).toBe('processing')
    expect(running.message).toBe('Processing')
  })

  it('treats an unknown state as still processing', () => {
    expect(mapStatusToResponse('rp_gpu_job1', { status: 'WAT' }).status).toBe(
      'processing',
    )
    expect(mapStatusToResponse('rp_gpu_job1', {}).status).toBe('processing')
  })
})

// ── findStemOutput ──────────────────────────────────────────────

describe('findStemOutput', () => {
  const out = {
    stems: [
      { stem: 'vocal', filename: 'song_(Vocals).flac', url: 'u1' },
      { stem: 'instrumental', filename: 'song_(Instrumental).flac', url: 'u2' },
    ],
  }

  it('finds by stem type', () => {
    expect(findStemOutput(out, 'vocal')?.url).toBe('u1')
    expect(findStemOutput(out, 'INSTRUMENTAL')?.url).toBe('u2')
  })

  it('finds by exact filename', () => {
    expect(findStemOutput(out, 'song_(Instrumental).flac')?.url).toBe('u2')
  })

  it('returns null when absent', () => {
    expect(findStemOutput(out, 'drums')).toBeNull()
    expect(findStemOutput(undefined, 'vocal')).toBeNull()
  })
})

// ── small helpers ───────────────────────────────────────────────

describe('contentTypeForFilename', () => {
  it('maps known extensions', () => {
    expect(contentTypeForFilename('a.mp3')).toBe('audio/mpeg')
    expect(contentTypeForFilename('a.flac')).toBe('audio/flac')
    expect(contentTypeForFilename('a.wav')).toBe('audio/wav')
    expect(contentTypeForFilename('noext')).toBe('audio/wav')
  })
})

describe('base64ToBytes', () => {
  it('decodes base64 to the original bytes', () => {
    const b64 = globalThis.btoa('hello')
    expect(Array.from(base64ToBytes(b64))).toEqual([104, 101, 108, 108, 111])
  })
})

describe('bytesToBase64', () => {
  it('round-trips through base64ToBytes, including across the chunk boundary', () => {
    const bytes = new Uint8Array(0x8000 + 5)
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(
      Array.from(bytes),
    )
  })
})

describe('runpodEndpointUrl / runpodHeaders', () => {
  it('builds endpoint urls for a given endpoint id', () => {
    expect(runpodEndpointUrl(CFG, 'ep-gpu', '/run')).toBe(
      'https://api.runpod.ai/v2/ep-gpu/run',
    )
    expect(runpodEndpointUrl(CFG, 'ep-cpu', '/status/j1')).toBe(
      'https://api.runpod.ai/v2/ep-cpu/status/j1',
    )
  })

  it('builds bearer headers', () => {
    expect(runpodHeaders(CFG)).toEqual({
      Authorization: 'Bearer key-123',
      'Content-Type': 'application/json',
    })
  })
})

// ── fetch wrappers ──────────────────────────────────────────────

describe('fetch wrappers', () => {
  it('submitJob posts the input to the given endpoint and returns the job id', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'job-1', status: 'IN_QUEUE' }),
    } as Response)

    const res = await submitJob(
      CFG,
      'ep-cpu',
      buildJobInput({ audioBase64: 'AAAA' }),
    )
    expect(res.id).toBe('job-1')

    const [calledUrl, init] = spy.mock.calls[0]
    expect(calledUrl).toBe('https://api.runpod.ai/v2/ep-cpu/run')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toHaveProperty(
      'input.audio_base64',
      'AAAA',
    )
  })

  it('submitJob throws on a non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    } as Response)
    await expect(
      submitJob(CFG, 'ep-gpu', buildJobInput({ audioBase64: 'A' })),
    ).rejects.toThrow('RunPod submit failed: 500 Server Error')
  })

  it('fetchJobStatus throws on a non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response)
    await expect(fetchJobStatus(CFG, 'ep-gpu', 'job-1')).rejects.toThrow(
      'RunPod status failed: 404 Not Found',
    )
  })
})
