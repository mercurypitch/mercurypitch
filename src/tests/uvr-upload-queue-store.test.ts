import { afterEach, describe, expect, it, vi } from 'vitest'
import { setActiveUvrUploadQueueMode, uvrUploadQueue, } from '@/stores/uvr-upload-queue-store'

function song(name: string): File {
  return new File([name], name, { type: 'audio/mpeg' })
}

afterEach(() => {
  if (!uvrUploadQueue.isRunning()) uvrUploadQueue.clear()
  setActiveUvrUploadQueueMode('local')
})

describe('app-lifetime UVR upload queue store', () => {
  it('exposes the active batch and cancellation hook to a remounted consumer', async () => {
    uvrUploadQueue.clear()
    uvrUploadQueue.enqueue([song('one.mp3'), song('two.mp3')])
    setActiveUvrUploadQueueMode('server')

    let releaseFirst: (() => void) | undefined
    const run = uvrUploadQueue.run(async (item, context) => {
      context.update({ status: 'processing' })
      if (item.file.name === 'one.mp3') {
        context.onCancel(() => releaseFirst?.())
        await new Promise<void>((resolve) => {
          releaseFirst = resolve
        })
        return { status: 'cancelled' }
      }
      return { status: 'completed' }
    })

    await vi.waitFor(() => expect(uvrUploadQueue.isRunning()).toBe(true))

    // A new UvrPanel imports the same module after the previous panel was
    // disposed. It must see and control the original in-memory batch.
    const remounted = await import('@/stores/uvr-upload-queue-store')
    expect(remounted.uvrUploadQueue).toBe(uvrUploadQueue)
    expect(remounted.activeUvrUploadQueueMode()).toBe('server')
    expect(remounted.uvrUploadQueue.items()[0].status).toBe('processing')

    remounted.uvrUploadQueue.cancelActive()
    await run

    expect(uvrUploadQueue.items().map((item) => item.status)).toEqual([
      'cancelled',
      'completed',
    ])
  })
})
