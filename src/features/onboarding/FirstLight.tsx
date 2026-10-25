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
import { createEffect, createSignal, Match, on, onMount, Show, Switch, untrack, } from 'solid-js'
import { X } from '@/components/icons'
import { accountHeld, hasUpgradedAccount } from '@/db/services/auth-service'
import { listVoiceprints, saveVoiceprint, } from '@/db/services/voiceprint-service'
import { shareOutcomeMessage } from '@/features/mirror/card-renderer'
import { shareVoiceprintRecord } from '@/features/mirror/voiceprint-share'
import { BeatPlan, PLAN_SKIP_ASK } from '@/features/plan/BeatPlan'
import { PLAN_DESTS } from '@/features/plan/build-plan'
import { markPlanShown, planRecord } from '@/features/plan/plan-store'
import type { ActiveTab } from '@/features/tabs/constants'
import { openVoiceConstellation } from '@/features/voice-constellation/navigation'
import { isolateKeys } from '@/lib/keyboard-isolation'
import { giftOfferLine } from '@/lib/launch-gift-copy'
import type { F0Frame, MirrorResult } from '@/lib/mirror/metrics'
import { summarize } from '@/lib/mirror/metrics'
import { singerForRange } from '@/lib/mirror/singer-match'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { hasPageTour, startPageTour } from '@/stores/app-store'
import { claimGiftNow, giftWaiting, rememberGiftOffered, } from '@/stores/launch-gift-store'
import { advanceBeat, chooseTrack, closeOnboarding, currentBeat, finishOnboarding, firstNote, markMicDenied, micDenied, onboardingBeads, onboardingProgress, openBeat, recordFirstNote, recordSavedVoiceprints, recordVoiceprint, savedVoiceprints, setBeatsAvailable, setPlanDue, voiceprint, voiceStrip, } from '@/stores/onboarding-store'
import { loadFeaturedPromo, offeredPromo } from '@/stores/promo-store'
import { openAuthModal, setActiveTab } from '@/stores/ui-store'
import { dismissNudge, shouldShowNudge } from './account-nudge'
import { BeatFirstLight } from './beats/BeatFirstLight'
import { BeatFork } from './beats/BeatFork'
import { BeatKeep } from './beats/BeatKeep'
import type { MapGift } from './beats/BeatMap'
import { BeatMap } from './beats/BeatMap'
import { BeatPrints } from './beats/BeatPrints'
import { BeatSky } from './beats/BeatSky'
import { BeatTwin } from './beats/BeatTwin'
import { BeatVoiceprint } from './beats/BeatVoiceprint'
import { pickFirstStop } from './first-stop'
import type { Beat, OnboardingTrack } from './flow'
import { BEAT_EVENT, MAP_ROOM_EVENT, MAP_STORE_EVENT, trackOnboarding, } from './funnel'
import styles from './onboarding.module.css'
import type { Plate } from './plates'
import { plateFor, platesAhead, plateSrc, TALL_QUERY } from './plates'
import type { EnteredRoomId, RoomId, RoomTarget } from './rooms'
import { SIDE_DOORS } from './rooms'
import type { SettledNote } from './settled-note'
import { createSkipConfirm } from './skip-confirm'
import { StarField } from './StarField'
import { glideStrip } from './voice-strip'

/**
 * The beats this build can render. Phase 3 adds 'keep'. Anything absent
 * is skipped by the traversal, so no half-built beat reaches a visitor.
 */
const RENDERABLE: readonly Beat[] = [
  'sky',
  'first-light',
  'fork',
  'prints',
  'voiceprint',
  'twin',
  'keep',
  'questions',
  'map',
]

export interface FirstLightProps {
  /** True when opened as a replay (#/map) rather than on first run. */
  replay?: boolean
  /**
   * Called once the flow's shell is in the DOM. App.tsx holds the
   * opening backdrop over a first visit until this fires, so the app
   * shell never flashes while this lazy chunk is still on the wire.
   */
  onReady?: () => void
}

export const FirstLight: Component<FirstLightProps> = (props) => {
  const [twin, setTwin] = createSignal<string | null>(null)

  // The four questions are asked while the person's plan is due: not answered
  // and not turned down. Read once, as the flow opens, and handed to the walk
  // (the store has no way to read the plan), so answering the questions in
  // this run never drops their beat from its own walk.
  const planDueAtOpen = untrack(() => {
    const record = planRecord()
    return record === null || record.status === 'shown'
  })
  setPlanDue(planDueAtOpen)
  // A sign-up that left from the questions resumes there, unless the plan was
  // answered since (another tab, another device): then the Map.
  if (!planDueAtOpen && untrack(currentBeat) === 'questions') openBeat('map')

  onMount(() => {
    props.onReady?.()
    // The account ask is a renderable beat only while it is due. A
    // visitor who declined last week walks the same flow without being
    // asked again — and the progress bar shortens to match, rather than
    // promising a step that never arrives. Someone with a real account has
    // nothing to create, so the ask disappears for them too (a replay used
    // to offer "Create a free account" to its own account holder). Real
    // means upgraded — anonymous identities hold tokens and are exactly
    // who the ask is for.
    const accountAskDue =
      !hasUpgradedAccount() && shouldShowNudge('onboarding-twin')
    const beats = accountAskDue
      ? RENDERABLE
      : RENDERABLE.filter((beat) => beat !== 'keep')
    setBeatsAvailable(beats)

    // What this visitor already has. Read once, here, rather than from
    // the fork: the fork must render the instant it is reached, and a
    // cloud round trip behind a beat would show the wrong copy first
    // and then rewrite it under the visitor's cursor. Failure is an
    // empty list, which is exactly the first-timer wording.
    void listVoiceprints()
      .then(recordSavedVoiceprints)
      .catch(() => recordSavedVoiceprints([]))

    // The launch gift the Keep beat and the Map offer, when the server
    // features one (promo-store). Shared with the header: one ask a page.
    void loadFeaturedPromo()
  })

  /** The launch gift beside the account ask: only for somebody with no
   *  account to put it in yet. */
  const gift = () => (accountHeld() ? null : offeredPromo())
  // Asks before the welcome's close or a Not now skips the voiceprint or plan.
  const skip = createSkipConfirm(props, planDueAtOpen, gift, PLAN_SKIP_ASK)

  // Keep shown with the gift card, counted once beside `onboarding_keep`.
  let keepGiftCounted = false
  createEffect(() => {
    if (currentBeat() !== 'keep' || gift() === null || keepGiftCounted) return
    keepGiftCounted = true
    trackOnboarding('onboarding_keep_gift')
  })

  /**
   * The gift on the Map (launch offer plan, section 4.1). A declined
   * microphone hears no offer here; it meets the gift in Karaoke Night and
   * Settings. Signed in, it is the one-tap claim for an account from before
   * the gift was claimed on confirmation, and nothing once it has it.
   */
  const mapGift = (): MapGift | null => {
    if (accountHeld()) {
      const waiting = giftWaiting()
      return waiting === null
        ? null
        : {
            kind: 'waiting',
            credits: waiting.credits,
            offer: giftOfferLine(waiting),
          }
    }
    const promo = offeredPromo()
    if (promo === null || micDenied()) return null
    const kind = voiceprint() !== null ? 'keep' : 'join'
    return {
      kind,
      credits: promo.credits,
      // The keep line names the gift without its count, so it carries no
      // offer line: "Use all 5" would point at nothing on screen.
      offer: kind === 'join' ? giftOfferLine(promo) : null,
    }
  }

  const handleMapGift = () => {
    const shown = mapGift()
    if (shown === null) return
    trackOnboarding('onboarding_map_gift_tap')
    if (shown.kind === 'waiting') {
      void claimGiftNow()
      return
    }
    if (shown.kind === 'keep') {
      rememberGiftOffered()
      handleReopenAccount()
      return
    }
    // The gift is song separations for Karaoke Night, so the welcome mail
    // wears that room's picture.
    rememberGiftOffered()
    openAuthModal('register', { signupSource: 'karaoke' })
  }

  // One funnel event per beat entered, including the first.
  createEffect(() => {
    const event = BEAT_EVENT[currentBeat()]
    if (event !== undefined) trackOnboarding(event)
  })

  const TRACK_EVENT = {
    full: 'onboarding_track_full',
    short: 'onboarding_track_short',
    gallery: 'onboarding_track_gallery',
  } as const

  const handleTrack = (track: OnboardingTrack) => {
    chooseTrack(track)
    trackOnboarding(TRACK_EVENT[track])
    advanceBeat()
  }

  /**
   * Where every "Not now" lands before the Map: the four questions while the
   * plan is due, and the Map once it is answered or turned down. Straight
   * there, never through the traversal: a replay that still holds this
   * session's voiceprint has the account ask due, and the next beat after
   * the Fork would be Keep (review of PR 977).
   */
  const afterFirstLight = () => openBeat(planDueAtOpen ? 'questions' : 'map')

  /**
   * The Fork's "Not now": past the walk, with nothing measured (owner
   * decision V3). It is the old "Take me in" card moved to the top right, so
   * it keeps that card's event, `onboarding_track_short`, and stays
   * countable apart from the welcome's skip (`onboarding_skipped`). The
   * voiceprint stays where it is (V13).
   */
  const handleForkNotNow = () => {
    chooseTrack('short')
    trackOnboarding(TRACK_EVENT.short)
    afterFirstLight()
  }

  /** Share the voiceprint that was just made. Resolves to a line worth
   *  saying afterwards, and only for the one outcome nothing else announces:
   *  the share sheet speaks for itself and a saved file shows in the browser,
   *  but a link on the clipboard is silent. */
  const handleShareVoiceprint = async (): Promise<string | null> => {
    const result = voiceprint()
    if (result == null) return null
    const outcome = await shareVoiceprintRecord(
      {
        id: 'fresh',
        summary: summarize(result),
        twin: twin(),
        source: 'onboarding',
        takenAt: new Date().toISOString(),
      },
      'face',
    )
    // First Light's own share count. Not the Mirror's `card_shared`: that one
    // is a live Google Ads conversion and has to go on meaning a share from
    // the Voice Mirror. Counted whichever way the card left, but not when the
    // sheet was opened and dismissed, and not when there was nothing to share.
    if (
      outcome === 'shared' ||
      outcome === 'downloaded' ||
      outcome === 'downloaded-link-copied'
    )
      trackOnboarding('onboarding_share')
    return outcome === 'downloaded-link-copied'
      ? shareOutcomeMessage(outcome)
      : null
  }

  /** A returning singer's fresh take: the Voice Mirror, where a voiceprint
   *  is made outside the flow (owner decision V12). */
  const handleAnotherVoiceprint = () => {
    trackOnboarding('onboarding_another_voiceprint')
    leave()
    window.location.href = '/mirror'
  }

  const latestSaved = () => savedVoiceprints()[0] ?? null

  const savedWhen = (): string | null => {
    const record = latestSaved()
    if (record === null) return null
    const date = new Date(record.takenAt)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  /** The live mic level while First light listens, 0 otherwise. */
  const [voiceLevel, setVoiceLevel] = createSignal(0)
  /** That level as the star's glow, 0 to 1, on the meter's own scale. */
  const voiceGlow = (): number => Math.min(1, voiceLevel() * 12)

  const handleHeard = (note: SettledNote) => {
    trackOnboarding('onboarding_mic_granted')
    recordFirstNote(note.note)
  }

  /**
   * The mic is unusable. Marking it denied makes every beat except the
   * questions and the Map inapplicable (neither needs a microphone), so a
   * single advance lands on the next of them: no special-case jump, and the
   * progress bar stays honest.
   */
  const handleMicDenied = () => {
    trackOnboarding('onboarding_mic_denied')
    markMicDenied()
    advanceBeat()
  }

  const handleVoiceprint = (result: MirrorResult, glides: F0Frame[][]) => {
    // The glides travel on as one line for the twin's stat card.
    recordVoiceprint(result, glideStrip(glides, result.range))
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
  const handleRoomTour = (
    target: RoomTarget,
    tab: ActiveTab,
    roomId: RoomId,
  ) => {
    trackOnboarding('onboarding_map_room')
    trackOnboarding(MAP_ROOM_EVENT[roomId])
    if (target.kind === 'tab') setActiveTab(target.tab as ActiveTab)
    leave()
    startPageTour(tab)
  }

  const handleCreateAccount = () => {
    if (hasUpgradedAccount()) {
      // A real account appeared mid-flow (another tab, or after the
      // mount check): there is nothing to create. Just move on.
      advanceBeat()
      return
    }
    trackOnboarding('onboarding_account_created')
    if (gift() !== null) rememberGiftOffered()
    // The shared AuthModal on its register pane - no navigation hand-off.
    // The old '#/settings/account' hash-jump left the flow entirely, which
    // raced the teardown (a dead first click in testing), landed on a
    // signed-out settings section, AND skipped what comes after Keep - the
    // four questions while the plan is due, the Map once it is answered -
    // so creating an account was the one path that never saw it. The modal
    // (z 3200) opens above the flow (z 3000); underneath, the flow advances
    // to that next beat, so closing the modal lands exactly where the button
    // promised. A Google sign-up resumes there too (armOnboardingResume).
    advanceBeat()
    openAuthModal('register')
  }

  /**
   * The Map's way back to the account offer. Unlike handleCreateAccount
   * it does not advance — the Map is already the last beat, and closing
   * the modal should leave them looking at the map they were reading.
   */
  const handleReopenAccount = () => {
    trackOnboarding('onboarding_account_created')
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
    // The intro was met and skipped, and that is the visitor's answer: the
    // app never takes the plan over later.
    markPlanShown('welcome-skip')
    leave()
  }

  /**
   * "Not now" on First light, the voiceprint, the twin and the prints: where
   * the Fork's does (owner decision V9, 11 Oct 2026), rather than out of the
   * flow onto an app the visitor has not been shown. Nothing is measured on
   * the way: a voiceprint run in progress is dropped with its beat. The
   * event stays `onboarding_skipped`, so the skip rate reads straight across
   * the change; the next beat then counts its own arrival.
   */
  const handleNotNow = () => {
    trackOnboarding('onboarding_skipped')
    afterFirstLight()
  }

  /** The beats that are mostly words: the sky recedes behind them, so its
   *  lines do not run through the copy. */
  const textHeavy = (): boolean =>
    currentBeat() === 'map' ||
    currentBeat() === 'keep' ||
    currentBeat() === 'questions'

  /** The picture behind the current beat (plates.ts). */
  const plate = (): Plate => plateFor(currentBeat())

  /** Is Merc drawn where the star field's arc runs: on a plate, or on the questions? */
  const fieldAway = (): boolean =>
    plate() !== 'plain' || currentBeat() === 'questions'

  /** The plain sky recedes behind the word beats, and behind the
   *  voiceprint: on a wide screen its brightest lines cross the step
   *  counter and the instructions at the top of the frame (measured at
   *  2.1:1 against the counter before this). The stars stay as they are;
   *  only the picture steps back. */
  const plateRecedes = (): boolean =>
    textHeavy() || currentBeat() === 'voiceprint'

  // Fetch the next beats' pictures while this one is being read, so the
  // next plate fades in on its picture rather than on an empty frame.
  const fetched = new Set<string>()
  createEffect(() => {
    const ahead = platesAhead(currentBeat())
    if (ahead.length === 0 || typeof Image === 'undefined') return
    const tall =
      typeof window.matchMedia === 'function' &&
      window.matchMedia(TALL_QUERY).matches
    for (const next of ahead) {
      const src = plateSrc(next, tall)
      if (fetched.has(src)) continue
      fetched.add(src)
      const image = new Image()
      image.decoding = 'async'
      image.src = src
    }
  })

  const handleDone = () => {
    trackOnboarding('onboarding_done')
    leave()
  }

  const isRoomId = (id: EnteredRoomId): id is RoomId =>
    Object.hasOwn(MAP_ROOM_EVENT, id)

  /** Opens a room's tab or page, and closes the flow. */
  const goTo = (target: RoomTarget) => {
    if (target.kind === 'tab') {
      setActiveTab(target.tab)
      leave()
      return
    }
    // A page target is a real navigation (Karaoke, Mirror, Glass) —
    // close the flow first so returning via Back doesn't land back
    // inside onboarding.
    leave()
    window.location.href = target.href
  }

  const handleEnterRoom = (target: RoomTarget, roomId: EnteredRoomId) => {
    trackOnboarding('onboarding_map_room')
    // A room counts which room it was, a door under the grid which door.
    if (isRoomId(roomId)) trackOnboarding(MAP_ROOM_EVENT[roomId])
    const door = SIDE_DOORS.find((d) => d.id === roomId)
    if (door !== undefined) trackOnboarding(door.event)
    console.info('[onboarding] entering room', roomId)
    goTo(target)
  }

  /**
   * A stop of the plan, entered as a room is. The plan counted it itself
   * (`plan_stop_*`), so it is not a Map room here. `tour` asks for the
   * room's spotlight tour too, and a room without one is simply entered.
   */
  const handleEnterStop = (target: RoomTarget, tour: boolean) => {
    goTo(target)
    if (tour && target.kind === 'tab' && hasPageTour(target.tab)) {
      startPageTour(target.tab)
    }
  }

  // aria-modal is a claim; holding focus is what makes it true. Without
  // the trap the overlay never took focus, so the first Tab landed in the
  // obscured app behind it (CLAUDE-JOURNEY-018). Same shared trap as every
  // other modal: focus in on open, Tab cycles inside, focus restored on
  // unmount. No onClose — Escape must not skip onboarding; leaving is a
  // deliberate choice the beats themselves offer.
  //
  // Focus opens on the beat, not on the first control in the DOM: that is
  // the close button at the top right, and focused on open it wore its
  // ring on the welcome, pointing at the way out. From the beat, the first
  // Tab reaches the beat's own button.
  let overlayRef: HTMLDivElement | undefined
  let frameRef: HTMLDivElement | undefined
  useFocusTrap(() => overlayRef, {
    isOpen: () => true,
    // The app's shortcuts listen on window and the flow opens over live tabs:
    // Space would play the tab behind and kill a button's activation, M would
    // toggle the microphone. A stopped keydown never reaches Solid's delegated
    // listeners (on the document), so key handlers in here are native
    // (`on:keydown`), as the Map's tour link is.
    isolateKeyboard: isolateKeys,
    initialFocus: () => frameRef,
  })

  // Every beat after the first opens on its heading, focused by script
  // (tabindex -1, so never a Tab stop), and at the top of the frame. A
  // screen reader announces where the visitor landed, and the next Tab
  // starts inside the new beat. Without it the button that was just
  // pressed unmounted with its beat, focus fell to the page, and the
  // trap's fallback handed the next Tab to the first control in the
  // overlay, which was the way out.
  createEffect(
    on(
      currentBeat,
      () => {
        const frame = frameRef
        if (frame === undefined) return
        frame.scrollTop = 0
        const heading = frame.querySelector<HTMLElement>('[data-beat] h1')
        if (heading === null) return
        heading.tabIndex = -1
        heading.focus({ preventScroll: true })
      },
      { defer: true },
    ),
  )

  return (
    <div
      ref={overlayRef}
      class={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to MercuryPitch"
      // Takes focus from a press, never from Tab. A press on the overlay
      // outside the frame (the picture behind the beat, the rail) would drop
      // focus to the page, and a key sent from there is not stopped by
      // isolateKeyboard, which holds only for keys sent from inside. The frame
      // does the same for its own words. No ring: `.overlay:focus`.
      tabIndex={-1}
      // A stable hook for the E2E overlay helper. The class is a CSS
      // module, so its name is a build hash and nothing outside this file
      // can match on it — which is exactly how this flow ended up
      // swallowing the clicks of every spec that dismisses overlays.
      data-onboarding-flow
    >
      {/* Keyed, so a new picture mounts fresh and fades in over the
          ground rather than snapping in under the beat's own entrance. */}
      <Show when={plate()} keyed>
        {(art) => (
          <div
            class={`${styles.plate} ${
              art === 'plain'
                ? plateRecedes()
                  ? styles.plateRecede
                  : ''
                : styles.plateArt
            }`}
            data-plate={art}
            aria-hidden="true"
          >
            {/* First light's star is painted apart from its picture, so
                the sky stays dark until the first note lands (owner
                decision V11). Before that, a glow where it will light
                follows the voice; the note lights the star itself. It
                stays lit behind the Fork, which shares the picture. */}
            <Show when={art === 'first-light'}>
              <span
                class={styles.plateStar}
                data-star
                data-lit={firstNote() !== null ? 'true' : 'false'}
                style={{
                  '--voice': String(Math.round(voiceGlow() * 100) / 100),
                }}
              >
                <span class={styles.plateStarGlow} />
                <span class={styles.plateStarLight} />
              </span>
            </Show>
          </div>
        )}
      </Show>
      {/* The arc is the same walk the hairline measures, drawn as a
          journey: one bead per beat, lit behind, accented under foot,
          hollow ahead. */}
      {/* Merc's plates paint their own sky, and the questions draw Merc
          themselves, at the top of the frame, where the arc runs (his box
          spans about 60-156 px on a phone, the arc about 90-141 px of 844).
          On a phone the arc's beads would sit on Merc himself in both, so
          the field steps out while either is up. It stays mounted, so its
          sweep and lit beads are where they were when it comes back, and
          paused, so it draws nothing while it is away. The hairline still
          shows the progress. */}
      <div
        class={styles.field}
        classList={{ [styles.fieldAway]: fieldAway() }}
        aria-hidden="true"
      >
        <StarField
          recede={textHeavy()}
          paused={fieldAway()}
          beads={onboardingBeads().count}
          beadIndex={onboardingBeads().index}
        />
      </div>

      <div ref={frameRef} class={styles.frame} tabIndex={-1}>
        <Switch>
          <Match when={currentBeat() === 'sky'}>
            <BeatSky onContinue={() => advanceBeat()} />
          </Match>
          <Match when={currentBeat() === 'first-light'}>
            <BeatFirstLight
              onHeard={handleHeard}
              onContinue={() => advanceBeat()}
              onDenied={handleMicDenied}
              onLevel={setVoiceLevel}
            />
          </Match>
          <Match when={currentBeat() === 'fork'}>
            <BeatFork
              firstNote={firstNote()}
              savedCount={savedVoiceprints().length}
              savedWhen={savedWhen()}
              onChoose={handleTrack}
              onAnother={handleAnotherVoiceprint}
            />
          </Match>
          <Match when={currentBeat() === 'prints'}>
            <BeatPrints
              records={savedVoiceprints()}
              planDue={planDueAtOpen}
              onContinue={() => advanceBeat()}
              onAnother={handleAnotherVoiceprint}
              onExplore={openVoiceConstellation}
            />
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
              strip={voiceStrip()}
              planDue={planDueAtOpen}
              onContinue={() => advanceBeat()}
              onShare={handleShareVoiceprint}
            />
          </Match>
          <Match when={currentBeat() === 'map'}>
            <BeatMap
              voiceprint={voiceprint()}
              replay={props.replay}
              onEnter={handleEnterRoom}
              onTour={handleRoomTour}
              onDone={handleDone}
              /* Only when there is something to save and nothing holding
                 it. Not gated on shouldShowNudge: the quiet period exists
                 to stop the OFFER from re-asking, and this is not an ask
                 — it is the way back for somebody who just closed the
                 form, which is exactly the moment a quiet period would
                 hide it. `accountHeld` is reactive, so it disappears the
                 moment they sign up without the flow being re-entered. */
              onKeep={
                voiceprint() !== null && !accountHeld()
                  ? handleReopenAccount
                  : undefined
              }
              gift={mapGift()}
              onGift={handleMapGift}
              onStoreClick={(store) => trackOnboarding(MAP_STORE_EVENT[store])}
            />
          </Match>
          <Match when={currentBeat() === 'keep'}>
            <BeatKeep
              twin={twin()}
              voiceprint={voiceprint()}
              strip={voiceStrip()}
              gift={gift()}
              onCreateAccount={handleCreateAccount}
            />
          </Match>
          <Match when={currentBeat() === 'questions'}>
            <BeatPlan
              voiceprint={() => pickFirstStop(voiceprint())}
              gift={mapGift}
              onHome={leave}
              askBeforeDecline={(decline) => skip.ask('plan', decline)}
              onRooms={() => openBeat('map')}
              onEnterStop={(stop, tour) =>
                handleEnterStop(PLAN_DESTS[stop.dest].target, tour)
              }
            />
          </Match>
        </Switch>
      </div>

      {/* After the frame in the DOM, so Tab reaches the beat's own controls
          before the way out; `order` keeps it at the top on screen. */}
      <div class={styles.rail}>
        <div class={styles.progress}>
          {/* Floored at 10%: an empty bar on the first screen reads as
              "nothing has happened yet", and endowed progress is the
              cheapest honest encouragement we have. */}
          <div
            class={styles.progressFill}
            style={{
              width: `${Math.max(10, Math.round(onboardingProgress() * 100))}%`,
            }}
          />
        </div>
        {/* One way out, top right, and never two (owner decisions V1 and
            V8). The welcome's is a close button: the beat itself carries
            one action. Everywhere else it is "Not now", in words. On Keep
            it declines the account and moves on (to the four questions
            while the plan is due, else the Map), at full contrast:
            declining is an answer to the question on screen. On
            the Fork it is the old "Take me in" card, so it lands past the
            walk without a voiceprint. On the other beats it lands there
            too (V9). The questions and the plan carry their own Not now,
            in the corner of their own box, so the rail adds none. The Map
            is the last beat; its rooms are the way out. */}
        <Switch>
          <Match when={currentBeat() === 'sky'}>
            <button
              type="button"
              class={styles.railClose}
              aria-label="Skip the intro"
              title="Skip the intro"
              onClick={() => skip.ask('intro', handleSkip)}
            >
              <span aria-hidden="true">
                <X />
              </span>
            </button>
          </Match>
          <Match when={currentBeat() === 'keep'}>
            <button
              type="button"
              class={styles.railAction}
              onClick={handleDismissAccount}
            >
              Not now
            </button>
          </Match>
          <Match when={currentBeat() === 'fork'}>
            <button
              type="button"
              class={styles.railNotNow}
              onClick={() => skip.ask('voiceprint', handleForkNotNow)}
            >
              Not now
            </button>
          </Match>
          <Match
            when={currentBeat() !== 'map' && currentBeat() !== 'questions'}
          >
            <button
              type="button"
              class={styles.railNotNow}
              onClick={() => skip.ask('voiceprint', handleNotNow)}
            >
              Not now
            </button>
          </Match>
        </Switch>
      </div>
      <skip.Confirm />
    </div>
  )
}

export default FirstLight
