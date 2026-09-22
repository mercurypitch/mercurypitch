// ── JamInputControl ──────────────────────────────────────────────────
// One control for "am I sending" and "what am I sending".
//
// It replaced a bare microphone toggle, and the icon was the smaller half
// of the problem. The room has always had exactly one transmit switch,
// labelled "Unmute microphone" whatever it was actually carrying -- so a
// guitarist with a DI'd instrument through an interface was told to turn
// their microphone on, and reasonably asked why. Nothing was being
// captured from a microphone.
//
// FEEDBACK IS THE REASON THIS IS NOT JUST A RENAME. The two profiles
// differ in one way that matters more than tone: `voice` sends a PROCESSED
// CLONE with echo cancellation on, and `instrument` sends the raw capture
// with none. Pick instrument while a microphone is the input and a speaker
// is the output and the room hears itself, immediately and loudly -- and
// the moment that is most likely is exactly when somebody is testing with
// a second device sitting next to them. So the choice is never more than
// one press away, the current one is legible without opening anything, and
// the consequence is stated where the choice is made rather than in a
// panel somebody has to go looking for.
//
// Modelled on Guitar Night's free-form mode picker: each option carries a
// label AND the sentence that makes it choosable, because "Voice" and
// "Instrument" alone do not tell you which one feeds back.
//
// Tests: src/tests/jam-input-control.test.tsx.

import type { Component, JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show, } from 'solid-js'
import { Portal } from 'solid-js/web'
import { ChevronDown, Guitar, Mic } from '@/components/icons'
import { createPortalSkinBridge } from '@/components/portal-skin'
import type { JamAudioProfile } from '@/lib/jam/jam-audio-source'
import { PROFILE_COPY } from '@/lib/jam/jam-audio-source'
import { jamAudioProfile, jamInputDeviceId, jamInputDevices, jamIsMuted, jamSourceConfirmed, refreshJamInputDevices, setJamAudioProfile, setJamInputDeviceId, setJamInputDeviceLabel, setJamSourceConfirmed, switchJamAudioSource, toggleJamMute, } from '@/stores/jam-store'
import styles from './JamInputControl.module.css'

const PROFILES: readonly JamAudioProfile[] = ['voice', 'instrument']

/**
 * What each choice does to the room, not what it does to the signal.
 *
 * PROFILE_COPY already says the tonal half. This is the half somebody
 * needs before they press it with speakers on.
 */
const CONSEQUENCE: Record<JamAudioProfile, string> = {
  voice: 'Echo cancellation on. Safe with speakers.',
  instrument: 'No echo cancellation. Headphones, or the room hears itself.',
}

/** Must match `.menu { width }` in the stylesheet. */
const MENU_WIDTH = 248
const MENU_MAX_HEIGHT = 300
const GAP = 6
const EDGE = 8

export interface MenuBox {
  top: number
  bottom: number
  left: number
}

/**
 * Where the menu opens, and the edge it hangs from.
 *
 * Opening upward it is anchored by its lower edge, not its top: its height
 * is its content's, and a top worked out from the cap left a shorter menu
 * floating clear of the button it belongs to.
 */
export type MenuPlacement =
  | { side: 'below'; top: number; left: number; maxHeight: number }
  | { side: 'above'; bottom: number; left: number; maxHeight: number }

/**
 * Where the menu goes, given where the button is and how tall the menu is.
 *
 * Pure, because the bug this fixes was geometry and geometry is testable:
 * the first version opened upward on a CSS rule borrowed from a bottom
 * toolbar, and this control is not in one -- so the menu opened off the
 * top of the page and could not be seen at all.
 *
 * Below whenever the menu fits there, judged on its real height rather
 * than the cap; above only when it does not and above is roomier. Either
 * way it is capped to the room on its side and scrolls inside it. On a
 * landscape phone the part that ran off the bottom edge was the feedback
 * warning, the one line in this menu that has to be read.
 */
export function menuPosition(
  button: MenuBox,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): MenuPlacement {
  const below = viewportHeight - button.bottom - GAP - EDGE
  const above = button.top - GAP - EDGE
  const left = Math.min(
    Math.max(EDGE, button.left),
    // Never past the right edge, and never negative on a viewport narrower
    // than the menu itself.
    Math.max(EDGE, viewportWidth - MENU_WIDTH - EDGE),
  )
  if (below >= Math.min(menuHeight, MENU_MAX_HEIGHT) || below >= above) {
    return {
      side: 'below',
      top: button.bottom + GAP,
      left,
      maxHeight: Math.max(0, Math.min(MENU_MAX_HEIGHT, below)),
    }
  }
  return {
    side: 'above',
    bottom: viewportHeight - button.top + GAP,
    left,
    maxHeight: Math.max(0, Math.min(MENU_MAX_HEIGHT, above)),
  }
}

/** A press held this long opens the menu instead of transmitting. */
const LONG_PRESS_MS = 450

export const JamInputControl: Component = () => {
  const [open, setOpen] = createSignal(false)
  const [at, setAt] = createSignal<MenuPlacement | null>(null)
  /**
   * The menu was opened BY the send button, before a first transmission.
   *
   * Choosing then means "send this", because that is what the press was
   * for. Opening the same menu from the badge is just looking, and must
   * not put anybody on air.
   */
  const [armed, setArmed] = createSignal(false)
  // The menu is portalled out of the room (see the Portal below), so it
  // carries the room's theme tokens with it rather than taking the page's.
  const portalSkin = createPortalSkinBridge(open)
  let root: HTMLDivElement | undefined
  let caret: HTMLButtonElement | undefined
  let menu: HTMLDivElement | undefined
  let longPress: ReturnType<typeof setTimeout> | undefined
  // A long press must not also fire the click that follows it.
  let swallowClick = false

  /**
   * Measure, then ask menuPosition where it fits.
   *
   * Runs with the menu already rendered, so it is placed by its real
   * height: scrollHeight is the content's whatever max-height is doing to
   * it, and offsetHeight - clientHeight adds the border.
   */
  const place = (): void => {
    if (root === undefined) return
    const height =
      menu === undefined
        ? MENU_MAX_HEIGHT
        : menu.scrollHeight + menu.offsetHeight - menu.clientHeight
    setAt(
      menuPosition(
        root.getBoundingClientRect(),
        height,
        window.innerWidth,
        window.innerHeight,
      ),
    )
  }

  /** The choices a keyboard moves between, in order. */
  const choices = (): HTMLElement[] =>
    Array.from(
      menu?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [],
    )

  const show = (): void => {
    // Open first: Solid renders the menu synchronously, so place() measures
    // it before the browser has painted it anywhere.
    setOpen(true)
    place()
    // Portalled, the menu is no longer next to the caret in the tab order,
    // so focus goes to it -- to the current choice, as a menu button's does.
    choices()
      .find((el) => el.getAttribute('aria-checked') === 'true')
      ?.focus({ preventScroll: true })
  }

  /**
   * Close, handing focus back to the caret unless it went somewhere else.
   *
   * Every way out comes through here, so every way out disarms. Shut from
   * the badge, a right click or a tab away, a menu the first press on
   * send opened would otherwise keep that press waiting, to fire on a
   * later pick that was only looking.
   */
  const close = (restoreFocus = true): void => {
    setArmed(false)
    setOpen(false)
    if (restoreFocus) caret?.focus({ preventScroll: true })
  }

  /** This control or its menu, which the portal has put somewhere else. */
  const inside = (target: EventTarget | null): boolean =>
    target instanceof Node &&
    (root?.contains(target) === true || menu?.contains(target) === true)

  /** The placement as inline style: `top` or `bottom`, never both. */
  const menuStyle = (): JSX.CSSProperties => {
    const p = at()
    if (p === null) return {}
    const edge =
      p.side === 'below' ? { top: `${p.top}px` } : { bottom: `${p.bottom}px` }
    return { ...edge, left: `${p.left}px`, 'max-height': `${p.maxHeight}px` }
  }

  // Listening only while open. On the document rather than a backdrop: the
  // control lives in a crowded toolbar and a full-screen backdrop would
  // swallow the first click on every other button in it.
  createEffect(() => {
    if (!open()) return
    // Capture, so a handler that stops propagation cannot keep it open.
    const onPointerDown = (e: PointerEvent): void => {
      if (!inside(e.target)) close(false)
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const items = choices()
      const current = items.indexOf(document.activeElement as HTMLElement)
      if (current === -1) return
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      items[(current + step + items.length) % items.length]?.focus()
    }
    // Re-placed on a scroll, not closed as other popovers are: the lyrics
    // and the chat scroll themselves while a song plays, and a menu that
    // shut on each of those would shut under the hand choosing from it.
    // Following the button is what keeps it from being stranded.
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    })
  })
  onCleanup(() => clearTimeout(longPress))

  const profile = () => jamAudioProfile()
  const sending = () => !jamIsMuted()

  /**
   * The input is the system default, which on a laptop is the built-in
   * microphone.
   *
   * Worth calling out only on `instrument`, where it is the combination
   * that howls: a microphone, no echo cancellation, and speakers.
   */
  const defaultInput = () => jamInputDeviceId() === null

  const risky = createMemo(
    () => profile() === 'instrument' && sending() && defaultInput(),
  )

  const choose = (next: JamAudioProfile): void => {
    // Read before close(), which disarms.
    const wasArmed = armed()
    close()
    // A deliberate pick is the confirmation; it never asks again.
    setJamSourceConfirmed(true)
    if (next !== profile()) {
      setJamAudioProfile(next)
      void switchJamAudioSource()
    }
    // The press that opened this was "start sending", so honour it now
    // that the source is settled.
    if (wasArmed) void toggleJamMute()
  }

  return (
    <div
      class={styles.control}
      ref={(el) => {
        root = el
        portalSkin.anchorRef(el)
      }}
    >
      <button
        type="button"
        class={styles.send}
        classList={{ [styles.sendOn!]: sending(), [styles.risky!]: risky() }}
        aria-pressed={sending()}
        // Stable across profile changes, unlike the title -- which now
        // names the source and so moves when the source does.
        data-testid="jam-send"
        data-sending={sending() ? '' : undefined}
        // Named for what it does, not for the hardware it used to assume.
        title={
          sending()
            ? `Stop sending ${PROFILE_COPY[profile()].label.toLowerCase()}`
            : `Send ${PROFILE_COPY[profile()].label.toLowerCase()}`
        }
        aria-label={
          sending()
            ? `Stop sending. Currently sending ${PROFILE_COPY[profile()].label.toLowerCase()}.`
            : `Start sending ${PROFILE_COPY[profile()].label.toLowerCase()}.`
        }
        onClick={() => {
          if (swallowClick) {
            swallowClick = false
            return
          }
          // First time on this device, a press asks what it is about to
          // put on air rather than putting it there. Sending the wrong
          // source is not a small mistake: `instrument` has no echo
          // cancellation, so a wrong first press with speakers on is a
          // feedback loop in a room with other people in it.
          if (!jamSourceConfirmed() && !sending()) {
            setArmed(true)
            void refreshJamInputDevices()
            show()
            return
          }
          void toggleJamMute()
        }}
        onPointerDown={() => {
          // Clear it here, not only where it is consumed: a long press
          // whose finger lifts somewhere else never produces the click
          // that would have reset it, and the flag would then swallow the
          // next real press instead -- a button that ignores every other
          // tap.
          swallowClick = false
          // Touch has no right click. Holding is the same gesture.
          longPress = setTimeout(() => {
            swallowClick = true
            if (!open()) {
              void refreshJamInputDevices()
              show()
            }
          }, LONG_PRESS_MS)
        }}
        onPointerUp={() => clearTimeout(longPress)}
        onPointerLeave={() => clearTimeout(longPress)}
        onPointerCancel={() => clearTimeout(longPress)}
        // "Right or left click" -- the source menu is reachable from the
        // main button too, because that is the one people aim at.
        onContextMenu={(e) => {
          e.preventDefault()
          // The press the timer already answered: Android follows a long
          // press with a context menu of its own, after the timer when a
          // longer hold delay is set, and Windows sends a held right
          // button's on release. Either would toggle shut the menu that
          // same press has just opened.
          if (swallowClick) return
          if (open()) close()
          else show()
        }}
      >
        <Show when={profile() === 'instrument'} fallback={<Mic />}>
          <Guitar />
        </Show>
        <Show when={!sending()}>
          <span class={styles.offBar} aria-hidden="true" />
        </Show>
      </button>

      <button
        ref={caret}
        type="button"
        class={styles.caret}
        aria-haspopup="menu"
        aria-expanded={open()}
        aria-label="Choose what you are sending"
        title="Choose what you are sending"
        onClick={() => {
          if (open()) {
            close()
            return
          }
          void refreshJamInputDevices()
          show()
        }}
      >
        <ChevronDown />
      </button>

      <Show when={open()}>
        {/* Drawn from the page's root, not from the header. The jam page is
            one stacking context and the phone tab bar sits over all of it,
            so nothing inside the room could be raised above that bar -- it
            covered the bottom 54px of this menu on a landscape phone. Out
            here no ancestor can clip it, bury it, or make `fixed` mean
            "fixed to the header". docs/agent/MISTAKES.md has the pattern. */}
        <Portal>
          <div
            class={styles.menu}
            role="menu"
            aria-label="What you are sending"
            ref={menu}
            style={{ ...portalSkin.style(), ...menuStyle() }}
            // Tabbing out closes it, rather than leaving it open behind
            // wherever the keyboard went. A null target is the window
            // losing focus, which is not the user leaving the menu.
            onFocusOut={(e) => {
              if (e.relatedTarget !== null && !inside(e.relatedTarget)) {
                close(false)
              }
            }}
          >
            <p class={styles.menuTitle}>What you are sending</p>
            {/* First, not last: on a short screen the menu scrolls, and the
              line that stops the room howling must not be the one below
              the fold. */}
            <Show when={risky()}>
              <p class={styles.warn} role="status">
                You are sending the default input with no echo cancellation.
                That is usually a built-in microphone — on speakers it will feed
                back.
              </p>
            </Show>
            <For each={PROFILES}>
              {(item) => (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={profile() === item}
                  class={styles.option}
                  classList={{ [styles.optionOn!]: profile() === item }}
                  onClick={() => choose(item)}
                >
                  <span class={styles.optionHead}>
                    <Show when={item === 'instrument'} fallback={<Mic />}>
                      <Guitar />
                    </Show>
                    <span class={styles.optionLabel}>
                      {PROFILE_COPY[item].label}
                    </span>
                  </span>
                  <span class={styles.optionDetail}>{CONSEQUENCE[item]}</span>
                </button>
              )}
            </For>

            <label class={styles.deviceRow}>
              <span class={styles.deviceLabel}>Input</span>
              <select
                class={styles.select}
                value={jamInputDeviceId() ?? ''}
                onChange={(e) => {
                  const id =
                    e.currentTarget.value === '' ? null : e.currentTarget.value
                  setJamInputDeviceId(id)
                  setJamInputDeviceLabel(
                    id === null
                      ? null
                      : (jamInputDevices().find((d) => d.deviceId === id)
                          ?.label ?? null),
                  )
                  void switchJamAudioSource()
                }}
              >
                <option value="">Default input</option>
                <For each={jamInputDevices()}>
                  {(device) => (
                    <option value={device.deviceId}>
                      {device.isLoopback
                        ? `${device.label} (playback)`
                        : device.label}
                    </option>
                  )}
                </For>
              </select>
            </label>
          </div>
        </Portal>
      </Show>
    </div>
  )
}
