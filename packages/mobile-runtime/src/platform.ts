// ============================================================
// Platform sibling — thin device wrappers that no-op on the web
// ============================================================
//
// One import surface for the handful of things a phone can do and a browser
// tab cannot: a tap you can feel, a screen that stays lit, a status bar that
// reads against the page behind it, the system share sheet, the app's own row
// in Settings, the Android back button, and the app going away and coming
// back.
//
// THE RULE THAT SHAPES EVERY FUNCTION BELOW. A plugin module is reached only
// from inside a `Capacitor.isNativePlatform()` branch, through `await
// import()`. Nothing here is imported at module scope, so:
//
//   - A browser build never evaluates a plugin. The dynamic imports become
//     their own chunks and the guard means the chunk is never fetched, so the
//     web bundle carries no plugin registration code.
//   - An app that installs only some of these still builds and still runs.
//     This is hazard 3 from the native plan: `./capacitor` composes every
//     capability at once and statically imports all four of its plugins, so
//     an app that installs three of them ships a module it cannot honour.
//     These wrappers make the opposite promise — call any of them from any
//     app, and one whose native half is absent reports that rather than
//     throwing through the bridge.
//
// Every call is wrapped so a missing native implementation degrades instead
// of rejecting: Capacitor answers an unregistered plugin with an
// `Unimplemented` exception, and a haptic tap is never worth an unhandled
// rejection. Where the caller genuinely needs to know — the share sheet and
// the Settings row, which must not silently do nothing (plan task G3) — the
// wrapper returns a boolean instead of swallowing the answer.
//
// What does NOT belong here: policy. `keepAwake(true)` is a single switch on
// purpose; the reference counting and the `visibilitychange` re-acquire that
// plan task G1 calls for live in the app's platform seam, where the app knows
// how many rooms are open. This file only knows how to reach the device.

import { Capacitor } from '@capacitor/core'

/** Removes whatever the registering call installed. Safe to call twice. */
export type Unsubscribe = () => void

/**
 * Which way the status bar's own text should read. The names are the
 * plugin's, deliberately: `'light'` is the LIGHT bar (dark text, for a light
 * page) and `'dark'` is the DARK bar (light text, for a dark page). Inventing
 * an inversion here would mean two vocabularies for one switch.
 */
export type StatusBarStyle = 'light' | 'dark'

/** Foreground or not. Everything else the OS distinguishes is not ours. */
export type AppLifecycleState = 'active' | 'background'

export interface SharePayload {
  title?: string
  text?: string
  url?: string
  /** `file://` URLs. iOS and Android only; the web share sheet ignores them. */
  files?: readonly string[]
}

export interface BackButtonEvent {
  /** What the WebView thinks: true when its own history can go back. */
  readonly canGoBack: boolean
}

export type BackButtonHandler = (event: BackButtonEvent) => void

export type AppLifecycleHandler = (state: AppLifecycleState) => void

function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * Runs a native call and answers whether it actually happened.
 *
 * A plugin whose native half was never installed rejects with Capacitor's
 * `Unimplemented`, and so does one called on a platform that does not
 * implement it (`minimizeApp` on iOS). Neither is an error a product can act
 * on, and neither is worth an unhandled rejection, so both come back as
 * `false`.
 */
async function attempt(run: () => Promise<unknown>): Promise<boolean> {
  if (!isNative()) return false
  try {
    await run()
    return true
  } catch {
    return false
  }
}

// ------------------------------------------------------------
// Haptics
// ------------------------------------------------------------
//
// Three named moments rather than the plugin's full palette. A product that
// needs to pick an impact style is describing physics; these describe events,
// which is what a UI actually knows.

/** The confirmation under a press. The smallest one the device has. */
export async function hapticTap(): Promise<void> {
  await attempt(async () => {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  })
}

/** Something completed: a take saved, a streak kept. */
export async function hapticSuccess(): Promise<void> {
  await attempt(async () => {
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    await Haptics.notification({ type: NotificationType.Success })
  })
}

/** Something needs attention before it can continue — not a failure. */
export async function hapticWarning(): Promise<void> {
  await attempt(async () => {
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    await Haptics.notification({ type: NotificationType.Warning })
  })
}

// ------------------------------------------------------------
// Screen, status bar, keyboard
// ------------------------------------------------------------

/**
 * Hold the screen awake, or let it sleep again.
 *
 * One switch, no counting: see the header. A singing room that dims the
 * screen mid-phrase is the bug this exists for, and the browser's answer is
 * nothing at all — a Wake Lock needs its own permission story and belongs in
 * the web app's own seam, not in a native wrapper's fallback.
 */
export async function keepAwake(on: boolean): Promise<void> {
  await attempt(async () => {
    const { KeepAwake } = await import('@capacitor-community/keep-awake')
    await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep())
  })
}

/**
 * Point the status bar's text at the page behind it.
 *
 * Only the style. The splash and the bar's initial appearance are native
 * resources (plan task G4) precisely so the first frame does not depend on
 * JavaScript having run; this is the runtime switch for a screen that changes
 * its own background afterwards.
 */
export async function setStatusBar(style: StatusBarStyle): Promise<void> {
  await attempt(async () => {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({
      style: style === 'dark' ? Style.Dark : Style.Light,
    })
  })
}

/**
 * Dismiss the software keyboard, on a phone only.
 *
 * The name says `NativeOnly` because a browser has no such control and a
 * caller that expected one would be waiting for something that cannot happen:
 * blurring the focused element is the web's answer, and that is the caller's
 * decision, not this wrapper's.
 */
export async function hideKeyboardOnNativeOnly(): Promise<void> {
  await attempt(async () => {
    const { Keyboard } = await import('@capacitor/keyboard')
    await Keyboard.hide()
  })
}

// ------------------------------------------------------------
// Share and Settings
// ------------------------------------------------------------

/**
 * Whether a rejection is a person dismissing the sheet rather than a failure
 * to present one.
 *
 * Both native halves answer a dismissal by REJECTING, and both with the same
 * words: `SharePlugin.swift` calls `call.reject('Share canceled')` when the
 * activity controller reports the share was not completed, and
 * `SharePlugin.java` does the same on `Activity.RESULT_CANCELED`. A
 * rejection is therefore not evidence of anything on its own — the message
 * is the only thing separating the two outcomes, so the message is what is
 * read. Everything else the plugin can reject with (`Unimplemented`, 'Must
 * provide at least url, text or files', 'Can't share while sharing is in
 * progress') is a genuine failure and stays one.
 */
function readsAsCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /cancel/i.test(message)
}

/**
 * Hand a payload to the system share sheet.
 *
 * Returns false when no sheet was presented — on the web, or when the plugin
 * is not installed, or when the platform refused. A share that silently does
 * nothing is the failure plan task G3 names, so the answer is returned rather
 * than swallowed and the caller keeps its own fallback.
 *
 * A cancelled sheet counts as presented and answers TRUE. That is why this
 * one call cannot go through `attempt()`: a dismissal reaches us as a
 * rejection like any other, and mapping every rejection to false would send
 * the caller down the fallback the person just declined.
 */
export async function sharePayload(payload: SharePayload): Promise<boolean> {
  if (!isNative()) return false

  try {
    const { Share } = await import('@capacitor/share')
    await Share.share({
      ...(payload.title === undefined ? {} : { title: payload.title }),
      ...(payload.text === undefined ? {} : { text: payload.text }),
      ...(payload.url === undefined ? {} : { url: payload.url }),
      ...(payload.files === undefined ? {} : { files: [...payload.files] }),
    })
    return true
  } catch (error) {
    return readsAsCancellation(error)
  }
}

/**
 * Open this app's own page in the system Settings.
 *
 * The one screen a mic-denied state can send someone to: once a permission
 * has been refused, neither platform will prompt again, and the only way back
 * is the app's own row in Settings. Returns false when that could not be
 * reached, so the screen can fall back to telling the person the path.
 */
export async function openAppSettings(): Promise<boolean> {
  return attempt(async () => {
    const { AndroidSettings, IOSSettings, NativeSettings } =
      await import('capacitor-native-settings')
    await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      // The only settings screen Apple supports opening. Any other is a
      // review risk, and this is the only one the mic-denied state needs.
      optionIOS: IOSSettings.App,
    })
  })
}

// ------------------------------------------------------------
// Listeners
// ------------------------------------------------------------
//
// Both registrations are asynchronous (the plugin resolves a handle) while
// both callers want an unsubscribe they can hold immediately. So each returns
// a synchronous function that either removes the handle or, if the handle has
// not arrived yet, marks the registration stale so it is removed on arrival.
// Without that second half, a listener installed by a screen that unmounts
// during its own registration outlives the screen.

function lazyListener(
  register: (dispose: (handle: { remove(): Promise<void> }) => void) => void,
): Unsubscribe {
  let cancelled = false
  let handle: { remove(): Promise<void> } | null = null

  register((registered) => {
    if (cancelled) {
      void registered.remove().catch(() => undefined)
      return
    }
    handle = registered
  })

  return () => {
    cancelled = true
    const current = handle
    handle = null
    if (current !== null) void current.remove().catch(() => undefined)
  }
}

/**
 * Android's hardware back button.
 *
 * Registering one of these turns off Capacitor's own default, which is to
 * exit the app — so a handler that does nothing strands the user. iOS has no
 * such button and the browser has the gesture instead, so on both this is a
 * no-op and the returned unsubscribe is inert.
 */
export function onBackButton(handler: BackButtonHandler): Unsubscribe {
  if (!isNative()) return () => undefined

  return lazyListener((dispose) => {
    void (async () => {
      try {
        const { App } = await import('@capacitor/app')
        dispose(
          await App.addListener('backButton', (event) => {
            handler({ canGoBack: event.canGoBack })
          }),
        )
      } catch {
        // No @capacitor/app in this build. The platform's own back handling
        // stays in charge, which is the safe half of this trade.
      }
    })()
  })
}

/**
 * The app leaving the foreground and coming back.
 *
 * This is NOT `visibilitychange`. A WebView's visibility event is the browser
 * answering a question about the document; `appStateChange` is the OS
 * answering one about the app, and the two disagree exactly where it matters
 * — a call arriving, the app switcher, a screen lock. The browser has only
 * the first, so on the web this is a no-op and whatever needs the document's
 * visibility listens for it directly.
 */
export function onAppState(handler: AppLifecycleHandler): Unsubscribe {
  if (!isNative()) return () => undefined

  return lazyListener((dispose) => {
    void (async () => {
      try {
        const { App } = await import('@capacitor/app')
        dispose(
          await App.addListener('appStateChange', (state) => {
            handler(state.isActive ? 'active' : 'background')
          }),
        )
      } catch {
        // No @capacitor/app in this build; nothing will be reported.
      }
    })()
  })
}

// ------------------------------------------------------------
// Leaving the app
// ------------------------------------------------------------

/**
 * Put the app in the background, as the back button does from a home screen.
 *
 * One call, with no second attempt behind it, because there is no platform a
 * second attempt could help. Android's `minimizeApp` is `moveTaskToBack(true)`
 * and is always available — and Android is the only platform that fires the
 * back button this exists to answer. iOS has no such call at all: an app may
 * not send itself to the background, Apple rejects builds that try, and the
 * plugin's iOS half answers `minimizeApp` with `unimplemented()` — as it does
 * `exitApp`, so falling through to that would only trade one refusal for
 * another. A refusal is reported rather than thrown: the caller is usually a
 * back handler, which then simply leaves the screen as it is.
 */
export async function minimizeApp(): Promise<boolean> {
  return attempt(async () => {
    const { App } = await import('@capacitor/app')
    await App.minimizeApp()
  })
}
