import type { JSX } from 'solid-js/jsx-runtime'

interface IconProps {
  size?: number
  class?: string
}

function iconProps(size = 24): { width: number; height: number; viewBox: string; fill: string } {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' }
}

const strokeProps = { stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const }

export function IconTarget(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

export function IconWave(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <path d="M2 12c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0 3 4 4.5 0 3-4 4.5 0" />
    </svg>
  )
}

export function IconSlide(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <path d="M7 17l10-10" />
      <polyline points="17 7 17 14 10 14" />
    </svg>
  )
}

export function IconGame(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <line x1="15" y1="12" x2="18" y2="12" />
    </svg>
  )
}

export function IconMirror(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <path d="M4 4h16v16H4z" />
      <line x1="4" y1="12" x2="12" y2="12" />
      <path d="M12 4v16" />
      <path d="M12 12c1-2 2-3 4-3s3 1.5 3 3.5-1.5 3.5-3 3.5-3-1.5-4-4" opacity="0.4" />
      <path d="M12 12c-2 1.5-3.5 3-3.5 5s1.5 3 3.5 3" opacity="0.6" />
    </svg>
  )
}

export function IconLock(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  )
}

export function IconFire(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <path d="M12 2c-3 3-6 6-6 10a6 6 0 0 0 12 0c0-4-3-7-6-10z" />
      <path d="M12 22c-2 0-3.5-1-4-2" opacity="0.5" />
    </svg>
  )
}

export function IconTrophy(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
      <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
      <path d="M6 21h12" />
      <path d="M12 17v4" />
      <path d="M7 3h10v6a5 5 0 0 1-10 0V3z" />
    </svg>
  )
}

export function IconWater(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <path d="M12 2C8 8 4 12 4 16a8 8 0 0 0 16 0c0-4-4-8-8-14z" />
    </svg>
  )
}

export function IconCheck(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function IconCross(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function IconMic(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

export function IconMusic(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

export function IconStar(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

export function IconDiamond(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <rect x="12" y="2" width="14" height="14" transform="rotate(45 12 2)" />
    </svg>
  )
}

export function IconCircleFill(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  )
}

export function IconCircleEmpty(p: IconProps): JSX.Element {
  const s = iconProps(p.size ?? 24)
  return (
    <svg {...s} class={p.class} {...strokeProps}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  )
}
