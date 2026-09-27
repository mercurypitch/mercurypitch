// ============================================================
// Where a native build asks for separation (plan S8, Stage 2)
// ============================================================
//
// The web asks its own origin: `/api/uvr` resolves against the page, and the
// page is on the worker that serves it. A native page is on
// capacitor://localhost, where `/api/uvr` is nothing at all, so the build
// compiles in the web host that goes with its worker and every call names it.

import { beforeEach, describe, expect, it, vi } from 'vitest'
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

import { deleteSession, getOutputFile, getProcessStatus, healthCheck, listModels, processAudio, } from '@/lib/uvr-api'

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
