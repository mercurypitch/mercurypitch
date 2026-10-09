// ============================================================
// GiftIcon — a wrapped present: lid, box, ribbon and bow
// ============================================================
//
// The header's Promo pill and the Map's Karaoke card wear it. Decoration
// wherever it appears, so hidden from assistive tech.
//
// Its own module, not src/components/icons.tsx: that file is one chunk
// (shared-icons, vite.config.ts) on every standalone room's first paint,
// and Drum Night's sits at its budget (scripts/assert-drum-night-bundle.mjs).
// Only web app surfaces use this one, so it travels with them.

import type { Component } from 'solid-js'

export const GiftIcon: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
    data-icon="gift"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
    <path d="M12 8v13" />
    <path d="M12 8C10.5 5 7 4 7 6.2 7 7.6 9.5 8 12 8z" />
    <path d="M12 8c1.5-3 5-4 5-1.8 0 1.4-2.5 1.8-5 1.8z" />
  </svg>
)
