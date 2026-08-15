// The UI-side half of REQ-DRV-021: when the durable cascade fails, the
// person gets told; when it lands, nothing shouts. Every component with
// a delete button routes through this helper, so this is where the
// warning is pinned.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({ deleteUvrSession: vi.fn() }))
vi.mock('@/stores/uvr-store', () => store)

const notify = vi.hoisted(() => ({ showNotification: vi.fn() }))
vi.mock('@/stores/notifications-store', () => notify)

import { deleteUvrSessionWithWarning } from '@/lib/uvr-delete'

describe('deleteUvrSessionWithWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('REQ-DRV-021: warns when the cascade fails, in words about a reload', async () => {
    store.deleteUvrSession.mockResolvedValue(false)

    const gone = await deleteUvrSessionWithWarning('s-1')

    expect(gone).toBe(false)
    expect(notify.showNotification).toHaveBeenCalledTimes(1)
    const [message, kind] = notify.showNotification.mock.calls[0] as [
      string,
      string,
    ]
    expect(kind).toBe('error')
    expect(message).toContain('did not fully delete')
    expect(message).toContain('reload')
  })

  it('stays quiet when the delete lands', async () => {
    store.deleteUvrSession.mockResolvedValue(true)

    const gone = await deleteUvrSessionWithWarning('s-1')

    expect(gone).toBe(true)
    expect(notify.showNotification).not.toHaveBeenCalled()
  })
})
