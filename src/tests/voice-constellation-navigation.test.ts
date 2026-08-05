import { afterEach, describe, expect, it, vi } from 'vitest'
import { leaveVoiceConstellation, openVoiceConstellation, resetVoiceConstellationExit, } from '@/features/voice-constellation/navigation'

afterEach(() => {
  vi.restoreAllMocks()
  resetVoiceConstellationExit()
  history.replaceState(null, '', '#/singing')
})

describe('voice constellation navigation', () => {
  it('marks an in-app open so close delegates to browser Back', () => {
    history.replaceState({ preserved: true }, '', '#/settings/account')
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined)

    openVoiceConstellation()

    expect(window.location.hash).toBe('#/voice-constellation')
    expect(history.state).toEqual(
      expect.objectContaining({
        'mercurypitch.voiceConstellation.returnHash': '#/settings/account',
      }),
    )
    expect(leaveVoiceConstellation('singing')).toBe('history')
    expect(leaveVoiceConstellation('singing')).toBe('history')
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('does not overwrite return context when an open request is duplicated', () => {
    history.replaceState(null, '', '#/settings/account')

    openVoiceConstellation()
    openVoiceConstellation()

    expect(history.state).toEqual(
      expect.objectContaining({
        'mercurypitch.voiceConstellation.returnHash': '#/settings/account',
      }),
    )
  })

  it('can close again after the route closes and Forward reopens it', () => {
    history.replaceState(null, '', '#/settings/account')
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined)
    openVoiceConstellation()

    expect(leaveVoiceConstellation('singing')).toBe('history')
    resetVoiceConstellationExit()
    expect(leaveVoiceConstellation('singing')).toBe('history')
    expect(back).toHaveBeenCalledTimes(2)
  })

  it('replaces a directly loaded route with the current app tab', () => {
    history.replaceState(null, '', '#/voice-constellation')

    expect(leaveVoiceConstellation('community')).toBe('fallback')
    expect(window.location.hash).toBe('#/community')
  })

  it('is a no-op after another route already closed the surface', () => {
    history.replaceState(null, '', '#/singing')
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined)

    expect(leaveVoiceConstellation('community')).toBe('noop')
    expect(back).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/singing')
  })
})
