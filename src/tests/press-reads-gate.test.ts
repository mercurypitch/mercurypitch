// ============================================================
// Reads a press sends: through the gate while the API is out of reach
// ============================================================
//
// Inside the window after an unanswered request, an ordinary call is
// refused before it is sent (api-reachability.ts). Each read below is also
// what a Check again or Retry check sends; as the person's press it goes.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { admitApiCall, apiDidNotAnswer } from '@/db/api-reachability'
import { fetchBillingMe, fetchPricing } from '@/db/services/billing-service'
import { fetchPerksMe } from '@/lib/backgrounds/background-access'

const API = 'http://api.test'

type Asked = { userAction?: boolean }

const reads: ReadonlyArray<
  readonly [string, (options: Asked) => Promise<unknown>]
> = [
  ['balance', (options) => fetchBillingMe(API, undefined, options)],
  [
    'pricing',
    (options) => fetchPricing(API, undefined, options).catch(() => null),
  ],
  ['supporter perks', (options) => fetchPerksMe(API, options)],
]

/** One ordinary call that got no answer: the window opens. */
function closeGate(): void {
  const admission = admitApiCall('call')
  if (admission === null) throw new Error('the gate was already closed')
  apiDidNotAnswer(admission)
}

let network: ReturnType<typeof vi.fn>

beforeEach(() => {
  network = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
  vi.stubGlobal('fetch', network)
})

describe.each(reads)('the %s read', (_name, read) => {
  it('is not sent when the page asks inside the window', async () => {
    closeGate()
    await read({})
    expect(network).not.toHaveBeenCalled()
  })

  it('is sent when a person asked for it', async () => {
    closeGate()
    await read({ userAction: true })
    expect(network).toHaveBeenCalledTimes(1)
  })
})
