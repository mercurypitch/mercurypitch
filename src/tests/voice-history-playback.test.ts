import { describe, expect, it } from 'vitest'
import { createPlaybackRequestGate } from '@/features/voice-history/VoiceHistoryPage'

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
