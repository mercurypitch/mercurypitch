import { onCleanup, onMount, Show } from 'solid-js'
import { TURNSTILE_SITE_KEY } from '@/lib/defaults'

// Cloudflare Turnstile (CAPTCHA) widget for the public auth forms. Renders ONLY when
// VITE_TURNSTILE_SITE_KEY is set; otherwise it's a no-op and the forms work unchanged — matching
// the worker gate, which is disabled until TURNSTILE_SECRET is set. Set BOTH to enable the captcha.
const SITE_KEY = TURNSTILE_SITE_KEY
const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

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

/**
 * Wait for the widget to auto-issue a fresh token after resetTurnstile() —
 * used by the register → auto-sign-in flow, where the register call consumed
 * the previous single-use token. Resolves '' immediately when the captcha is
 * disabled; rejects when no token arrives within the timeout.
 */
export function waitForTurnstileToken(
  getToken: () => string,
  timeoutMs = 8000,
): Promise<string> {
  if (!turnstileEnabled) return Promise.resolve('')
  const existing = getToken()
  if (existing !== '') return Promise.resolve(existing)
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const poll = setInterval(() => {
      const t = getToken()
      if (t !== '') {
        clearInterval(poll)
        resolve(t)
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(poll)
        reject(new Error('Verification timed out'))
      }
    }, 150)
  })
}

export default function Turnstile(props: { onToken: (token: string) => void }) {
  let el: HTMLDivElement | undefined
  let widgetId: string | undefined

  onMount(() => {
    if (SITE_KEY == null || SITE_KEY === '' || el == null) return
    loadScript()
      .then(() => {
        if (window.turnstile == null || el == null) return
        widgetId = window.turnstile.render(el, {
          sitekey: SITE_KEY,
          callback: (token: string) => {
            props.onToken(token)
          },
          'error-callback': () => {
            props.onToken('')
          },
          'expired-callback': () => {
            props.onToken('')
          },
        })
      })
      .catch(() => {
        props.onToken('')
      })
  })

  onCleanup(() => {
    if (widgetId != null && widgetId !== '' && window.turnstile != null) {
      window.turnstile.remove(widgetId)
    }
  })

  return (
    <Show when={SITE_KEY != null && SITE_KEY !== ''}>
      <div
        ref={el}
        style="margin: 4px 0 12px; display: flex; justify-content: center;"
      />
    </Show>
  )
}
