import { describe, expect, it, vi } from 'vitest'
import { createUvrUploadQueue, MAX_UVR_UPLOAD_QUEUE_ITEMS, } from '@/lib/uvr-upload-queue'

function songs(count: number): File[] {
  return Array.from(
    { length: count },
    (_, index) =>
      new File([String(index)], `song-${index + 1}.mp3`, {
        type: 'audio/mpeg',
      }),
  )
}

function deterministicIds() {
  let id = 0
  return () => `queue-${++id}`
}

describe('UVR upload queue', () => {
  it('accepts at most 15 songs in a batch', () => {
    const queue = createUvrUploadQueue(
      MAX_UVR_UPLOAD_QUEUE_ITEMS,
      deterministicIds(),
    )
    expect(queue.enqueue(songs(17))).toEqual({ added: 15, overflow: 2 })
    expect(queue.items()).toHaveLength(15)
    expect(queue.items()[0].file.name).toBe('song-1.mp3')
    expect(queue.items()[14].file.name).toBe('song-15.mp3')
  })

  it('runs FIFO with exactly one worker and continues after an error', async () => {
    const queue = createUvrUploadQueue(15, deterministicIds())
    queue.enqueue(songs(3))
    const order: string[] = []
    let active = 0
    let peak = 0

    await queue.run(async (item) => {
      active++
      peak = Math.max(peak, active)
      order.push(item.file.name)
      await Promise.resolve()
      active--
      if (item.file.name === 'song-2.mp3') throw new Error('bad audio')
      return { status: 'completed' }
    })

    expect(order).toEqual(['song-1.mp3', 'song-2.mp3', 'song-3.mp3'])
    expect(peak).toBe(1)
    expect(queue.items().map((item) => item.status)).toEqual([
      'completed',
      'error',
      'completed',
    ])
    expect(queue.items()[1].message).toBe('bad audio')
  })

  it('cancels only the active song and advances to the next one', async () => {
    const queue = createUvrUploadQueue(15, deterministicIds())
    queue.enqueue(songs(2))
    const cancelHandler = vi.fn()
    let releaseFirst: (() => void) | undefined

    const run = queue.run(async (item, context) => {
      if (item.file.name === 'song-1.mp3') {
        context.onCancel(() => {
          cancelHandler()
          releaseFirst?.()
        })
        await new Promise<void>((resolve) => {
          releaseFirst = resolve
        })
        return { status: 'cancelled' }
      }
      return { status: 'completed' }
    })

    await vi.waitFor(() => expect(queue.isRunning()).toBe(true))
    queue.cancelActive()
    await run

    expect(cancelHandler).toHaveBeenCalledOnce()
    expect(queue.items().map((item) => item.status)).toEqual([
      'cancelled',
      'completed',
    ])
  })

  it('allows queued songs to be removed before a batch starts', () => {
    const queue = createUvrUploadQueue(15, deterministicIds())
    queue.enqueue(songs(2))
    queue.remove(queue.items()[0].id)
    expect(queue.items().map((item) => item.file.name)).toEqual(['song-2.mp3'])
  })

  it('skips an individual waiting song without interrupting the active song', async () => {
    const queue = createUvrUploadQueue(15, deterministicIds())
    queue.enqueue(songs(3))
    const processed: string[] = []
    let releaseFirst: () => void = () => undefined
    const firstActive = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const run = queue.run(async (item) => {
      processed.push(item.file.name)
      if (item.file.name === 'song-1.mp3') {
        await firstActive
      }
      return { status: 'completed' }
    })

    await vi.waitFor(() => expect(queue.items()[0].status).toBe('checking'))
    expect(queue.skipQueued(queue.items()[1].id)).toBe(true)
    expect(queue.skipQueued(queue.items()[0].id)).toBe(false)
    releaseFirst()
    await run

    expect(processed).toEqual(['song-1.mp3', 'song-3.mp3'])
    expect(queue.items().map((item) => item.status)).toEqual([
      'completed',
      'omitted',
      'completed',
    ])
    expect(queue.items()[1].message).toBe('Skipped by you')
  })

  it('stops after the active song by skipping every waiting song', async () => {
    const queue = createUvrUploadQueue(15, deterministicIds())
    queue.enqueue(songs(4))
    const processed: string[] = []
    let releaseActive: () => void = () => undefined
    const active = new Promise<void>((resolve) => {
      releaseActive = resolve
    })

    const run = queue.run(async (item) => {
      processed.push(item.file.name)
      await active
      return { status: 'completed' }
    })

    await vi.waitFor(() => expect(queue.items()[0].status).toBe('checking'))
    expect(queue.skipRemaining()).toBe(3)
    releaseActive()
    await run

    expect(processed).toEqual(['song-1.mp3'])
    expect(queue.items().map((item) => item.status)).toEqual([
      'completed',
      'omitted',
      'omitted',
      'omitted',
    ])
    expect(queue.isRunning()).toBe(false)
  })

  it('does not retain skipped rows when no batch is running', () => {
    const queue = createUvrUploadQueue(15, deterministicIds())
    queue.enqueue(songs(2))

    expect(queue.skipQueued(queue.items()[0].id)).toBe(false)
    expect(queue.skipRemaining()).toBe(0)
    expect(queue.items().map((item) => item.status)).toEqual([
      'queued',
      'queued',
    ])
  })

  it('unlocks after cancellation while the worker is still preparing', async () => {
    const queue = createUvrUploadQueue(15, deterministicIds())
    queue.enqueue(songs(2))
    queue.remove(queue.items()[0].id)

    let announceStarted: () => void = () => undefined
    const started = new Promise<void>((resolve) => {
      announceStarted = resolve
    })
    let releasePreparation: () => void = () => undefined
    const preparation = new Promise<void>((resolve) => {
      releasePreparation = resolve
    })

    const run = queue.run(async (_item, context) => {
      announceStarted()
      await preparation
      context.update({
        status: 'processing',
        progress: 75,
        message: 'Late model update',
      })
      return { status: 'completed' }
    })

    await started
    queue.cancelActive()
    await run

    expect(queue.isRunning()).toBe(false)
    expect(queue.items()).toMatchObject([
      { status: 'cancelled', message: 'Cancelled' },
    ])

    // Model initialization may still settle later. Its stale callbacks and
    // outcome must not resurrect the cancelled row or lock a new batch.
    releasePreparation()
    await Promise.resolve()
    await Promise.resolve()
    expect(queue.items()[0]).toMatchObject({
      status: 'cancelled',
      message: 'Cancelled',
    })

    queue.clear()
    expect(queue.enqueue(songs(1))).toEqual({ added: 1, overflow: 0 })
    await queue.run(async () => ({ status: 'completed' }))
    expect(queue.items()[0].status).toBe('completed')
  })

  it('lets a fully cancelled queue close during runner cleanup', async () => {
    const queue = createUvrUploadQueue(15, deterministicIds())
    queue.enqueue(songs(1))

    let announceStarted: () => void = () => undefined
    const started = new Promise<void>((resolve) => {
      announceStarted = resolve
    })
    const run = queue.run(async () => {
      announceStarted()
      await new Promise<void>(() => undefined)
      return { status: 'completed' }
    })

    await started
    queue.cancelActive()
    expect(queue.isRunning()).toBe(true)
    queue.clear()
    expect(queue.items()).toEqual([])

    await run
    expect(queue.isRunning()).toBe(false)
  })
})
