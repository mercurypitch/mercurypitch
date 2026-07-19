// ============================================================
// WeekIcon — the per-theme glyph shown inside a path orb
// ============================================================
// Crisp line icons (one per week theme) rendered on the active + completed
// orbs, and revealed on hover for the rest. currentColor so the orb sets
// the tint; kept as SVG (not baked into the orb art) to stay razor-sharp.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import type { WeekTheme } from '@/features/path/path-content'

export interface WeekIconProps {
  theme: WeekTheme
  size?: number
}

export const WeekIcon: Component<WeekIconProps> = (props) => {
  const size = () => props.size ?? 34
  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <Show when={props.theme === 'foundations'}>
        {/* soundwave — wake the voice */}
        <path
          d="M4 10.5v3M8.5 7v10M12 4v16M15.5 8v8M20 11v2"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </Show>
      <Show when={props.theme === 'breath'}>
        {/* lungs — breath support */}
        <path
          d="M12 3v6"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />
        <path
          d="M12 9c-.6 0-1 .4-1 1M12 9c.6 0 1 .4 1 1"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />
        <path
          d="M11 10c-2.6.9-4.4 3.6-4.4 6.7 0 1.9.7 3.3 2.1 3.3 1.5 0 2.3-1.3 2.3-3.3V10Z"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
        <path
          d="M13 10c2.6.9 4.4 3.6 4.4 6.7 0 1.9-.7 3.3-2.1 3.3-1.5 0-2.3-1.3-2.3-3.3V10Z"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
      </Show>
      <Show when={props.theme === 'range'}>
        {/* up/down arrows — reach */}
        <path
          d="M12 4.5v15M12 4.5l-3.2 3.2M12 4.5l3.2 3.2M12 19.5l-3.2-3.2M12 19.5l3.2-3.2"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </Show>
      <Show when={props.theme === 'ear'}>
        {/* tuning fork — tuning & ear */}
        <path
          d="M9 3v7.5a3 3 0 0 0 6 0V3"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <path
          d="M12 13.5v6M9.7 21h4.6M12 10.5v3"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </Show>
      <Show when={props.theme === 'agility'}>
        {/* lightning — runs & agility */}
        <path d="M13.5 3 5.5 13H11l-1.5 8 8-11H12z" fill="currentColor" />
      </Show>
      <Show when={props.theme === 'tone'}>
        {/* vibrato wave — tone & vibrato */}
        <path
          d="M3.5 12.5c1.6-4.6 3.2-4.6 4.8 0s3.2 4.6 4.8 0 3.2-4.6 4.8 0"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
        />
      </Show>
      <Show when={props.theme === 'recovery'}>
        {/* leaf — rest & recovery */}
        <path
          d="M6 18.5C6 10.5 12 6 19.5 5c.4 8.2-4.8 14.3-13.5 13.5Z"
          fill="currentColor"
          opacity="0.92"
        />
        <path
          d="M9 15.5c2.2-3.4 5-5.6 8.3-6.6"
          stroke="#12203a"
          stroke-width="1.4"
          stroke-linecap="round"
          opacity="0.5"
        />
      </Show>
    </svg>
  )
}
