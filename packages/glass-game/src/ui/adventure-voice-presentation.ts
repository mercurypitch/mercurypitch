// Adventure voice presentation — stable accessors keep session orchestration out of the Solid view.

import type { Accessor } from 'solid-js'
import type {
  AdventureVoiceController,
  AdventureVoiceSnapshot,
} from './adventure-voice-challenge'

export function createAdventureVoicePresentation(
  state: Accessor<AdventureVoiceSnapshot | undefined>,
  controller: AdventureVoiceController,
) {
  return {
    voiceChallengeKind: () => state()?.challengeKind ?? null,
    voiceEncounterId: () => state()?.encounterId ?? null,
    findingTarget: () => state()?.findingTarget ?? null,
    voiceMessage: () => state()?.message ?? '',
    voiceHint: () => state()?.hint ?? '',
    voicePair: () => state()?.pair ?? false,
    voiceStepIndex: () => state()?.stepIndex ?? 0,
    voiceStepCount: () => state()?.stepCount ?? 1,
    voiceStepCharge: () => state()?.stepCharge ?? 0,
    melodyContour: () => state()?.contour ?? null,
    melodyJudge: () => state()?.melodyJudge ?? null,
    melodyTimelineSeconds: () => state()?.timelineSeconds ?? 0,
    melodyComfortableMidi: () => state()?.comfortableMidi ?? null,
    melodyRootMidi: () => state()?.rootMidi ?? null,
    melodyPace: () => state()?.pace ?? null,
    melodyAllowedPaces: () => state()?.allowedPaces ?? [],
    melodyFrozen: () => state()?.melodyFrozen ?? false,
    melodyNeedsFreshAttempt: () => state()?.needsFreshAttempt ?? false,
    beginVoiceChallenge: () => void controller.begin(),
    hearMelodyExample: () => void controller.hear(),
    changeNote: () => controller.refind(),
    replay: () => void controller.replay(),
    changeMelodyPace: (pace: number) => controller.setPace(pace),
  }
}
