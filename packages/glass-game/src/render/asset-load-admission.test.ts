// Asset load admission — cancellation must not hide work that is still decoding.
import { expect, it, vi } from 'vitest'
import { withAssetLoadAdmission } from './asset-load-admission'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolved, rejected) => {
    resolve = resolved
    reject = rejected
  })
  return { promise, resolve, reject }
}

function outcome<T>(promise: Promise<T>) {
  return promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  )
}

it('keeps retired decode work admitted until its real cleanup settles', async () => {
  const old = new AbortController()
  const oldWork = [deferred(), deferred()]
  const retryWork = [deferred(), deferred()]
  const oldStarted = vi.fn()
  const retryStarted = vi.fn()
  const cleaned: number[] = []
  let running = 0
  let maximumRunning = 0
  const loads = oldWork.map((work, index) =>
    outcome(
      withAssetLoadAdmission(old.signal, async () => {
        oldStarted()
        running++
        maximumRunning = Math.max(maximumRunning, running)
        try {
          await work.promise
        } finally {
          cleaned.push(index)
          running--
        }
      }),
    ),
  )
  try {
    await vi.waitFor(() => expect(oldStarted).toHaveBeenCalledTimes(2))
    old.abort()
    loads.push(
      ...retryWork.map((work) =>
        outcome(
          withAssetLoadAdmission(new AbortController().signal, async () => {
            retryStarted([...cleaned])
            running++
            maximumRunning = Math.max(maximumRunning, running)
            try {
              await work.promise
            } finally {
              running--
            }
          }),
        ),
      ),
    )
    await Promise.resolve()
    await Promise.resolve()
    expect(retryStarted).not.toHaveBeenCalled()
    oldWork[0]!.resolve()
    await vi.waitFor(() => expect(retryStarted).toHaveBeenCalledTimes(1))
    expect(retryStarted).toHaveBeenNthCalledWith(1, [0])
    expect(maximumRunning).toBe(2)
    oldWork[1]!.resolve()
    await vi.waitFor(() => expect(retryStarted).toHaveBeenCalledTimes(2))
    expect(retryStarted).toHaveBeenNthCalledWith(2, [0, 1])
    expect(maximumRunning).toBe(2)
  } finally {
    oldWork.forEach((work) => work.resolve())
    retryWork.forEach((work) => work.resolve())
    await Promise.all(loads)
  }
})

it('removes an aborted queued load without running it or delaying the next live waiter', async () => {
  const held = [deferred(), deferred()]
  const loads = held.map((work) =>
    outcome(
      withAssetLoadAdmission(new AbortController().signal, () => work.promise),
    ),
  )
  const cancelled = new AbortController()
  const cancelledLoad = vi.fn(async () => undefined)
  const cancelledResult = outcome(
    withAssetLoadAdmission(cancelled.signal, cancelledLoad),
  )
  const liveLoad = vi.fn(async () => 'loaded')
  const liveResult = outcome(
    withAssetLoadAdmission(new AbortController().signal, liveLoad),
  )
  try {
    cancelled.abort()
    expect(await cancelledResult).toMatchObject({
      error: { name: 'AbortError' },
    })
    expect(cancelledLoad).not.toHaveBeenCalled()
    expect(liveLoad).not.toHaveBeenCalled()
    held[0]!.resolve()
    expect(await liveResult).toEqual({ value: 'loaded' })
    expect(liveLoad).toHaveBeenCalledOnce()
  } finally {
    held.forEach((work) => work.resolve())
    await Promise.all([...loads, cancelledResult, liveResult])
  }
})

it('admits queued loads in arrival order without a later caller taking the released slot', async () => {
  const held = [deferred(), deferred()]
  const queued = [deferred(), deferred(), deferred()]
  const started: number[] = []
  const loads = held.map((work) =>
    outcome(
      withAssetLoadAdmission(new AbortController().signal, () => work.promise),
    ),
  )
  loads.push(
    ...queued.map((work, index) =>
      outcome(
        withAssetLoadAdmission(new AbortController().signal, async () => {
          started.push(index)
          await work.promise
        }),
      ),
    ),
  )
  try {
    await Promise.resolve()
    expect(started).toEqual([])
    held[1]!.resolve()
    await vi.waitFor(() => expect(started).toEqual([0]))
    queued[0]!.resolve()
    await vi.waitFor(() => expect(started).toEqual([0, 1]))
    held[0]!.resolve()
    await vi.waitFor(() => expect(started).toEqual([0, 1, 2]))
  } finally {
    held.forEach((work) => work.resolve())
    queued.forEach((work) => work.resolve())
    await Promise.all(loads)
  }
})

it('releases failed work only after asynchronous cleanup finishes', async () => {
  const failedWork = deferred()
  const cleanup = deferred()
  const held = deferred()
  const failure = new Error('Decode failed.')
  const cleanupStarted = vi.fn()
  const nextLoad = vi.fn(async () => 'next')
  const failedResult = outcome(
    withAssetLoadAdmission(new AbortController().signal, async () => {
      try {
        await failedWork.promise
      } finally {
        cleanupStarted()
        await cleanup.promise
      }
    }),
  )
  const heldResult = outcome(
    withAssetLoadAdmission(new AbortController().signal, () => held.promise),
  )
  const nextResult = outcome(
    withAssetLoadAdmission(new AbortController().signal, nextLoad),
  )
  try {
    failedWork.reject(failure)
    await vi.waitFor(() => expect(cleanupStarted).toHaveBeenCalledOnce())
    expect(nextLoad).not.toHaveBeenCalled()
    cleanup.resolve()
    expect(await failedResult).toEqual({ error: failure })
    expect(await nextResult).toEqual({ value: 'next' })
  } finally {
    failedWork.resolve()
    cleanup.resolve()
    held.resolve()
    await Promise.all([failedResult, heldResult, nextResult])
  }
})

it('rejects cancellation before admission and after a synchronous grant without running work', async () => {
  const before = new AbortController()
  before.abort()
  const beforeLoad = vi.fn(async () => undefined)
  expect(
    await outcome(withAssetLoadAdmission(before.signal, beforeLoad)),
  ).toMatchObject({ error: { name: 'AbortError' } })
  expect(beforeLoad).not.toHaveBeenCalled()
  const granted = new AbortController()
  const grantedLoad = vi.fn(async () => undefined)
  const grantedResult = outcome(
    withAssetLoadAdmission(granted.signal, grantedLoad),
  )
  granted.abort()
  expect(await grantedResult).toMatchObject({ error: { name: 'AbortError' } })
  expect(grantedLoad).not.toHaveBeenCalled()
  const nextLoad = vi.fn(async () => 'not blocked')
  expect(
    await withAssetLoadAdmission(new AbortController().signal, nextLoad),
  ).toBe('not blocked')
})
