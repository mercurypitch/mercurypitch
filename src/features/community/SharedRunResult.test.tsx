// Shared result views handle public reads, malformed links, and stale asynchronous requests without history writes.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharedSessionView } from '@/db/services/share-service'
import { loadPublicSharedSession } from '@/db/services/share-service'
import { encodeSharedRunResult } from '@/lib/shared-run-result'
import type { SharedRunRequest } from './shared-run-link'
import { SharedRunResult } from './SharedRunResult'

vi.mock('@/db/services/share-service', () => ({
  loadPublicSharedSession: vi.fn(),
}))
const summary = {
  name: 'Evening warm-up',
  author: 'Singer',
  results: [84, 92],
  date: 123456,
}
const row: SharedSessionView = {
  ...summary,
  id: 'shared-id',
  userId: 'owner',
  items: [],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
beforeEach(() => vi.mocked(loadPublicSharedSession).mockReset())
afterEach(cleanup)

describe('shared practice result', () => {
  it('renders an embedded summary as text without querying or writing any history', async () => {
    const onClose = vi.fn()
    render(() => (
      <SharedRunResult
        request={{
          kind: 'payload',
          payload: encodeSharedRunResult({
            ...summary,
            name: '<script>alert(1)</script>',
          })!,
        }}
        onClose={onClose}
      />
    ))
    expect(
      await screen.findByRole('heading', { name: '<script>alert(1)</script>' }),
    ).toBeInTheDocument()
    expect(screen.getByText('84%')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(
      screen.getByText(/does not add a run to your practice history/),
    ).toBeInTheDocument()
    expect(loadPublicSharedSession).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Back to Community' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('waits for a public row before rendering its scores', async () => {
    const read = deferred<SharedSessionView | null>()
    vi.mocked(loadPublicSharedSession).mockReturnValueOnce(read.promise)
    render(() => (
      <SharedRunResult
        request={{ kind: 'public', id: 'shared-id' }}
        onClose={vi.fn()}
      />
    ))
    expect(screen.getByRole('status')).toHaveTextContent('Loading result')
    read.resolve(row)
    expect(
      await screen.findByRole('heading', { name: summary.name }),
    ).toBeInTheDocument()
    expect(loadPublicSharedSession).toHaveBeenCalledWith('shared-id')
  })

  it.each(['broken', 'a'.repeat(8193)])(
    'shows unavailable for invalid payloads',
    async (payload) => {
      render(() => (
        <SharedRunResult
          request={{ kind: 'payload', payload }}
          onClose={vi.fn()}
        />
      ))
      expect(
        await screen.findByText(/This shared result is unavailable/),
      ).toBeInTheDocument()
      expect(loadPublicSharedSession).not.toHaveBeenCalled()
    },
  )

  it('shows unavailable for private or missing records', async () => {
    vi.mocked(loadPublicSharedSession).mockResolvedValue(null)
    render(() => (
      <SharedRunResult
        request={{ kind: 'public', id: 'missing' }}
        onClose={vi.fn()}
      />
    ))
    expect(
      await screen.findByText(/This shared result is unavailable/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('allows retry after a transport failure', async () => {
    vi.mocked(loadPublicSharedSession)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(row)
    render(() => (
      <SharedRunResult
        request={{ kind: 'public', id: 'shared-id' }}
        onClose={vi.fn()}
      />
    ))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load this result',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { name: summary.name }),
    ).toBeInTheDocument()
    expect(loadPublicSharedSession).toHaveBeenCalledTimes(2)
  })

  it('does not replace the next result when an older public request finishes late', async () => {
    const old = deferred<SharedSessionView | null>()
    vi.mocked(loadPublicSharedSession).mockReturnValueOnce(old.promise)
    const [request, setRequest] = createSignal<SharedRunRequest>({
      kind: 'public',
      id: 'old',
    })
    render(() => <SharedRunResult request={request()} onClose={vi.fn()} />)
    setRequest({
      kind: 'payload',
      payload: encodeSharedRunResult({ ...summary, name: 'Latest result' })!,
    })
    await screen.findByRole('heading', { name: 'Latest result' })
    old.resolve(row)
    await old.promise
    await Promise.resolve()
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: summary.name })).toBeNull(),
    )
    expect(
      screen.getByRole('heading', { name: 'Latest result' }),
    ).toBeInTheDocument()
  })
})
