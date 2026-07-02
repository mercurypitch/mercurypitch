// ============================================================
// UVR metering — debit/refund client tests (mocked fetch)
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MeteringConfig } from '@/lib/uvr-metering'
import { debitForJob, getMeteringConfig, refundJob } from '@/lib/uvr-metering'

const CFG: MeteringConfig = { baseUrl: 'https://db.test' }
const KEYED: MeteringConfig = { baseUrl: 'https://db.test', serviceKey: 'svc' }

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getMeteringConfig', () => {
  it('is null without DB_API_URL', () => {
    expect(getMeteringConfig({})).toBeNull()
    expect(getMeteringConfig({ DB_API_URL: '' })).toBeNull()
  })

  it('strips trailing slashes and picks up the service key', () => {
    expect(
      getMeteringConfig({
        DB_API_URL: 'https://db.test//',
        BILLING_SERVICE_KEY: 'svc',
      }),
    ).toEqual({ baseUrl: 'https://db.test', serviceKey: 'svc' })
  })

  it('omits an empty service key', () => {
    expect(
      getMeteringConfig({
        DB_API_URL: 'https://db.test',
        BILLING_SERVICE_KEY: '',
      }),
    ).toEqual({ baseUrl: 'https://db.test' })
  })
})

describe('debitForJob', () => {
  it('POSTs tier + jobRef with the forwarded Authorization', async () => {
    const spy = mockFetch({ debited: 2, balance: 8 })
    const verdict = await debitForJob(CFG, 'Bearer tok', 'gpu', 'rp_gpu_j1')
    expect(verdict.allowed).toBe(true)
    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://db.test/api/billing/debit')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer tok',
    )
    expect(JSON.parse(init.body as string)).toEqual({
      tier: 'gpu',
      jobRef: 'rp_gpu_j1',
    })
  })

  it('omits the Authorization header when absent', async () => {
    const spy = mockFetch({ debited: 0 })
    await debitForJob(CFG, null, 'cpu', 'rp_cpu_j1')
    const [, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined()
  })

  it('maps a 402 to allowed=false with the refusal details', async () => {
    mockFetch(
      { error: 'Insufficient credits', required: 3, balance: 1 },
      false,
      402,
    )
    const verdict = await debitForJob(CFG, 'Bearer tok', 'gpu', 'rp_gpu_j1')
    expect(verdict).toEqual({
      allowed: false,
      status: 402,
      error: 'Insufficient credits',
      required: 3,
      balance: 1,
    })
  })

  it('fails open on server errors', async () => {
    mockFetch({ error: 'boom' }, false, 500)
    const verdict = await debitForJob(CFG, 'Bearer tok', 'gpu', 'rp_gpu_j1')
    expect(verdict.allowed).toBe(true)
  })

  it('fails open when the db-worker is unreachable', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('down'))
    const verdict = await debitForJob(CFG, 'Bearer tok', 'gpu', 'rp_gpu_j1')
    expect(verdict.allowed).toBe(true)
  })
})

describe('refundJob', () => {
  it('no-ops without a service key', async () => {
    const spy = mockFetch({ refunded: 0 })
    await refundJob(CFG, 'rp_gpu_j1')
    expect(spy).not.toHaveBeenCalled()
  })

  it('POSTs the jobRef with X-Service-Key', async () => {
    const spy = mockFetch({ refunded: 2 })
    await refundJob(KEYED, 'rp_gpu_j1')
    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://db.test/api/billing/refund')
    expect((init.headers as Record<string, string>)['X-Service-Key']).toBe(
      'svc',
    )
    expect(JSON.parse(init.body as string)).toEqual({ jobRef: 'rp_gpu_j1' })
  })

  it('swallows transport errors', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('down'))
    await expect(refundJob(KEYED, 'rp_gpu_j1')).resolves.toBeUndefined()
  })
})
