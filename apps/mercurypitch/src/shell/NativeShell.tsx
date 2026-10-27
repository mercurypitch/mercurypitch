// ============================================================
// NativeShell — the chrome around the app, and the only thing main.tsx mounts
// ============================================================
//
// A sibling of <App />, not a wrapper: every piece of chrome it draws is
// fixed to the viewport through one portal to <body>, at `--z-rail` — above a
// stage (which portals itself to `--z-stage`) and below a sheet. Nothing here
// is inside the app's own tree, so nothing here can be clipped by a stage's
// `overflow: hidden` or pinned by a `transform` on an ancestor.
//
// It renders in the native bundle only. The web app keeps its BottomTabBar,
// its header and its sidebar; those three unmount under `IS_NATIVE_BUILD` in
// `src/App.tsx`, which is the whole of the change on that side.
//
// WHAT IT OWNS: the rail, the transport that replaces it during a run, the
// corner chip and its column, the session pill, the More sheet, the room
// header on a room that registered controls, and the native Settings with
// the screens it pushes. WHAT IT DOES NOT: the run itself. The room owns Start, the engine
// and the microphone; the shell only asks it to pause, resume, stop or park
// (src/stores/native-shell-store.ts).

import { hapticTap, openAppSettings, } from '@irchiinnuss/mobile-runtime/platform'
import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, lazy, onCleanup, onMount, Show, } from 'solid-js'
import { Portal } from 'solid-js/web'
import './shell.css'
import { TAB_HOME } from '@/features/tabs/constants'
import { KARAOKE_IMPORT, NATIVE_ONBOARDING, PREMIUM_EXERCISES, } from '@/lib/native-build'
import { exposeForE2E } from '@/lib/test-utils'
import { nativeRunControls, registerShellApi, setShellOwnsTransport, } from '@/stores/native-shell-store'
import { onUnlockShown, setNotificationPresenter, showActionNotification, showNotification, } from '@/stores/notifications-store'
import { practiceScope } from '@/stores/settings-store'
import { RoomsAlley } from '../alley/RoomsAlley'
import { registerShellBackHandler } from '../infrastructure/native-shell'
import { installNativeOnboarding, onboardingMounted, } from '../onboarding/onboarding-layer'
import { CornerTabs } from './CornerTabs'
import { Dock } from './Dock'
import { installHistoryDepth } from './history-depth'
import { installKaraokeImport } from './karaoke-import-wiring'
import { KeepAlert } from './KeepAlert'
import { MoreSheet } from './MoreSheet'
import { NoticePill } from './NoticePill'
import { installPortraitLock } from './portrait-lock'
import { installPremiumExercises } from './premium-exercise-wiring'
import { Rail } from './Rail'
import { RoomHeader } from './RoomHeader'
import { chipVisible, closeColumn, closeMore, columnOpen, countInBeat, countingIn, currentTab, elapsedMs, finishRun, keepAlertOpen, locked, moreOpen, openMore, parked, pushScreen, pushSettingsScreen, pushSettingsSection, railVisible, requestEnd, roomHeaderVisible, runLabel, runState, shellAnnouncement, toggleColumn, toggleLock, togglePlayPause, touchColumn, transportVisible, } from './run-shell-store'
import { SessionPill } from './SessionPill'
import { resumeAfterDeletion } from './settings/account-deletion'
import { installAccountOffer, openKeep } from './settings/account-offer'
import { AccountOfferSheet } from './settings/AccountOffer'
import { SettingsAlert } from './settings/SettingsAlert'
import { openSignIn } from './settings/sign-in-state'
import { SignInSheet } from './settings/SignInSheet'
import { VoiceprintAskSheet } from './settings/VoiceprintAsk'
import { mirrorShellChrome } from './shell-attributes'
import { goToTab, performBack, railItems, returnToRun, selectedRailItem, shellBackHost, } from './shell-navigation'
import { ShellCloudOffer } from './ShellCloudOffer'
import { ShellRoot } from './ShellRoot'
import { ShellScreens } from './ShellScreens'
import { Transport } from './Transport'

/** Scroll past this, downward, and the rail folds to the current tab. */
const MINIMISE_AT = 24

/**
 * The developer screen exists on a test build and on no other.
 *
 * Lazy AND behind the constant, which is the same pattern the portable console
 * uses in `main.tsx`. The ternary is what does the work: the constant folds to
 * a literal, so a store build keeps only the `() => null` arm and the dynamic
 * import goes with the branch — no chunk is emitted at all. Behind a `Show`
 * alone the factory still existed, and Rollup still wrote the chunk; behind a
 * static import the screen would have shipped whatever the flag said.
 */
const DEVELOPER_AVAILABLE = import.meta.env.VITE_PORTABLE_CONSOLE === 'true'

const DeveloperScreen: Component = DEVELOPER_AVAILABLE
  ? lazy(async () =>
      import('./DeveloperScreen').then((module) => ({
        default: module.DeveloperScreen,
      })),
    )
  : () => null

/**
 * The Long note exercise, on a build with the premium exercises and no other
 * (`PREMIUM_EXERCISES`, src/lib/native-build.ts). The same ternary as the
 * developer screen, for the same reason: the store build keeps no chunk.
 */
const LongNoteScreen: Component = PREMIUM_EXERCISES
  ? lazy(async () =>
      import('./LongNoteScreen').then((module) => ({
        default: module.LongNoteScreen,
      })),
    )
  : () => null

/** The Echo exercise: the same ternary as Long note's, for the same reason. */
const EchoScreen: Component = PREMIUM_EXERCISES
  ? lazy(async () =>
      import('./EchoScreen').then((module) => ({
        default: module.EchoScreen,
      })),
    )
  : () => null

/** The Lip roll exercise: the same ternary as Long note's, for the same reason. */
const LipRollScreen: Component = PREMIUM_EXERCISES
  ? lazy(async () =>
      import('./LipRollScreen').then((module) => ({
        default: module.LipRollScreen,
      })),
    )
  : () => null

/** The Ng slides exercise: the same ternary as Long note's, for the same reason. */
const NgSlidesScreen: Component = PREMIUM_EXERCISES
  ? lazy(async () =>
      import('./NgSlidesScreen').then((module) => ({
        default: module.NgSlidesScreen,
      })),
    )
  : () => null

/** The Warm-up's path: the same ternary as Long note's, for the same reason. */
const WarmUpScreen: Component = PREMIUM_EXERCISES
  ? lazy(async () =>
      import('./WarmUpScreen').then((module) => ({
        default: module.WarmUpScreen,
      })),
    )
  : () => null

/** Home note, the first Ear room: the same ternary as Long note's. */
const HomeNoteScreen: Component = PREMIUM_EXERCISES
  ? lazy(async () =>
      import('./HomeNoteScreen').then((module) => ({
        default: module.HomeNoteScreen,
      })),
    )
  : () => null

/**
 * The native onboarding (src/onboarding), on a build with it
 * (`NATIVE_ONBOARDING`) and no other: the same ternary as Long note's. It
 * loads when it first opens, on a new install's first Sing door, so a phone
 * that has finished it never fetches the chunk.
 */
const NativeOnboarding: Component = NATIVE_ONBOARDING
  ? lazy(async () =>
      import('../onboarding/NativeOnboarding').then((module) => ({
        default: module.NativeOnboarding,
      })),
    )
  : () => null

export const NativeShell: Component = () => {
  const [minimised, setMinimised] = createSignal(false)

  const scope = () => practiceScope()
  const items = () => railItems(scope())
  const selected = () => selectedRailItem(currentTab(), scope())
  const stage = (): 'sing' | 'guitar' | 'piano' =>
    scope() === 'guitar' ? 'guitar' : scope() === 'piano' ? 'piano' : 'sing'

  // A room that registered controls is a room the shell can put a header on:
  // the chip's name and the gear's sheet both come from it. Today only the
  // Sing stage does (build brief §6a).
  const room = createMemo(() => {
    const controls = nativeRunControls()
    if (controls === null) return null
    return controls.tab === currentTab() ? controls : null
  })

  onMount(() => {
    document.documentElement.setAttribute('data-native-shell', '')

    // Notices are the shell's pill here, one at a time under the status
    // bar, not the web's toasts (NoticePill.tsx). An unlock that reaches
    // the screen, in the pill or in a room's chip, is a light tap too.
    setNotificationPresenter('pill')
    onCleanup(() => {
      setNotificationPresenter('toast')
    })
    onCleanup(
      onUnlockShown(() => {
        void hapticTap()
      }),
    )

    // Before the back handler: `canGoBack()` is meaningless until the boot
    // entry has been stamped.
    onCleanup(installHistoryDepth())
    onCleanup(() => {
      document.documentElement.removeAttribute('data-native-shell')
      document.documentElement.removeAttribute('data-room-header')
    })

    // A deletion restarts the app (account-deletion.ts): it comes back on
    // Settings, where one line says what happened.
    resumeAfterDeletion()

    // The account offer (S6 decision 02): once on this phone, a beat after
    // a take is kept in the Sing room (account-offer.ts).
    onCleanup(installAccountOffer())

    // Stage 2 of the Karaoke room (plan S8): the queue that sends imported
    // songs, and the store its paywall reaches. Nothing in a build without
    // Import (karaoke-import-wiring.ts).
    const karaoke = installKaraokeImport()
    onCleanup(karaoke.stop)

    // The shell's half of the bridge: a room's own options sheet ends with an
    // "All settings" row, and this is the only way it can reach a screen the
    // shell pushes.
    onCleanup(
      registerShellApi({
        ...karaoke.api,
        // Natively every "open Settings at <section>" lands here
        // (ui-store's openSettingsSection). The account and Karaoke have a
        // screen of their own to open at; anything else is Settings itself.
        pushSettings: (section) => {
          pushSettingsSection(section)
        },
        // A room's way to a test build's switches: the Karaoke stage's card
        // for a song it refused (stem-memory.ts). The Developer screen, then
        // its section brought into view once it has drawn.
        ...(DEVELOPER_AVAILABLE
          ? {
              openDeveloperSection: (id: string) => {
                pushScreen('developer')
                requestAnimationFrame(() => {
                  document
                    .querySelector(
                      `[data-developer-section="${CSS.escape(id)}"]`,
                    )
                    ?.scrollIntoView({ block: 'start' })
                })
              },
            }
          : {}),
        // The Sing room's denied state (3d) is the one caller: a refused
        // microphone can only be undone in the system's own Settings.
        openAppSettings: () => openAppSettings(),
        // Every in-app "Sign in" (ui-store's openAuthModal) lands here.
        openSignIn,
        // Keep, the account offer, for whatever offers a free account: the
        // Cloud offer's free song (S7b §5).
        openKeep,
        // The Karaoke room's "Manage songs" (S8 §11, D8 A).
        openKaraokeStudio: () => {
          pushScreen('karaoke-studio')
        },
        // The Sing room opens a premium exercise by id: from its row, its
        // picker and its options. Absent on a build without them, so the
        // room draws no way in (premium-exercise-wiring.ts).
        ...installPremiumExercises(),
      }),
    )

    // Android's hardware back, the room header's Back and a keyboard Back are
    // one press with one order. `false` is the press that reached the root,
    // and the wiring in infrastructure/native-shell.ts minimizes on it.
    onCleanup(
      registerShellBackHandler(
        () => performBack(shellBackHost()) !== 'minimize',
      ),
    )

    // The same press, reachable from a headless walk. Android's button is the
    // only thing that fires the handler above, and no browser has one — so
    // the probe would otherwise have to assert the back ORDER by inference.
    // `exposeForE2E` writes nothing unless `window.E2E_TEST_MODE` is set, so
    // a shipped build carries the call and not the global.
    exposeForE2E('mpShellBack', () => performBack(shellBackHost()))
    // Notices, raised the way the app raises them, for the walk that checks
    // where the pill lands (scripts/probe-notices.mjs). Gated the same way.
    exposeForE2E('mpNotices', {
      show: showNotification,
      showAction: showActionNotification,
    })

    // Escape closes the column, which is the only thing on this surface that
    // traps a keyboard user.
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (!columnOpen()) return
      event.preventDefault()
      closeColumn()
    }
    window.addEventListener('keydown', onKeyDown)
    onCleanup(() => {
      window.removeEventListener('keydown', onKeyDown)
    })

    // A tap on the stage closes the column (brief §6). Capture phase and
    // `pointerdown`, so it answers the touch that starts the gesture rather
    // than a click the stage may swallow; the corner's own taps are exempt,
    // because the chip toggles and the column's items navigate.
    const onPointerDown = (event: PointerEvent): void => {
      if (!columnOpen()) return
      const target = event.target
      if (target instanceof Element && target.closest('.mp-corner') !== null) {
        return
      }
      closeColumn()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown, true)
    })

    // Minimised-on-scroll, driven by `.main-content` — the app's scroller.
    // The document itself never scrolls here, so a listener on `window` would
    // never fire. Scroll does not bubble, so this listens in the capture
    // phase rather than hunting for an element that is replaced per tab.
    let lastTop = 0
    const onScroll = (event: Event): void => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (!target.classList.contains('main-content')) return
      const top = target.scrollTop
      if (top <= 8) setMinimised(false)
      else if (top > lastTop && top > MINIMISE_AT) setMinimised(true)
      else if (top < lastTop) setMinimised(false)
      lastTop = top
    }
    document.addEventListener('scroll', onScroll, true)
    onCleanup(() => {
      document.removeEventListener('scroll', onScroll, true)
    })
  })

  // Two pieces of fixed chrome the room's own scroller has to keep clear of:
  // the header above it, and the corner chip at its right edge while a run is
  // going — the trace head is the newest pixels and they are on that side.
  // The attributes are how mobile-kit.css knows.
  createEffect(() => {
    const root = document.documentElement
    if (room() !== null) root.setAttribute('data-room-header', 'on')
    else root.removeAttribute('data-room-header')
  })

  createEffect(() => {
    const root = document.documentElement
    if (chipVisible()) root.setAttribute('data-shell-chip', 'on')
    else root.removeAttribute('data-shell-chip')
  })

  // The one question a room asks before drawing a transport of its own.
  createEffect(() => {
    setShellOwnsTransport(transportVisible())
  })

  // Whether the rail is on screen, for a room whose own bar rests on it.
  mirrorShellChrome()
  // A phone holds a premium room upright (portrait-lock.ts, decision D2).
  installPortraitLock()
  // The onboarding opens over the first Sing room of a new install
  // (onboarding-layer.ts). A plain conditional, so a store build folds it.
  if (NATIVE_ONBOARDING) installNativeOnboarding()

  onCleanup(() => {
    setShellOwnsTransport(false)
    document.documentElement.removeAttribute('data-shell-chip')
  })

  return (
    <>
      <Portal>
        <ShellRoot>
          {/* The Rooms tab under the native build is the alley (S4), drawn
              here rather than by the app's HomePage because it steers the
              shell's own navigation and haptics, which the shared tree
              cannot import. Under the rail, like a stage. */}
          <Show when={currentTab() === TAB_HOME}>
            <RoomsAlley />
          </Show>

          <Show when={room()}>
            {(controls) => (
              <RoomHeader
                title={() => controls().roomLabel}
                visible={roomHeaderVisible}
                onBack={() => {
                  performBack(shellBackHost())
                }}
                onGear={controls().openOptions}
                gearLabel={controls().optionsLabel}
                pinned={controls().pinnedToggle}
                // The chip is a button only where the room answers for one:
                // the shell owns no picker of its own (R5).
                onChip={controls().openRoomPicker}
              />
            )}
          </Show>

          <Dock
            railIn={railVisible}
            transportIn={transportVisible}
            accessory={
              parked() ? (
                <SessionPill label={runLabel} onReturn={returnToRun} />
              ) : null
            }
            rail={
              <Rail
                items={items}
                selected={selected}
                stage={stage}
                minimised={() => minimised() && railVisible()}
                onPick={(item) => {
                  if (item.tab === null) openMore()
                  else goToTab(item.tab)
                }}
              />
            }
            transport={
              <Transport
                elapsedMs={elapsedMs}
                playing={() => runState() === 'active'}
                locked={locked}
                countingIn={countingIn}
                countInBeat={countInBeat}
                onStop={requestEnd}
                onToggle={togglePlayPause}
                onToggleLock={toggleLock}
              />
            }
          />

          <CornerTabs
            visible={chipVisible}
            open={columnOpen}
            locked={locked}
            dot={() => false}
            current={selected}
            stage={stage}
            items={items}
            onToggle={toggleColumn}
            onTouch={touchColumn}
            onPick={(item) => {
              if (item.tab === null) openMore()
              else goToTab(item.tab)
            }}
          />

          <span class="mp-sr-only" aria-live="polite">
            {shellAnnouncement()}
          </span>

          {/* Settings and the screens its rows push, and Developer: one
              stack, and only its top screen drawn (ShellScreens.tsx). The
              web SettingsPanel is not in this bundle at all. */}
          <ShellScreens
            developer={DEVELOPER_AVAILABLE ? DeveloperScreen : undefined}
            longNote={PREMIUM_EXERCISES ? LongNoteScreen : undefined}
            echo={PREMIUM_EXERCISES ? EchoScreen : undefined}
            lipRoll={PREMIUM_EXERCISES ? LipRollScreen : undefined}
            ngSlides={PREMIUM_EXERCISES ? NgSlidesScreen : undefined}
            warmUp={PREMIUM_EXERCISES ? WarmUpScreen : undefined}
            homeNote={PREMIUM_EXERCISES ? HomeNoteScreen : undefined}
          />

          {/* Inside the root, not beside it: the sheet copies the custom
              properties that resolve on its anchor onto its own portal, and
              the alert has none of its own — so outside, both would animate
              at full speed on a phone that asked for reduced motion. */}
          <MoreSheet
            open={moreOpen}
            onClose={closeMore}
            onPushSettings={() => {
              pushScreen('settings')
            }}
            onPushAccount={() => {
              pushSettingsScreen('account')
            }}
            onPushDeveloper={() => {
              pushScreen('developer')
            }}
          />

          <KeepAlert
            open={keepAlertOpen}
            onDiscard={finishRun}
            onKeep={finishRun}
          />

          {/* The native onboarding, over the rail and every pushed screen
              and under the sheets after it, which open over it. */}
          {NATIVE_ONBOARDING ? (
            <Show when={onboardingMounted()}>
              <NativeOnboarding />
            </Show>
          ) : null}

          {/* Keep, the account offer: over the Sing room after a Keep, and
              from Settings and the Cloud offer. Its Use email and a second
              factor hand over to the sign-in sheet. */}
          <AccountOfferSheet />

          {/* The Cloud offer (paywall B v2), opened by the Karaoke room's
              Import, Settings and the onboarding. Its free account opens
              Keep, and Sign in after a purchase the sign-in sheet
              (ShellCloudOffer). Stage 2: a plain conditional, so a store
              build folds it away. */}
          {KARAOKE_IMPORT ? <ShellCloudOffer /> : null}

          {/* The phone's one way in, over whatever asked for it: the
              Account screen's button, the offer and every in-app "Sign
              in". */}
          <SignInSheet />

          {/* After a sign-in to an account that already existed: whether
              this phone's voiceprints go to it (voiceprint-ask.ts). After
              the sign-in sheet, so it rises over it as that one goes. */}
          <VoiceprintAskSheet />

          {/* The question a Settings screen is asking, if any. After the
              sheet, so an alert asked over it is drawn over it. */}
          <SettingsAlert />

          {/* Last, so a notice is drawn over every sheet it lands on. */}
          <NoticePill />
        </ShellRoot>
      </Portal>
    </>
  )
}
