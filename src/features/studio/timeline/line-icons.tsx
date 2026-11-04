// Studio line icons — the marks for a lane's volume and pan lines: the line itself, pan and clearing a line.
import type { Component } from 'solid-js'

// A line through two points: a lane's volume and pan lines.
export const LaneLine: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
  >
    <path d="M2 17h4l5-9 5 6 6-6" />
    <circle cx="11" cy="8" r="2" fill="currentColor" />
    <circle cx="16" cy="14" r="2" fill="currentColor" />
  </svg>
)

// Arrows out to either side of a centre mark: pan.
export const PanSides: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
  >
    <path d="M3 12h18" />
    <path d="m7 8-4 4 4 4" />
    <path d="m17 8 4 4-4 4" />
    <path d="M12 6v12" />
  </svg>
)

// An eraser over its stroke: clear a line.
export const ClearLine: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
  >
    <path d="m7 21-4-4a2 2 0 0 1 0-2.8L13.2 4a2 2 0 0 1 2.8 0l4 4a2 2 0 0 1 0 2.8L11 20" />
    <path d="M22 21H7" />
    <path d="m5 11 9 9" />
  </svg>
)
