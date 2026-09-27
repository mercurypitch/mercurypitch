// ============================================================
// Where a native build asks for separation (plan S8, Stage 2)
// ============================================================
//
// The web asks its own origin: `/api/uvr` resolves against the page, and the
// page is on the worker that serves it. A native page is on
// capacitor://localhost, where `/api/uvr` is nothing at all, so the build
// compiles in the web host that goes with its worker and every call names it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  IS_NATIVE_BUILD: true,
  CAN_TAKE_PAYMENT: false,
  UVR_ORIGIN: 'https://dev.mercurypitch.com',
}))
vi.mock('@/db/services/auth-service', () => ({
  requireAuth: async () => Promise.resolve(),
  hasValidToken: () => true,
}))
vi.mock('@/db/services/user-service', () => ({
  getAuthToken: () => 'a-token',
}))

import { DEFAULT_PROCESS_REQUEST, deleteSession, getOutputFile, getProcessStatus, healthCheck, listModels, processAudio, } from '@/lib/uvr-api'

const answer = (body: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  }) as Response

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('a native build', () => {
  it('asks the host that goes with its worker, for every call', async () => {
    const fetches = vi
      .spyOn(global, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input)
        if (url.endsWith('/models')) return answer({ models: ['roformer'] })
        if (url.endsWith('/health')) {
          return answer({ status: 'ok', version: '1' })
        }
        if (url.endsWith('/process')) {
          return answer({
            session_id: 'rp_gpu_job-1',
            status: 'processing',
            message: 'Processing started',
            model: 'roformer',
            output_format: 'M4A',
          })
        }
        if (url.includes('/session/')) {
          return answer({ status: 'deleted', message: 'gone' })
        }
        return answer({
          session_id: 'rp_gpu_job-1',
          status: 'processing',
          files: [],
        })
      })

    await listModels()
    await processAudio(new File([new Uint8Array([1])], 'song.m4a'), {
      provider: 'runpod',
    })
    await getProcessStatus('rp_gpu_job-1')
    await getOutputFile('rp_gpu_job-1', 'vocal.m4a')
    await deleteSession('rp_gpu_job-1')
    await healthCheck()

    expect(fetches.mock.calls.map(([input]) => String(input))).toEqual([
      'https://dev.mercurypitch.com/api/uvr/models',
      'https://dev.mercurypitch.com/api/uvr/process',
      'https://dev.mercurypitch.com/api/uvr/status/rp_gpu_job-1',
      'https://dev.mercurypitch.com/api/uvr/output/rp_gpu_job-1/vocal.m4a',
      'https://dev.mercurypitch.com/api/uvr/session/rp_gpu_job-1',
      'https://dev.mercurypitch.com/api/uvr/health',
    ])
  })
})

describe('what a native build asks the server for', () => {
  it('asks for AAC in M4A, which a phone keeps and decodes (plan S8 §7)', () => {
    expect(DEFAULT_PROCESS_REQUEST.output_format).toBe('M4A')
  })
})

/** An XMLHttpRequest the test drives: progress, then an answer. */
class FakeXhr {
  static last: FakeXhr | null = null
  readonly upload: { onprogress: ((e: ProgressEvent) => void) | null } = {
    onprogress: null,
  }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  status = 0
  statusText = ''
  responseText = ''
  method = ''
  url = ''
  headers: Record<string, string> = {}
  body: unknown = null
  aborted = false

  constructor() {
    FakeXhr.last = this
  }

  open(method: string, url: string): void {
    this.method = method
    this.url = url
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value
  }

  getResponseHeader(name: string): string | null {
    return name.toLowerCase() === 'content-type' ? 'application/json' : null
  }

  send(body: unknown): void {
    this.body = body
  }

  abort(): void {
    this.aborted = true
    this.onabort?.()
  }

  progress(loaded: number, total: number): void {
    this.upload.onprogress?.({
      lengthComputable: true,
      loaded,
      total,
    } as ProgressEvent)
  }

  answer(status: number, body: unknown): void {
    this.status = status
    this.responseText = JSON.stringify(body)
    this.onload?.()
  }
}

describe('sending a song with its progress', () => {
  beforeEach(() => {
    FakeXhr.last = null
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports how much has been sent, and reads the answer', async () => {
    const sent: number[] = []
    const pending = processAudio(
      new File([new Uint8Array([1, 2, 3])], 'song.m4a'),
      { ...DEFAULT_PROCESS_REQUEST, provider: 'runpod', duration_seconds: 200 },
      undefined,
      (share) => sent.push(share),
    )
    await vi.waitFor(() => expect(FakeXhr.last?.body).toBeInstanceOf(FormData))
    const xhr = FakeXhr.last as FakeXhr

    xhr.progress(25, 100)
    xhr.progress(100, 100)
    xhr.answer(200, {
      session_id: 'rp_gpu_job-2',
      status: 'processing',
      message: 'Processing started',
      model: 'roformer',
      output_format: 'M4A',
    })

    await expect(pending).resolves.toMatchObject({ session_id: 'rp_gpu_job-2' })
    expect(sent).toEqual([0.25, 1])
    expect([xhr.method, xhr.url]).toEqual([
      'POST',
      'https://dev.mercurypitch.com/api/uvr/process',
    ])
    expect(xhr.headers).toMatchObject({
      Authorization: 'Bearer a-token',
      'X-UVR-Provider': 'runpod',
      'X-UVR-Duration-Seconds': '200',
      'X-UVR-Model': 'roformer',
    })
    expect((xhr.body as FormData).get('output_format')).toBe('M4A')
  })

  it('keeps the status of a refusal, for the queue to act on', async () => {
    const pending = processAudio(
      new File([new Uint8Array([1])], 'song.m4a'),
      { provider: 'runpod' },
      undefined,
      () => undefined,
    )
    await vi.waitFor(() => expect(FakeXhr.last).not.toBeNull())

    FakeXhr.last?.answer(402, {
      error: 'Not enough credits',
      required: 1,
      balance: 0,
    })

    await expect(pending).rejects.toMatchObject({ status: 402 })
  })

  it('is stopped by its signal', async () => {
    const stop = new AbortController()
    const pending = processAudio(
      new File([new Uint8Array([1])], 'song.m4a'),
      { provider: 'runpod' },
      stop.signal,
      () => undefined,
    )
    await vi.waitFor(() => expect(FakeXhr.last).not.toBeNull())

    stop.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(FakeXhr.last?.aborted).toBe(true)
  })

  it('takes an answer with no status for no answer at all', async () => {
    const pending = processAudio(
      new File([new Uint8Array([1])], 'song.m4a'),
      { provider: 'runpod' },
      undefined,
      () => undefined,
    )
    await vi.waitFor(() => expect(FakeXhr.last).not.toBeNull())

    FakeXhr.last?.answer(0, {})

    await expect(pending).rejects.toBeInstanceOf(TypeError)
  })

  it('says a dropped connection is one', async () => {
    const pending = processAudio(
      new File([new Uint8Array([1])], 'song.m4a'),
      { provider: 'runpod' },
      undefined,
      () => undefined,
    )
    await vi.waitFor(() => expect(FakeXhr.last).not.toBeNull())

    FakeXhr.last?.onerror?.()

    await expect(pending).rejects.toBeInstanceOf(TypeError)
  })
})
