import { describe, expect, it } from 'vitest'
import { isAllowedGuidedPlaybackType } from './guided-exercises'

describe('guided exercise playback types', () => {
  it('accepts browser microphone recording formats with codec parameters', () => {
    expect(
      isAllowedGuidedPlaybackType('audio/webm;codecs=opus'),
    ).toBeTruthy()
    expect(isAllowedGuidedPlaybackType('audio/ogg; codecs=opus')).toBeTruthy()
    expect(
      isAllowedGuidedPlaybackType('audio/mp4;codecs=mp4a.40.2'),
    ).toBeTruthy()
  })

  it('rejects non-audio uploads', () => {
    expect(isAllowedGuidedPlaybackType('video/webm')).toBeFalsy()
    expect(isAllowedGuidedPlaybackType('application/octet-stream')).toBeFalsy()
  })
})
