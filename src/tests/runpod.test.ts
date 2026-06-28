// ============================================================
// RunPod bridge — unit tests for the pure FastAPI<->RunPod mappers
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunpodConfig, RunpodStatus } from '@/lib/runpod'
import { base64ToBytes, buildJobInput, bytesToBase64, contentTypeForFilename, fetchJobStatus, findStemOutput, getRunpodConfig, isRunpodSessionId, mapStatusToResponse, parseJobId, runpodEndpointUrl, runpodHeaders, submitJob, toSessionId, wantsRunpod, } from '@/lib/runpod'

const CFG: RunpodConfig = {
  apiKey: 'key-123',
  endpointId: 'ep-abc',
  baseUrl: 'https://api.runpod.ai/v2',
}

beforeEach(() => {
  vi.restoreAllMocks()
})

// ── getRunpodConfig ─────────────────────────────────────────────

describe('getRunpodConfig', () => {
  it('returns null when key or endpoint is missing', () => {
    expect(getRunpodConfig({})).toBeNull()
    expect(getRunpodConfig({ RUNPOD_API_KEY: 'k' })).toBeNull()
    expect(getRunpodConfig({ RUNPOD_ENDPOINT_ID: 'e' })).toBeNull()
    expect(
      getRunpodConfig({ RUNPOD_API_KEY: '', RUNPOD_ENDPOINT_ID: 'e' }),
    ).toBeNull()
  })

  it('returns config when both are present, with the default base url', () => {
    const cfg = getRunpodConfig({
      RUNPOD_API_KEY: 'k',
      RUNPOD_ENDPOINT_ID: 'e',
    })
    expect(cfg).toEqual({
      apiKey: 'k',
      endpointId: 'e',
      baseUrl: 'https://api.runpod.ai/v2',
    })
  })

  it('trims trailing slashes from an overridden base url', () => {
    const cfg = getRunpodConfig({
      RUNPOD_API_KEY: 'k',
      RUNPOD_ENDPOINT_ID: 'e',
      RUNPOD_BASE_URL: 'https://example.test/v2///',
    })
    expect(cfg?.baseUrl).toBe('https://example.test/v2')
  })
})

// ── session id <-> job id ───────────────────────────────────────

describe('session id <-> job id', () => {
  it('round-trips a job id through the session id', () => {
    const sid = toSessionId('job-xyz')
    expect(sid).toBe('rp_job-xyz')
    expect(isRunpodSessionId(sid)).toBe(true)
    expect(parseJobId(sid)).toBe('job-xyz')
  })

  it('rejects non-RunPod and empty session ids', () => {
    expect(isRunpodSessionId('abc')).toBe(false)
    expect(parseJobId('abc')).toBeNull()
    expect(parseJobId('rp_')).toBeNull()
  })
})

// ── wantsRunpod ─────────────────────────────────────────────────

describe('wantsRunpod', () => {
  it('detects the opt-in header (case-insensitive)', () => {
    const req = new Request('https://x.test/api/uvr/process', {
      headers: { 'X-UVR-Provider': 'RunPod' },
    })
    expect(wantsRunpod(req, new URL(req.url))).toBe(true)
  })

  it('detects the opt-in query param', () => {
    const req = new Request('https://x.test/api/uvr/process?provider=runpod')
    expect(wantsRunpod(req, new URL(req.url))).toBe(true)
  })

  it('is false without an opt-in signal', () => {
    const req = new Request('https://x.test/api/uvr/process')
    expect(wantsRunpod(req, new URL(req.url))).toBe(false)
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
    const res = mapStatusToResponse('rp_job1', rp)
    expect(res.status).toBe('completed')
    expect(res.progress).toBe(100)
    expect(res.files).toHaveLength(2)
    expect(res.files[0]).toEqual({
      stem: 'vocal',
      filename: 'v.flac',
      path: '/api/uvr/output/rp_job1/vocal',
      size: 10,
      duration: 200,
    })
  })

  it('maps a completed job whose handler reported an error to error', () => {
    const res = mapStatusToResponse('rp_job1', {
      status: 'COMPLETED',
      output: { error: 'separation produced no output stems' },
    })
    expect(res.status).toBe('error')
    expect(res.error).toBe('separation produced no output stems')
    expect(res.files).toEqual([])
  })

  it.each(['FAILED', 'CANCELLED', 'TIMED_OUT'])(
    'maps terminal state %s to error',
    (state) => {
      const res = mapStatusToResponse('rp_job1', {
        status: state,
        error: 'boom',
      })
      expect(res.status).toBe('error')
      expect(res.error).toBe('boom')
    },
  )

  it('maps queued/running to processing with an estimate', () => {
    const queued = mapStatusToResponse('rp_job1', { status: 'IN_QUEUE' })
    expect(queued.status).toBe('processing')
    expect(queued.estimated_total_secs).toBe(180)
    expect(queued.progress).toBeUndefined()
    expect(queued.message).toBe('Queued')

    const running = mapStatusToResponse('rp_job1', { status: 'IN_PROGRESS' })
    expect(running.status).toBe('processing')
    expect(running.message).toBe('Processing')
  })

  it('treats an unknown state as still processing', () => {
    expect(mapStatusToResponse('rp_job1', { status: 'WAT' }).status).toBe(
      'processing',
    )
    expect(mapStatusToResponse('rp_job1', {}).status).toBe('processing')
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
  it('builds endpoint urls', () => {
    expect(runpodEndpointUrl(CFG, '/run')).toBe(
      'https://api.runpod.ai/v2/ep-abc/run',
    )
    expect(runpodEndpointUrl(CFG, '/status/j1')).toBe(
      'https://api.runpod.ai/v2/ep-abc/status/j1',
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
  it('submitJob posts the input and returns the job id', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'job-1', status: 'IN_QUEUE' }),
    } as Response)

    const res = await submitJob(CFG, buildJobInput({ audioBase64: 'AAAA' }))
    expect(res.id).toBe('job-1')

    const [calledUrl, init] = spy.mock.calls[0]
    expect(calledUrl).toBe('https://api.runpod.ai/v2/ep-abc/run')
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
      submitJob(CFG, buildJobInput({ audioBase64: 'A' })),
    ).rejects.toThrow('RunPod submit failed: 500 Server Error')
  })

  it('fetchJobStatus throws on a non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response)
    await expect(fetchJobStatus(CFG, 'job-1')).rejects.toThrow(
      'RunPod status failed: 404 Not Found',
    )
  })
})
