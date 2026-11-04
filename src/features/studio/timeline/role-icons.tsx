// ============================================================
// Studio role icons — one line drawing per track role, for lane headers with role pictures off
// ============================================================
//
// Drawn for this set on a 24-unit grid with the app's stroke (1.75, round
// joins), so the ten read as one family at 20 to 36 px. String
// instruments are drawn upright and turned 45 degrees, as the role
// pictures lie (docs/studio-role-art.md), neck to the upper right. The
// microphones stand upright: a ball on a slant, crossed by its seam, read
// as a magnifier or as "microphone off".
import type { JSX } from 'solid-js'
import type { TrackRole } from '@/lib/studio-fx/role-chains'

function Icon(props: { size?: number; children: JSX.Element }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={props.size ?? 20}
      height={props.size ?? 20}
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  )
}

/** Turned like the pictures: upright in the drawing, neck to the upper right on screen. */
const TILT = 'rotate(45 12 12)'

const ROLE_DRAWINGS: Readonly<Record<TrackRole, () => JSX.Element>> = {
  voice: () => (
    <>
      <circle cx="12" cy="7.25" r="5" />
      <path d="M7.2 8.6c3 1.7 6.6 1.7 9.6 0" />
      <path d="M9.6 11.6 10.8 21a1.2 1.2 0 0 0 2.4 0l1.2-9.4" />
    </>
  ),
  'backing-vocals': () => (
    <>
      <circle cx="7.75" cy="6.75" r="3.5" />
      <circle cx="16.25" cy="6.75" r="3.5" />
      <path d="M6.45 10 6.75 20a1 1 0 0 0 2 0l.3-10" />
      <path d="M14.95 10 15.25 20a1 1 0 0 0 2 0l.3-10" />
    </>
  ),
  'acoustic-guitar': () => (
    <g transform={TILT}>
      <path d="M9.1 15.1A3.3 3.3 0 1 1 14.9 15.1 4.2 4.2 0 1 1 9.1 15.1Z" />
      <circle cx="12" cy="14.4" r="1.15" />
      <path d="M11.1 10.3V3.4M12.9 10.3V3.4M10.6 3.4h2.8L13.2 1h-2.4z" />
      <path d="M10.7 18.6h2.6" />
    </g>
  ),
  'electric-guitar': () => (
    <g transform={TILT}>
      <path d="M9.4 12.3c-1.3-.7-2.6.4-2.4 1.9.3 1.8-.9 2.6-.9 4.3 0 2.3 2.1 3.4 5.9 3.4s5.9-1.1 5.9-3.4c0-1.7-1.2-2.5-.9-4.3.2-1.5-1.1-2.6-2.4-1.9-.9.5-1.4 1.2-2.6 1.2s-1.7-.7-2.6-1.2Z" />
      <path d="M11.2 13.3V3.4M12.8 13.3V3.4M11 3.4 10.7 1h2.9l-.8 2.4" />
      <path d="M10.3 16.2h3.4M10.3 18.4h3.4" />
    </g>
  ),
  bass: () => (
    <g transform={TILT}>
      <path d="M9.7 13.7c-1.2-.6-2.3.3-2.1 1.7.2 1.5-.7 2.2-.7 3.6 0 2 1.9 2.9 5.1 2.9s5.1-.9 5.1-2.9c0-1.4-.9-2.1-.7-3.6.2-1.4-.9-2.3-2.1-1.7-.8.4-1.2 1-2.3 1s-1.5-.6-2.3-1Z" />
      <path d="M11.3 14.6V3.2M12.7 14.6V3.2M11.1 3.2 10.8.4h2.4l-.4 2.8" />
      <path d="M9.4 1.3h1.5M9.4 2.5h1.5M13.1 1.3h1.5M13.1 2.5h1.5" />
      <path d="M10.6 18.5h2.8" />
    </g>
  ),
  piano: () => (
    <>
      <path d="M4 20V8.5C4 5.5 6.2 3.5 9 3.5c2.4 0 3.6 1.4 4.3 3 .6 1.4 1.4 2 2.9 2.4 2.2.5 3.8 2.3 3.8 4.7V20Z" />
      <path d="M4 16.25h16M8 16.25V20M12 16.25V20M16 16.25V20" />
    </>
  ),
  keys: () => (
    <>
      <rect x="2.5" y="6" width="19" height="12.5" rx="2" />
      <path d="M2.5 12.5h19M6.3 12.5v6M10.1 12.5v6M13.9 12.5v6M17.7 12.5v6" />
      <circle cx="6.5" cy="9.25" r="1.2" />
      <circle cx="10.25" cy="9.25" r="1.2" />
      <path d="M14 9.25h4.5" />
    </>
  ),
  drums: () => (
    <>
      <ellipse cx="12" cy="11.5" rx="8" ry="3" />
      <path d="M4 11.5V17c0 1.7 3.6 3 8 3s8-1.3 8-3v-5.5" />
      <path d="M8 14.2v5.3M16 14.2v5.3M12 14.5v5.5" />
      <path d="M4.5 3.5 10.5 9M19.5 3.5 13.5 9" />
    </>
  ),
  backing: () => (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
      <path d="M6.3 9.4a6.3 6.3 0 0 1 3.1-3.1" />
    </>
  ),
  other: () => (
    <>
      <path d="M4.5 15v-3a7.5 7.5 0 0 1 15 0v3" />
      <rect x="3" y="14" width="4.5" height="7" rx="1.6" />
      <rect x="16.5" y="14" width="4.5" height="7" rx="1.6" />
    </>
  ),
}

/** The line icon for `role`, decorative: the lane's name and role are said in words beside it. */
export function StudioRoleIcon(props: { role: TrackRole; size?: number }) {
  return <Icon size={props.size}>{ROLE_DRAWINGS[props.role]()}</Icon>
}
