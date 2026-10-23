// startOnboarding is the replay entry as well as the first-run one, so it
// must clear the previous run's transient verdicts — a session-old mic
// denial used to route every replay straight to the Map with no way to
// re-allow the microphone.

import { describe, expect, it } from 'vitest'
import { BEAT_ORDER } from '@/features/onboarding/flow'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { advanceBeat, chooseTrack, currentBeat, firstNote, markMicDenied, micDenied, onboardingBeads, openBeat, recordFirstNote, recordVoiceprint, resetOnboarding, setBeatsAvailable, setPlanDue, startOnboarding, track, voiceStrip, } from '@/stores/onboarding-store'

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

describe('the voiceprint and its glide line', () => {
  const RESULT: MirrorResult = { range: null, accuracy: null, steadiness: null }

  it("keeps a run's glide line with its voiceprint, and drops it with the next one", () => {
    // Arrange: a run that drew a line.
    recordVoiceprint(RESULT, [45, 57, 69, 57, 45])
    const drawn = voiceStrip()

    // Act: a voiceprint that came without one (a seeded or older result).
    recordVoiceprint({ ...RESULT })

    // Assert: the twin's card never draws another run's take.
    expect(drawn).toEqual([45, 57, 69, 57, 45])
    expect(voiceStrip()).toBeNull()
  })

  it('has no line without a voiceprint', () => {
    recordVoiceprint(null, [45, 57, 69])

    expect(voiceStrip()).toBeNull()
  })
})

describe('the questions in the walk', () => {
  const RESULT: MirrorResult = { range: null, accuracy: null, steadiness: null }

  it('walks past the questions until First Light says the plan is due', () => {
    // Arrange: a fresh store has not been told anything about the plan.
    resetOnboarding()
    setBeatsAvailable(BEAT_ORDER)
    chooseTrack('short')
    openBeat('fork')

    // Act
    advanceBeat()

    // Assert
    expect(currentBeat()).toBe('map')
  })

  it('lands on the questions after Keep while the plan is due, and on the Map once it is not', () => {
    // Arrange
    resetOnboarding()
    setBeatsAvailable(BEAT_ORDER)
    chooseTrack('full')
    recordVoiceprint(RESULT)
    setPlanDue(true)
    openBeat('keep')

    // Act
    advanceBeat()

    // Assert
    expect(currentBeat()).toBe('questions')

    // Act: the same walk for somebody whose plan is answered.
    setPlanDue(false)
    openBeat('keep')
    advanceBeat()

    // Assert
    expect(currentBeat()).toBe('map')
  })

  it('draws a bead for the questions while the plan is due', () => {
    resetOnboarding()
    setBeatsAvailable(BEAT_ORDER)
    chooseTrack('short')
    const without = onboardingBeads().count

    setPlanDue(true)

    expect(onboardingBeads().count).toBe(without + 1)
  })

  it('forgets that the plan is due when the flow is reset', () => {
    setBeatsAvailable(BEAT_ORDER)
    setPlanDue(true)

    resetOnboarding()

    chooseTrack('short')
    openBeat('fork')
    advanceBeat()
    expect(currentBeat()).toBe('map')
  })
})
