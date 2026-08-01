// startOnboarding is the replay entry as well as the first-run one, so it
// must clear the previous run's transient verdicts — a session-old mic
// denial used to route every replay straight to the Map with no way to
// re-allow the microphone.

import { describe, expect, it } from 'vitest'
import { BEAT_ORDER } from '@/features/onboarding/flow'
import { chooseTrack, currentBeat, firstNote, markMicDenied, micDenied, recordFirstNote, setBeatsAvailable, startOnboarding, track, } from '@/stores/onboarding-store'

describe('onboarding replay', () => {
  it('startOnboarding clears mic denial, track and first note', () => {
    setBeatsAvailable(BEAT_ORDER)
    markMicDenied()
    chooseTrack('full')
    recordFirstNote('G3')

    startOnboarding()

    expect(micDenied()).toBe(false)
    expect(track()).toBe(null)
    expect(firstNote()).toBe(null)
    // With the denial cleared the walk restarts at the top — not at the
    // Map, which is where a remembered denial used to send it.
    expect(currentBeat()).toBe('sky')
  })
})
