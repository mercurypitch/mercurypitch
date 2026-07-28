// ============================================================
// First Light — the beat orchestrator
// ============================================================
//
// Owns the shared frame (sky, progress hairline, escape) and swaps
// the current beat inside it. The traversal itself lives in flow.ts
// so the skip rules are testable without mounting anything.
//
// Lazy-loaded from App.tsx — a returning visitor pays nothing for a
// flow they have already walked.
//
// See docs/plans/onboarding-first-light.md.

import type { Component } from 'solid-js'
import { createEffect, Match, onMount, Show, Switch } from 'solid-js'
import type { ActiveTab } from '@/features/tabs/constants'
import type { F0Frame, MirrorResult } from '@/lib/mirror/metrics'
import { advanceBeat, chooseTrack, closeOnboarding, currentBeat, finishOnboarding, firstNote, markMicDenied, onboardingProgress, recordFirstNote, recordVoiceprint, setBeatsAvailable, voiceprint, } from '@/stores/onboarding-store'
import { setActiveTab } from '@/stores/ui-store'
import { BeatFirstLight } from './beats/BeatFirstLight'
import { BeatFork } from './beats/BeatFork'
import { BeatMap } from './beats/BeatMap'
import { BeatSky } from './beats/BeatSky'
import { BeatTwin } from './beats/BeatTwin'
import { BeatVoiceprint } from './beats/BeatVoiceprint'
import type { Beat, OnboardingTrack } from './flow'
import { BEAT_EVENT, trackOnboarding } from './funnel'
import styles from './onboarding.module.css'
import type { RoomTarget } from './rooms'
import type { SettledNote } from './settled-note'
import { StarField } from './StarField'

/**
 * The beats this build can render. Phase 3 adds 'keep'. Anything absent
 * is skipped by the traversal, so no half-built beat reaches a visitor.
 */
const RENDERABLE: readonly Beat[] = [
  'sky',
  'first-light',
  'fork',
  'voiceprint',
  'twin',
  'map',
]

export interface FirstLightProps {
  /** True when opened as a replay (#/map) rather than on first run. */
  replay?: boolean
}

export const FirstLight: Component<FirstLightProps> = (props) => {
  onMount(() => setBeatsAvailable(RENDERABLE))

  // One funnel event per beat entered, including the first.
  createEffect(() => {
    const event = BEAT_EVENT[currentBeat()]
    if (event !== undefined) trackOnboarding(event)
  })

  const handleTrack = (track: OnboardingTrack) => {
    chooseTrack(track)
    trackOnboarding(
      track === 'full' ? 'onboarding_track_full' : 'onboarding_track_short',
    )
    advanceBeat()
  }

  const handleHeard = (note: SettledNote) => {
    trackOnboarding('onboarding_mic_granted')
    recordFirstNote(note.note)
  }

  /**
   * The mic is unusable. Marking it denied makes every beat except the
   * Map inapplicable, so a single advance lands there — no special-case
   * jump, and the progress bar stays honest.
   */
  const handleMicDenied = () => {
    trackOnboarding('onboarding_mic_denied')
    markMicDenied()
    advanceBeat()
  }

  const handleVoiceprint = (result: MirrorResult, _glides: F0Frame[][]) => {
    recordVoiceprint(result)
    advanceBeat()
  }

  const leave = () => {
    // A replay must not re-close the first run's seen-flag logic —
    // it was already set the first time through.
    if (props.replay === true) closeOnboarding()
    else finishOnboarding()
  }

  const handleSkip = () => {
    trackOnboarding('onboarding_skipped')
    leave()
  }

  const handleDone = () => {
    trackOnboarding('onboarding_done')
    leave()
  }

  const handleEnterRoom = (target: RoomTarget, roomId: string) => {
    trackOnboarding('onboarding_map_room')
    console.info('[onboarding] entering room', roomId)
    if (target.kind === 'tab') {
      setActiveTab(target.tab as ActiveTab)
      leave()
      return
    }
    // A page target is a real navigation (Karaoke, Mirror, Glass) —
    // close the flow first so returning via Back doesn't land back
    // inside onboarding.
    leave()
    window.location.href = target.href
  }

  return (
    <div
      class={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to MercuryPitch"
    >
      <StarField recede={currentBeat() === 'map'} />

      <div class={styles.rail}>
        <div class={styles.progress}>
          <div
            class={styles.progressFill}
            style={{ width: `${Math.round(onboardingProgress() * 100)}%` }}
          />
        </div>
        <Show when={currentBeat() !== 'map'}>
          <button type="button" class={styles.skip} onClick={handleSkip}>
            Skip
          </button>
        </Show>
      </div>

      <div class={styles.frame}>
        <Switch>
          <Match when={currentBeat() === 'sky'}>
            <BeatSky onContinue={() => advanceBeat()} />
          </Match>
          <Match when={currentBeat() === 'first-light'}>
            <BeatFirstLight
              onHeard={handleHeard}
              onContinue={() => advanceBeat()}
              onDenied={handleMicDenied}
            />
          </Match>
          <Match when={currentBeat() === 'fork'}>
            <BeatFork firstNote={firstNote()} onChoose={handleTrack} />
          </Match>
          <Match when={currentBeat() === 'voiceprint'}>
            <BeatVoiceprint
              onComplete={handleVoiceprint}
              onDenied={handleMicDenied}
            />
          </Match>
          <Match when={currentBeat() === 'twin' && voiceprint() !== null}>
            <BeatTwin
              result={voiceprint() as MirrorResult}
              onContinue={() => advanceBeat()}
            />
          </Match>
          <Match when={currentBeat() === 'map'}>
            <BeatMap
              voiceprint={voiceprint()}
              replay={props.replay}
              onEnter={handleEnterRoom}
              onDone={handleDone}
            />
          </Match>
        </Switch>
      </div>
    </div>
  )
}

export default FirstLight
