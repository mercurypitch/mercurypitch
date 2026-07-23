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
})
