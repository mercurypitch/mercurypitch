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

export default function Turnstile(props: { onToken: (token: string) => void }) {
  let el: HTMLDivElement | undefined
  let widgetId: string | undefined

  onMount(() => {
    // Captured once, so the check below narrows for the whole closure. The
    // ref cannot become null later, and re-checking it after the await only
    // added a branch no test could ever take.
    const target = el
    if (SITE_KEY === '' || target == null) return
    loadScript()
      .then(() => {
        if (window.turnstile == null) {
          setTurnstileUnavailable(true)
          return
        }
        widgetId = window.turnstile.render(target, {
          sitekey: SITE_KEY,
          callback: (token: string) => {
            untrack(() => props.onToken(token))
          },
          'error-callback': () => {
            untrack(() => props.onToken(''))
          },
          'expired-callback': () => {
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
      <div
        ref={el}
        style="margin: 4px 0 12px; display: flex; justify-content: center;"
      />
      {/* Says what happened, because the alternative is a form that looks
          fine and silently refuses to submit. The button opens back up when
          this shows — the server still checks, so the visitor gets a real
          error instead of a dead button. */}
      <Show when={turnstileUnavailable()}>
        <p
          role="status"
          style="margin: -4px 0 12px; font-size: 0.8rem; color: var(--text-muted); text-align: center;"
        >
          The verification widget could not load. An ad blocker or a strict
          network can cause this — signing in may still fail until it is
          allowed.
        </p>
      </Show>
    </Show>
  )
}
