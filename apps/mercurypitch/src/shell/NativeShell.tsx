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
// header on a room that registered controls, and Settings inside a pushed
// screen. WHAT IT DOES NOT: the run itself. The room owns Start, the engine
// and the microphone; the shell only asks it to pause, resume, stop or park
// (src/stores/native-shell-store.ts).

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, } from 'solid-js'
import { Portal } from 'solid-js/web'
import './shell.css'
import { SettingsPanel } from '@/components/SettingsPanel'
import { exposeForE2E } from '@/lib/test-utils'
import { nativeRunControls, registerShellApi, setShellOwnsTransport, } from '@/stores/native-shell-store'
import { practiceScope } from '@/stores/settings-store'
import { registerShellBackHandler } from '../infrastructure/native-shell'
import { CornerTabs } from './CornerTabs'
import { DeveloperScreen } from './DeveloperScreen'
import { Dock } from './Dock'
import { installHistoryDepth } from './history-depth'
import { KeepAlert } from './KeepAlert'
import { MoreSheet } from './MoreSheet'
import { PushedScreen } from './PushedScreen'
import { Rail } from './Rail'
import { RoomHeader } from './RoomHeader'
import { chipVisible, closeColumn, closeMore, columnOpen, countInBeat, countingIn, currentTab, elapsedMs, finishRun, keepAlertOpen, locked, moreOpen, openMore, parked, popScreen, pushed, pushScreen, railVisible, requestEnd, runLabel, runState, shellAnnouncement, toggleColumn, toggleLock, togglePlayPause, touchColumn, transportVisible, } from './run-shell-store'
import { SessionPill } from './SessionPill'
import { goToTab, performBack, railItems, returnToRun, selectedRailItem, shellBackHost, } from './shell-navigation'
import { ShellRoot } from './ShellRoot'
import { Transport } from './Transport'

/** Scroll past this, downward, and the rail folds to the current tab. */
const MINIMISE_AT = 24

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

    // Before the back handler: `canGoBack()` is meaningless until the boot
    // entry has been stamped.
    onCleanup(installHistoryDepth())
    onCleanup(() => {
      document.documentElement.removeAttribute('data-native-shell')
      document.documentElement.removeAttribute('data-room-header')
    })

    // The shell's half of the bridge: a room's own options sheet ends with an
    // "All settings" row, and this is the only way it can reach a screen the
    // shell pushes.
    onCleanup(
      registerShellApi({
        pushSettings: () => {
          pushScreen('settings')
        },
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

  onCleanup(() => {
    setShellOwnsTransport(false)
    document.documentElement.removeAttribute('data-shell-chip')
  })

  return (
    <>
      <Portal>
        <ShellRoot>
          <Show when={room()}>
            {(controls) => (
              <RoomHeader
                title={() => controls().roomLabel}
                onBack={() => {
                  performBack(shellBackHost())
                }}
                onGear={controls().openOptions}
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

          <Show when={pushed() === 'settings'}>
            <PushedScreen title="Settings" onBack={popScreen}>
              <div id="settings-panel">
                <SettingsPanel />
              </div>
            </PushedScreen>
          </Show>

          <Show when={pushed() === 'developer'}>
            <PushedScreen title="Developer" onBack={popScreen}>
              <DeveloperScreen />
            </PushedScreen>
          </Show>

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
            onPushDeveloper={() => {
              pushScreen('developer')
            }}
          />

          <KeepAlert
            open={keepAlertOpen}
            onDiscard={finishRun}
            onKeep={finishRun}
          />
        </ShellRoot>
      </Portal>
    </>
  )
}
