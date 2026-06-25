import type { Accessor } from 'solid-js'
import { Show } from 'solid-js'

/**
 * Subtle inline hint shown when the mic is picking up sound that is too quiet
 * for pitch detection — so the user knows the app hears them but can't read
 * their pitch (vs. silence). Rendered near the pitch display on practice tabs.
 */
export function MicQuietHint(props: { when: Accessor<boolean> }) {
  return (
    <Show when={props.when()}>
      <div
        class="mic-quiet-hint"
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          'align-items': 'center',
          gap: '0.5rem',
          padding: '0.4rem 0.85rem',
          margin: '0.5rem auto',
          width: 'fit-content',
          'max-width': '90%',
          'border-radius': '999px',
          background: 'var(--bg-secondary, rgba(0, 0, 0, 0.06))',
          color: 'var(--text-secondary, #555)',
          'font-size': '0.85rem',
          border: '1px solid var(--warning, rgba(220, 160, 0, 0.5))',
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
        <span>
          We can hear you, but it&apos;s too quiet to read your pitch — move
          closer or lower the mic sensitivity.
        </span>
      </div>
    </Show>
  )
}
