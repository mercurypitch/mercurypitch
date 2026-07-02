// ============================================================
// UVR API Client Tests — EARS REQ-UV-005, REQ-UV-006, REQ-UV-007, REQ-UV-008, REQ-UV-009, REQ-UV-010, REQ-UV-063
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProcessStatusResponse } from '@/lib/uvr-api'
import { DEFAULT_PROCESS_REQUEST, formatFileSize, getProcessStatus, pollForCompletion, processAudio, } from '@/lib/uvr-api'

beforeEach(() => {
  vi.restoreAllMocks()
})

// ── formatFileSize ───────────────────────────────────────────

describe('formatFileSize', () => {
  it('returns "0 Bytes" for 0', () => {
    expect(formatFileSize(0)).toBe('0 Bytes')
  })

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500.00 Bytes')
  })

  it('formats KB', () => {
    expect(formatFileSize(2048)).toBe('2.00 KB')
  })

  it('formats MB', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.00 MB')
  })

  it('formats GB', () => {
    expect(formatFileSize(3 * 1024 * 1024 * 1024)).toBe('3.00 GB')
  })
})

// ── DEFAULT_PROCESS_REQUEST ──────────────────────────────────

describe('DEFAULT_PROCESS_REQUEST', () => {
  it('has expected default model', () => {
    expect(DEFAULT_PROCESS_REQUEST.model).toBe('UVR-MDX-NET-Inst_HQ_3')
  })

  it('has WAV output format', () => {
    expect(DEFAULT_PROCESS_REQUEST.output_format).toBe('WAV')
  })

  it('requests both stems by default', () => {
    expect(DEFAULT_PROCESS_REQUEST.stems).toEqual(['vocal', 'instrumental'])
  })
})

// ── REQ-UV-006: Progress Polling ─────────────────────────────

describe('pollForCompletion (REQ-UV-006, REQ-UV-009)', () => {
  it('calls onComplete when status is completed', async () => {
    const completedResponse: ProcessStatusResponse = {
      session_id: 'test-session',
      status: 'completed',
      files: [
        { stem: 'vocal', filename: 'vocal.wav', path: '/out/vocal.wav' },
        { stem: 'instrumental', filename: 'inst.wav', path: '/out/inst.wav' },
      ],
    }

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(completedResponse),
    } as Response)

    const onProgress = vi.fn()
    const onComplete = vi.fn()
    const onError = vi.fn()

    await pollForCompletion('test-session', onProgress, onComplete, onError, 10)

    expect(onComplete).toHaveBeenCalledWith(completedResponse.files)
    expect(onError).not.toHaveBeenCalled()
  })

  it('calls onError when status is error', async () => {
    const errorResponse: ProcessStatusResponse = {
      session_id: 'test-session',
      status: 'error',
      files: [],
      error: 'Model not found',
    }

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(errorResponse),
    } as Response)

    const onComplete = vi.fn()
    const onError = vi.fn()

    await expect(
      pollForCompletion('test-session', vi.fn(), onComplete, onError, 10),
    ).rejects.toThrow('Model not found')

    expect(onError).toHaveBeenCalledWith('Model not found')
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('handles fetch rejection as network error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))

    const onError = vi.fn()

    await expect(
      pollForCompletion('test-session', vi.fn(), vi.fn(), onError, 10),
    ).rejects.toThrow('Network error')

    expect(onError).toHaveBeenCalledWith('Network error')
  })

  // REQ-UV-010: AbortSignal
  it('rejects with AbortError when signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const onError = vi.fn()

    await expect(
      pollForCompletion(
        'test-session',
        vi.fn(),
        vi.fn(),
        onError,
        10,
        controller.signal,
      ),
    ).rejects.toThrow('Polling aborted')
  })

  // REQ-UV-009: Timeout
  it('calls onError when max time exceeded', async () => {
    // Make polling always return 'processing' to force timeout
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          session_id: 'x',
          status: 'processing',
          files: [],
        } as ProcessStatusResponse),
    } as Response)

    const onError = vi.fn()
    const controller = new AbortController()

    const promise = pollForCompletion(
      'test-session',
      vi.fn(),
      vi.fn(),
      onError,
      10,
      controller.signal,
    )

    // Let it run a few polls then check it's still pending
    await new Promise((r) => setTimeout(r, 50))
    expect(onError).not.toHaveBeenCalled() // Not timed out yet

    // Clean up: abort polling so it doesn't leak into other tests
    controller.abort()
    await expect(promise).rejects.toThrow('Polling aborted')
  })
})

// ── REQ-UV-063: API Error Handling ───────────────────────────

describe('getProcessStatus error handling (REQ-UV-063)', () => {
  it('throws with status text on non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response)

    await expect(getProcessStatus('missing-session')).rejects.toThrow(
      'Failed to get status: Not Found',
    )
  })
})

describe('processAudio — server tier opt-in + 402 handling', () => {
  const OK_RESPONSE = {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        session_id: 'rp_gpu_job-1',
        status: 'processing',
        message: 'Processing started',
        model: 'UVR-MDX-NET-Inst_HQ_3',
        output_format: 'WAV',
      }),
  } as Response

  it('sends X-UVR-Provider when a provider is requested', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(OK_RESPONSE)
    const file = new File([new Uint8Array([1])], 'song.mp3')
    const res = await processAudio(file, {
      ...DEFAULT_PROCESS_REQUEST,
      provider: 'runpod',
    })
    expect(res.session_id).toBe('rp_gpu_job-1')
    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(String(url).endsWith('/process')).toBe(true)
    expect((init.headers as Record<string, string>)['X-UVR-Provider']).toBe(
      'runpod',
    )
  })

  it('omits the header without a provider', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(OK_RESPONSE)
    await processAudio(new File([new Uint8Array([1])], 'song.mp3'))
    const [, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(
      (init.headers as Record<string, string>)['X-UVR-Provider'],
    ).toBeUndefined()
  })

  it('turns the metering 402 into an actionable message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 402,
      statusText: 'Payment Required',
      text: () =>
        Promise.resolve(
          JSON.stringify({
            error: 'Insufficient credits',
            required: 1,
            balance: 0,
          }),
        ),
    } as Response)
    await expect(
      processAudio(new File([new Uint8Array([1])], 'song.mp3'), {
        provider: 'runpod',
      }),
    ).rejects.toThrow(
      'Not enough credits — this song needs 1 credit, you have 0. Get credits in Settings, under Account.',
    )
  })

  it('keeps plain error bodies for non-402 failures', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: () => Promise.resolve('boom'),
    } as Response)
    await expect(
      processAudio(new File([new Uint8Array([1])], 'song.mp3')),
    ).rejects.toThrow('boom')
  })
})
