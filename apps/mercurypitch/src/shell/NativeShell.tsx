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
import { nativeRunControls, registerShellApi, } from '@/stores/native-shell-store'
import { practiceScope } from '@/stores/settings-store'
import { registerShellBackHandler } from '../infrastructure/native-shell'
import { CornerTabs } from './CornerTabs'
import { Dock } from './Dock'
import { KeepAlert } from './KeepAlert'
import { MoreSheet } from './MoreSheet'
import { PushedScreen } from './PushedScreen'
import { Rail } from './Rail'
import { RoomHeader } from './RoomHeader'
import { chipVisible, closeColumn, closeMore, columnOpen, currentTab, elapsedMs, finishRun, keepAlertOpen, locked, moreOpen, openMore, parked, popScreen, pushed, pushScreen, railVisible, requestEnd, runLabel, runState, shellAnnouncement, toggleColumn, toggleLock, togglePlayPause, transportVisible, } from './run-shell-store'
import { SessionPill } from './SessionPill'
import { goToTab, performBack, railItems, returnToRun, selectedRailItem, } from './shell-navigation'
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
      registerShellBackHandler(() => performBack(backHost()) !== 'minimize'),
    )

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

  // The room header is fixed chrome over the top of the room, so the app's
  // scroller has to start below it. The attribute is how mobile-kit.css knows.
  createEffect(() => {
    if (room() !== null) {
      document.documentElement.setAttribute('data-room-header', 'on')
    } else {
      document.documentElement.removeAttribute('data-room-header')
    }
  })

  const backHost = () => ({
    historyDepth: window.history.length,
    back: () => {
      window.history.back()
    },
    minimize: () => {
      // Nothing to minimise to in a browser. The native back handler in
      // infrastructure/native-shell.ts owns that half; a keyboard Back that
      // reaches the root simply stays put.
    },
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
                  performBack(backHost())
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
        </ShellRoot>
      </Portal>

      <MoreSheet
        open={moreOpen}
        onClose={closeMore}
        onPushSettings={() => {
          pushScreen('settings')
        }}
      />

      <KeepAlert
        open={keepAlertOpen}
        onDiscard={finishRun}
        onKeep={finishRun}
      />
    </>
  )
}
