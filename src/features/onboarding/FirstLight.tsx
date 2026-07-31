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
import { createEffect, createSignal, Match, onMount, Show, Switch, } from 'solid-js'
import { saveVoiceprint } from '@/db/services/voiceprint-service'
import { shareVoiceprintRecord } from '@/features/mirror/voiceprint-share'
import type { ActiveTab } from '@/features/tabs/constants'
import type { F0Frame, MirrorResult } from '@/lib/mirror/metrics'
import { summarize } from '@/lib/mirror/metrics'
import { singerForRange } from '@/lib/mirror/singer-match'
import { startPageTour } from '@/stores/app-store'
import { advanceBeat, chooseTrack, closeOnboarding, currentBeat, finishOnboarding, firstNote, markMicDenied, onboardingProgress, recordFirstNote, recordVoiceprint, setBeatsAvailable, voiceprint, } from '@/stores/onboarding-store'
import { openAuthModal, setActiveTab } from '@/stores/ui-store'
import { dismissNudge, shouldShowNudge } from './account-nudge'
import { BeatFirstLight } from './beats/BeatFirstLight'
import { BeatFork } from './beats/BeatFork'
import { BeatKeep } from './beats/BeatKeep'
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
  'keep',
  'map',
]

export interface FirstLightProps {
  /** True when opened as a replay (#/map) rather than on first run. */
  replay?: boolean
}

export const FirstLight: Component<FirstLightProps> = (props) => {
  const [twin, setTwin] = createSignal<string | null>(null)

  onMount(() => {
    // The account ask is a renderable beat only while it is due. A
    // visitor who declined last week walks the same flow without being
    // asked again — and the progress bar shortens to match, rather than
    // promising a step that never arrives.
    const beats = shouldShowNudge('onboarding-twin')
      ? RENDERABLE
      : RENDERABLE.filter((beat) => beat !== 'keep')
    setBeatsAvailable(beats)
  })

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
    const matched = singerForRange(result.range)
    setTwin(matched)

    // Save immediately, before the account is ever mentioned. The offer
    // at beat 7 is only honest if declining it costs nothing right now —
    // and it also means backing out mid-flow doesn't lose the take.
    void saveVoiceprint({
      summary: summarize(result),
      twin: matched,
      source: 'onboarding',
    })

    advanceBeat()
  }

  /**
   * Open a room and walk its spotlight tour.
   *
   * No delay before `startPageTour`, matching every other caller
   * (usePageTourOffer, offerTourOnce): page-tour steps carry
   * `requiredTab`, so the Walkthrough switches tabs itself, and it
   * already waits ~1s per step for a target to become visible. Closing
   * the overlay first is enough — a hand-rolled frame of delay would
   * be a second, weaker copy of a budget the engine owns.
   */
  const handleRoomTour = (target: RoomTarget, tab: ActiveTab) => {
    trackOnboarding('onboarding_map_room')
    if (target.kind === 'tab') setActiveTab(target.tab as ActiveTab)
    leave()
    startPageTour(tab)
  }

  const handleCreateAccount = () => {
    trackOnboarding('onboarding_account_created')
    // The shared AuthModal on its register pane - no navigation hand-off.
    // The old '#/settings/account' hash-jump left the flow entirely, which
    // raced the teardown (a dead first click in testing), landed on a
    // signed-out settings section, AND skipped the Map beat - creating an
    // account was the one path that never saw "See my map" pay off. The
    // modal (z 3200) opens above the flow (z 3000); underneath, the flow
    // advances to the Map so closing the modal lands exactly where the
    // button promised.
    advanceBeat()
    openAuthModal('register')
  }

  const handleDismissAccount = () => {
    trackOnboarding('onboarding_account_dismissed')
    dismissNudge('onboarding-twin')
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
      <div
        class={`${styles.plate} ${currentBeat() === 'map' ? styles.plateRecede : ''}`}
        aria-hidden="true"
      />
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
              onShare={() => {
                const result = voiceprint()
                if (result == null) return
                void shareVoiceprintRecord(
                  {
                    id: 'fresh',
                    summary: summarize(result as MirrorResult),
                    twin: twin(),
                    source: 'onboarding',
                    takenAt: new Date().toISOString(),
                  },
                  'face',
                )
              }}
            />
          </Match>
          <Match when={currentBeat() === 'map'}>
            <BeatMap
              voiceprint={voiceprint()}
              replay={props.replay}
              onEnter={handleEnterRoom}
              onTour={handleRoomTour}
              onDone={handleDone}
            />
          </Match>
          <Match when={currentBeat() === 'keep'}>
            <BeatKeep
              twin={twin()}
              onCreateAccount={handleCreateAccount}
              onDismiss={handleDismissAccount}
            />
          </Match>
        </Switch>
      </div>
    </div>
  )
}

export default FirstLight
