import { describe, expect, it } from 'vitest'
import { createPlaybackRequestGate, createTakeMutationQueue, } from '@/features/voice-history/VoiceHistoryPage'

describe('voice history playback requests', () => {
  it('lets only the latest asynchronous playback request commit', async () => {
    let resolveEarlier: (() => void) | undefined
    let resolveLater: (() => void) | undefined
    const earlierLoaded = new Promise<void>((resolve) => {
      resolveEarlier = resolve
    })
    const laterLoaded = new Promise<void>((resolve) => {
      resolveLater = resolve
    })
    const committed: string[] = []
    const gate = createPlaybackRequestGate()

    const earlierIsCurrent = gate.begin()
    const earlierRequest = earlierLoaded.then(() => {
      if (earlierIsCurrent()) committed.push('earlier')
    })
    const laterIsCurrent = gate.begin()
    const laterRequest = laterLoaded.then(() => {
      if (laterIsCurrent()) committed.push('later')
    })

    resolveLater?.()
    await laterRequest
    resolveEarlier?.()
    await earlierRequest

    expect(committed).toEqual(['later'])
  })

  it('invalidates a pending request when playback is disposed', () => {
    const gate = createPlaybackRequestGate()
    const requestIsCurrent = gate.begin()

    gate.cancel()

    expect(requestIsCurrent()).toBe(false)
  })
})

describe('voice history take mutations', () => {
  it('serializes rapid writes for the same take without blocking other takes', async () => {
    let releaseFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const queue = createTakeMutationQueue()
    const order: string[] = []

    const first = queue.enqueue('take-a', async () => {
      order.push('a1:start')
      await firstGate
      order.push('a1:end')
    })
    const second = queue.enqueue('take-a', async () => {
      order.push('a2')
    })
    const otherTake = queue.enqueue('take-b', async () => {
      order.push('b1')
    })

    await otherTake
    expect(order).toEqual(['a1:start', 'b1'])

    releaseFirst?.()
    await Promise.all([first, second])
    expect(order).toEqual(['a1:start', 'b1', 'a1:end', 'a2'])
  })

  it('continues a take queue after an earlier write fails', async () => {
    const queue = createTakeMutationQueue()
    const order: string[] = []

    const failed = queue.enqueue('take-a', async () => {
      throw new Error('storage unavailable')
    })
    const recovered = queue.enqueue('take-a', async () => {
      order.push('recovered')
    })

    await expect(failed).rejects.toThrow('storage unavailable')
    await recovered
    expect(order).toEqual(['recovered'])
  })
})
