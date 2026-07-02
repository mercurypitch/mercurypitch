import type { Accessor, JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { MicInsight } from '@/features/mic-feedback/useMicInsights'
import { dismissMicOffHint } from '@/features/mic-feedback/useMicInsights'

const BASE_STYLE: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '0.45rem',
  padding: '0.2rem 0.8rem',
  'max-width': '90%',
  'border-radius': '999px',
  background: 'var(--bg-elevated, rgba(20, 20, 24, 0.92))',
  color: 'var(--text-primary, #eee)',
  'font-size': '0.78rem',
  'pointer-events': 'none',
  border: '1px solid var(--warning, rgba(220, 160, 0, 0.7))',
  'box-shadow': '0 1px 8px rgba(0, 0, 0, 0.35)',
}

/**
 * Subtle mic-feedback pill, shown when `message()` is non-empty. Tab-agnostic:
 * pass the message from a {@link useMicInsights} hook and position it within the
 * host with `style` (e.g. absolute-centred over a status bar, or inline). Used
 * across Singing, Karaoke, Piano, Guitar, and Jam.
 *
 * Pass `insight` as well to make the persistent mic-off hint dismissible: it
 * renders a "Don't show again" control that silences that hint everywhere.
 */
export function MicInsightHint(props: {
  message: Accessor<string>
  insight?: Accessor<MicInsight>
  style?: JSX.CSSProperties
  class?: string
}) {
  const dismissible = () => props.insight?.() === 'mic-off'
  return (
    <Show when={props.message() !== ''}>
      <div
        class={`mic-insight-hint ${props.class ?? ''}`}
        role="status"
        aria-live="polite"
        style={{
          ...BASE_STYLE,
          ...(props.style ?? {}),
          // The dismiss control needs clicks; plain hints stay click-through.
          'pointer-events': dismissible() ? 'auto' : 'none',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
        </svg>
        <span>{props.message()}</span>
        <Show when={dismissible()}>
          <button
            type="button"
            onClick={dismissMicOffHint}
            style={{
              background: 'none',
              border: 'none',
              padding: '0',
              color: 'var(--text-secondary, #aaa)',
              'font-size': '0.72rem',
              'text-decoration': 'underline',
              cursor: 'pointer',
              'white-space': 'nowrap',
            }}
          >
            Don't show again
          </button>
        </Show>
      </div>
    </Show>
  )
}
