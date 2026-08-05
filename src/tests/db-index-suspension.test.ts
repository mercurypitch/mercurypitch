import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handleAuthErrorResponse: vi.fn(),
  requireAuth: vi.fn(async () => true),
  restoreAuth: vi.fn(async () => true),
  getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer test' })),
  serverConfig: null as {
    beforeWrite?: () => Promise<boolean>
    onErrorResponse?: (status: number, body: string) => void
  } | null,
}))

vi.mock('@/lib/defaults', () => ({
  API_BASE_URL: 'https://api.test',
}))

vi.mock('@/db/services/auth-service', () => ({
  handleAuthErrorResponse: mocks.handleAuthErrorResponse,
  requireAuth: mocks.requireAuth,
  restoreAuth: mocks.restoreAuth,
}))

vi.mock('@/db/services/user-service', () => ({
  getAuthHeaders: mocks.getAuthHeaders,
}))

vi.mock('@/db/adapters/server-adapter', () => ({
  ServerAdapter: class ServerAdapter {
    constructor(config: NonNullable<typeof mocks.serverConfig>) {
      mocks.serverConfig = config
    }
  },
}))

vi.mock('@/db/adapters/dexie-adapter', () => ({
  DexieAdapter: class DexieAdapter {},
}))

vi.mock('@/db/adapters/hybrid-adapter', () => ({
  HybridAdapter: class HybridAdapter {
    constructor(
      readonly server: unknown,
      readonly local: unknown,
    ) {}
  },
}))

vi.mock('@/db/seed', () => ({ seedAll: vi.fn() }))

import { createDatabase } from '@/db'

describe('database suspension response wiring', () => {
  it('routes every server-adapter error through the auth state handler', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    await createDatabase()

    expect(mocks.restoreAuth).toHaveBeenCalledOnce()
    expect(mocks.serverConfig?.beforeWrite).toBe(mocks.requireAuth)

    const body = JSON.stringify({
      error: 'This account is suspended.',
      code: 'account_suspended',
    })
    mocks.serverConfig?.onErrorResponse?.(403, body)
    expect(mocks.handleAuthErrorResponse).toHaveBeenCalledWith(403, body)
    infoSpy.mockRestore()
  })
})
