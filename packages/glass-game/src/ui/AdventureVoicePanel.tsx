// Adventure voice panel — selects the compact pitch or melody presentation for one session controller.

import { Show } from 'solid-js'
import type {
  BreakableDefinition,
  MelodyChallengeDefinition,
  PitchTargetId,
} from '../contracts'
import type { AdventureVoiceMode } from './adventure-voice-challenge'
import { MelodyChallengePanel } from './MelodyChallengePanel'
import type { useAdventure } from './useAdventure'
import type { VoiceChallengeMode } from './voice-challenge'
import { VoiceChallengePanel } from './VoiceChallengePanel'

function melodyKind(
  challenge: BreakableDefinition['challenge'] | undefined,
): MelodyChallengeDefinition['kind'] | null {
  return challenge?.kind === 'melody-anchor' ||
    challenge?.kind === 'melody-contour'
    ? challenge.kind
    : null
}

function scalarMode(mode: AdventureVoiceMode): VoiceChallengeMode {
  return mode === 'setup' ? 'off' : mode
}

function pitchSteps(
  challenge: BreakableDefinition['challenge'] | undefined,
): readonly PitchTargetId[] {
  if (challenge?.kind === 'hold' || challenge?.kind === 'settle-wave')
    return [challenge.step.target]
  return challenge?.kind === 'ordered-pair'
    ? challenge.steps.map((step) => step.target)
    : []
}

export function AdventureVoicePanel(props: {
  adventure: ReturnType<typeof useAdventure>
  active: BreakableDefinition | undefined
  onStartFresh(): void
}) {
  const kind = () => melodyKind(props.active?.challenge)
  return (
    <Show
      when={kind()}
      fallback={
        <VoiceChallengePanel
          label={props.active?.label ?? 'Glass exhibit'}
          mode={scalarMode(props.adventure.voiceMode())}
          message={props.adventure.voiceMessage()}
          hint={props.adventure.voiceHint()}
          target={props.adventure.target()}
          pitch={props.adventure.pitch()}
          charge={props.adventure.snapshot().activeEncounter?.charge ?? 0}
          pair={props.adventure.voicePair()}
          wave={props.active?.challenge.kind === 'settle-wave'}
          waveCycles={
            props.active?.challenge.kind === 'settle-wave'
              ? props.active.challenge.wave.requiredCycles
              : undefined
          }
          steps={pitchSteps(props.active?.challenge)}
          stepIndex={
            props.adventure.snapshot().activeEncounter?.stepIndex ?? 0
          }
          onCancel={props.adventure.cancel}
          onReplay={props.adventure.replay}
          onRefind={props.adventure.changeNote}
        />
      }
    >
      {(activeKind) => (
        <MelodyChallengePanel
          label={props.active?.label ?? 'Melody station'}
          challengeKind={activeKind()}
          mode={props.adventure.voiceMode()}
          message={props.adventure.voiceMessage()}
          hint={props.adventure.voiceHint()}
          target={props.adventure.target()}
          pitch={props.adventure.pitch()}
          charge={props.adventure.voiceStepCharge()}
          contour={props.adventure.melodyContour()}
          judge={props.adventure.melodyJudge()}
          timelineSeconds={props.adventure.melodyTimelineSeconds()}
          comfortableMidi={props.adventure.melodyComfortableMidi()}
          rootMidi={props.adventure.melodyRootMidi()}
          pace={props.adventure.melodyPace()}
          allowedPaces={props.adventure.melodyAllowedPaces()}
          frozen={props.adventure.melodyFrozen()}
          needsFreshAttempt={props.adventure.melodyNeedsFreshAttempt()}
          onBegin={props.adventure.beginVoiceChallenge}
          onHear={props.adventure.hearMelodyExample}
          onReplay={props.adventure.replay}
          onChangeKey={props.adventure.changeNote}
          onChangePace={props.adventure.changeMelodyPace}
          onStartFresh={props.onStartFresh}
          onCancel={props.adventure.cancel}
        />
      )}
    </Show>
  )
}
