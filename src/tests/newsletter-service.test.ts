// ============================================================
// Saying yes or no to product updates
// ============================================================
//
// The one thing this call must get right is failing loudly. The Settings
// checkbox re-reads the profile and snaps back whenever this throws, so a
// swallowed error would leave a ticked box over a server that never agreed —
// a screen telling somebody they consented when they did not.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', () => ({ API_BASE_URL: 'https://api.test' }))
vi.mock('@/db/services/user-service', () => ({
  getAuthToken: vi.fn(() => 'token-123'),
}))

import { setNewsletterOptIn } from '@/db/services/newsletter-service'
import { getAuthToken } from '@/db/services/user-service'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthToken).mockReturnValue('token-123')
  fetchMock.mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetchMock)
})

describe('setNewsletterOptIn', () => {
  it('posts the answer as a boolean, with the session', async () => {
    await setNewsletterOptIn(true)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/newsletter/preference',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ optIn: true }),
      }),
    )
    const init = fetchMock.mock.calls[0][1] as {
      headers: Record<string, string>
    }
    expect(init.headers.Authorization).toBe('Bearer token-123')
  })

  it('sends a real false rather than dropping the field', async () => {
    await setNewsletterOptIn(false)
    const init = fetchMock.mock.calls[0][1] as { body: string }
    expect(JSON.parse(init.body)).toEqual({ optIn: false })
  })

  it('throws when the server refuses, so the checkbox can snap back', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 })
    await expect(setNewsletterOptIn(true)).rejects.toThrow(
      'Could not turn product updates on',
    )
  })

  it('throws without a session rather than posting nothing', async () => {
    vi.mocked(getAuthToken).mockReturnValue(null)
    await expect(setNewsletterOptIn(true)).rejects.toThrow('Not signed in')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
