import { createSignal, onCleanup, onMount, Show, untrack } from 'solid-js'
import { TURNSTILE_SITE_KEY } from '@/lib/defaults'

// Cloudflare Turnstile (CAPTCHA) widget for the public auth forms. Renders ONLY when
// VITE_TURNSTILE_SITE_KEY is set; otherwise it's a no-op and the forms work unchanged — matching
// the worker gate, which is disabled until TURNSTILE_SECRET is set. Set BOTH to enable the captcha.
const SITE_KEY = TURNSTILE_SITE_KEY

/**
 * Where the widget comes from.
 *
 * Exported so the Content-Security-Policy test can assert that this origin
 * is actually allowed to load and to frame. It was not, and the widget
 * therefore never appeared — which left the submit button disabled forever,
 * because it waits for a token the blocked widget could never produce.
 */
export const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SCRIPT_SRC = TURNSTILE_SCRIPT_SRC

export const turnstileEnabled = !!SITE_KEY

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
  reset: (id?: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/**
 * Whether the widget could not be loaded at all.
 *
 * Module-level because it is a fact about the page, not about one form: the
 * script either arrived or it did not. Forms read it to decide whether they
 * are still waiting for a token or waiting for something that will never
 * come — a CSP that blocked the script, an ad blocker, a dead network.
 *
 * Deliberately NOT set by Turnstile's own `error-callback`: that fires on a
 * challenge that failed, which the visitor can retry. This is only for a
 * widget that never existed.
 */
const [turnstileUnavailable, setTurnstileUnavailable] = createSignal(false)
export { turnstileUnavailable }

let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => {
      resolve()
    }
    s.onerror = () => {
      reject(new Error('Failed to load Turnstile'))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

/** Reset every Turnstile widget on the page (tokens are single-use — call after a failed submit). */
export function resetTurnstile(): void {
  try {
    window.turnstile?.reset()
  } catch {
    /* ignore */
  }
}

export interface TurnstileProps {
  onToken: (token: string) => void
  /**
   * How much of the widget to draw. Left unset, Cloudflare's default: always
   * drawn, so every visitor sees "Verifying" and then "Success". The sign-in
   * dialog and the native sign-in sheet pass 'interaction-only': the check
   * still runs on open and the worker still demands its token, but the widget
   * appears only when Cloudflare needs the person to click.
   */
  appearance?: 'always' | 'execute' | 'interaction-only'
  /**
   * The widget's size when drawn. 'flexible' spans the form (300px minimum,
   * 65px tall), so a checkbox that does appear lines up with the fields
   * around it. Left unset, Cloudflare's 300x65 'normal'.
   */
  size?: 'normal' | 'flexible' | 'compact'
}

/** Why a widget that stays hidden until needed has nothing to show. */
type HiddenFailure = 'failed' | 'unsupported' | null

const NOTE_STYLE =
  'font-size: 0.8rem; color: var(--text-muted); text-align: center;'

export default function Turnstile(props: TurnstileProps) {
  let el: HTMLDivElement | undefined
  let widgetId: string | undefined
  // Read once: the widget is rendered once, with whatever was asked then.
  const hiddenUntilNeeded =
    untrack(() => props.appearance) === 'interaction-only'
  // Between Cloudflare's before- and after-interactive callbacks the
  // checkbox is on screen, and only then does its row need spacing.
  const [interactive, setInteractive] = createSignal(false)
  // A hidden widget draws nothing when the check fails (measured with the
  // always-blocks test key: no pixels, only the error callback), so the form
  // has to say it, or the button just stays disabled. "Close this": the web
  // dialog and the app's sign-in sheet both drop the widget when they close,
  // and reopening starts a fresh check. An app has no page to reload.
  const [hiddenFailure, setHiddenFailure] = createSignal<HiddenFailure>(null)
  const drawn = (): boolean => !hiddenUntilNeeded || interactive()
  // A flexible widget fills its host, so the host is a block it can fill;
  // the fixed sizes sit centred in a flex row, as they always have.
  const layout =
    untrack(() => props.size) === 'flexible'
      ? 'display: block;'
      : 'display: flex; justify-content: center;'

  onMount(() => {
    // Captured once, so the check below narrows for the whole closure. The
    // ref cannot become null later, and re-checking it after the await only
    // added a branch no test could ever take.
    const target = el
    if (SITE_KEY === '' || target == null) return
    const appearance = untrack(() => props.appearance)
    const size = untrack(() => props.size)
    loadScript()
      .then(() => {
        if (window.turnstile == null) {
          setTurnstileUnavailable(true)
          return
        }
        widgetId = window.turnstile.render(target, {
          sitekey: SITE_KEY,
          // Only when asked: an unset key and Cloudflare's default are the
          // same widget, and those forms keep sending exactly what they did.
          ...(appearance === undefined ? {} : { appearance }),
          ...(size === undefined ? {} : { size }),
          callback: (token: string) => {
            setHiddenFailure(null)
            untrack(() => props.onToken(token))
          },
          'error-callback': () => {
            if (hiddenUntilNeeded) setHiddenFailure('failed')
            untrack(() => props.onToken(''))
          },
          'expired-callback': () => {
            untrack(() => props.onToken(''))
          },
          'before-interactive-callback': () => {
            setHiddenFailure(null)
            setInteractive(true)
          },
          'after-interactive-callback': () => {
            setInteractive(false)
          },
          'unsupported-callback': () => {
            if (hiddenUntilNeeded) setHiddenFailure('unsupported')
            untrack(() => props.onToken(''))
          },
        })
      })
      .catch(() => {
        setTurnstileUnavailable(true)
        untrack(() => props.onToken(''))
      })
  })

  onCleanup(() => {
    if (widgetId != null && widgetId !== '' && window.turnstile != null) {
      window.turnstile.remove(widgetId)
    }
  })

  return (
    <Show when={SITE_KEY !== ''}>
      {/* Hidden until needed, the host takes no room at all: no margin
          around a widget that is not there. */}
      <div
        ref={el}
        data-testid="turnstile-host"
        data-turnstile={drawn() ? 'drawn' : 'hidden'}
        style={drawn() ? `margin: 4px 0 12px; ${layout}` : layout}
      />
      <Show when={hiddenFailure() !== null && !interactive()}>
        <p role="status" style={`margin: 0 0 10px; ${NOTE_STYLE}`}>
          {hiddenFailure() === 'unsupported'
            ? "This browser can't run the security check. Try another browser."
            : "The security check didn't go through. Close this and try again."}
        </p>
      </Show>
      {/* Says what happened, because the alternative is a form that looks
          fine and silently refuses to submit. The button opens back up when
          this shows — the server still checks, so the visitor gets a real
          error instead of a dead button. */}
      <Show when={turnstileUnavailable()}>
        <p
          role="status"
          style={`margin: ${drawn() ? '-4px' : '0'} 0 12px; ${NOTE_STYLE}`}
        >
          The verification widget could not load. An ad blocker or a strict
          network can cause this — signing in may still fail until it is
          allowed.
        </p>
      </Show>
    </Show>
  )
}
