// ============================================================
// Live mic store tests — a mixer's microphone, published and taken back
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import type { LiveMicFeed } from '@/stores/live-mic-store'
import { liveMicFeed, publishLiveMic } from '@/stores/live-mic-store'

const feed = (lagSec: number): LiveMicFeed => ({
  readings: () => [],
  readingLagSec: () => lagSec,
  score: () => ({ totalNotes: 0, accuracyPct: 0, grade: 'D' }),
})

const taken: (() => void)[] = []

afterEach(() => {
  for (const takeBack of taken.splice(0)) takeBack()
})

describe('the live microphone', () => {
  it('is the published one until it is taken back', () => {
    const first = feed(0.1)
    taken.push(publishLiveMic(first))
    expect(liveMicFeed()).toBe(first)

    taken.pop()?.()
    expect(liveMicFeed()).toBeNull()
  })

  it('stays the newest when an older one is taken back late', () => {
    const older = feed(0.1)
    const newer = feed(0.2)
    const takeBackOlder = publishLiveMic(older)
    taken.push(publishLiveMic(newer))

    takeBackOlder()

    expect(liveMicFeed()).toBe(newer)
  })
})
