// ============================================================
// Playback cause: the innermost caller names a play or a pause
// ============================================================

import { describe, expect, it } from 'vitest'
import { asPlaybackCause, playbackCause, UNNAMED_CAUSE } from './playback-cause'

describe('playbackCause', () => {
  it('says the fallback where nobody named a cause', () => {
    expect(playbackCause()).toBe(UNNAMED_CAUSE)
    expect(playbackCause('leave')).toBe('leave')
  })

  it('names the cause for the call it wraps, and only for that call', () => {
    const heard = asPlaybackCause('media-session(pause)', () => playbackCause())

    expect(heard).toBe('media-session(pause)')
    expect(playbackCause()).toBe(UNNAMED_CAUSE)
  })

  it('names the innermost cause, then the outer one again', () => {
    const heard: string[] = []

    asPlaybackCause('shell', () => {
      heard.push(playbackCause())
      asPlaybackCause('media-session(stop)', () => {
        heard.push(playbackCause())
      })
      heard.push(playbackCause())
    })

    expect(heard).toEqual(['shell', 'media-session(stop)', 'shell'])
  })

  it('puts the outer cause back after a throw', () => {
    expect(() =>
      asPlaybackCause('find', () => {
        throw new Error('the mixer went')
      }),
    ).toThrow('the mixer went')

    expect(playbackCause()).toBe(UNNAMED_CAUSE)
  })
})
