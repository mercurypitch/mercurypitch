// Adventure transient message tests — captions and notices expire or clear without stale callbacks.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAdventureTransientMessages } from './adventure-transient-messages'

describe('adventure transient messages', () => {
  afterEach(() => vi.useRealTimers())

  it('keeps the two message rows independent and clears their pending timers', () => {
    vi.useFakeTimers()
    const messages = createAdventureTransientMessages(
      'Find the first exhibit.',
      () => true,
    )

    messages.startOpeningNotice()
    messages.showNarrationCaption('That sounded beautiful.')
    expect(messages.notice()).toBe('Find the first exhibit.')
    expect(messages.narrationCaption()).toBe('That sounded beautiful.')

    messages.clearNarrationCaption()
    expect(messages.notice()).toBe('Find the first exhibit.')
    expect(messages.narrationCaption()).toBe('')

    messages.announce('A new path is open.')
    messages.showNarrationCaption('Follow the light.')
    messages.clear()
    vi.advanceTimersByTime(5000)
    expect(messages.notice()).toBe('')
    expect(messages.narrationCaption()).toBe('')
  })
})
