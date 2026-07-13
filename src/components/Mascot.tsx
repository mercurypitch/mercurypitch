import type { Component, JSX } from 'solid-js'
import { createMemo, createUniqueId, Match, Show, Switch } from 'solid-js'
import styles from './Mascot.module.css'

/**
 * Merc — the MercuryPitch mascot.
 *
 * Original hand-authored vector (copyright-clean per BRAND.md section 7), rebuilt
 * from the locked look-dev sheet in docs/branding/mascot/. Renders as a single
 * inline SVG (~5 KB), theme-agnostic, crisp at any size, animated with CSS so it
 * can react to the live pitch signals. See docs/branding/MASCOT.md (Phase 1).
 *
 * States map to the accuracy bands the app already streams:
 *   perfect -> celebrate, excellent/good -> idle/listening, okay -> encouraging,
 *   off -> encouraging, and singing/sleep for playback + resting moments.
 */
export type MascotState =
  | 'idle'
  | 'listening'
  | 'celebrate'
  | 'encouraging'
  | 'singing'
  | 'sleep'

type MaybeAccessor<T> = T | (() => T)

function read<T>(v: MaybeAccessor<T> | undefined, fallback: T): T {
  if (typeof v === 'function') return (v as () => T)()
  return v ?? fallback
}

export interface MascotProps {
  /** Current expression. Accepts a plain value or an accessor (signal). */
  state?: MaybeAccessor<MascotState>
  /** 0-100 singing energy; subtly quickens the idle bob. Value or accessor. */
  energy?: MaybeAccessor<number>
  /** Rendered width in px (height scales to the 120x140 viewBox). Default 96. */
  size?: number
  /** Extra class on the root svg. */
  class?: string
  /** Accessible label; pass '' to hide Merc from the a11y tree. Default 'Merc'. */
  title?: string
}

const BODY =
  'M60 21 C67 27 99 47 99 83 C99 108 81 121 60 121 C39 121 21 108 21 83 C21 47 53 27 60 21 Z'

function Note(props: {
  x: number
  y: number
  color: string
  class?: string
  small?: boolean
}): JSX.Element {
  // The outer <g> carries the position; the inner (animated) <g> owns the CSS
  // transform. Separating them stops the float animation's `transform` from
  // clobbering the positional translate (which snapped notes to the 0,0 corner).
  return (
    <g transform={`translate(${props.x} ${props.y})`}>
      <g class={`${styles.note} ${props.class ?? ''}`}>
        <circle
          cx="0"
          cy={props.small === true ? 5 : 6}
          r={props.small === true ? 2.1 : 2.3}
          fill={props.color}
        />
        <rect
          x={props.small === true ? 1.6 : 1.7}
          y={props.small === true ? -5 : -6}
          width={props.small === true ? 1.4 : 1.5}
          height={props.small === true ? 11 : 12}
          fill={props.color}
        />
        <path
          d={
            props.small === true
              ? 'M3 -5 q3.6 1 4.6 3.4 q-2.8 -1 -4.6 0 z'
              : 'M3.2 -6 q4 1 5 3.6 q-3 -1 -5 0 z'
          }
          fill={props.color}
        />
      </g>
    </g>
  )
}

export const Mascot: Component<MascotProps> = (props) => {
  const uid = createUniqueId()
  const id = (name: string) => `${name}-${uid}`
  const url = (name: string) => `url(#${id(name)})`

  const state = createMemo<MascotState>(() => read(props.state, 'idle'))
  const energy = createMemo(() =>
    Math.max(0, Math.min(100, read(props.energy, 0))),
  )
  // higher energy -> quicker breathing (3s calm down to ~2s energized)
  const bobDur = createMemo(() => `${(3 - energy() / 100).toFixed(2)}s`)
  const size = () => props.size ?? 96

  const poseClass = createMemo(() =>
    state() === 'listening'
      ? styles.lean
      : state() === 'encouraging'
        ? styles.tilt
        : '',
  )
  const bobClass = createMemo(
    () => `${styles.bob} ${state() === 'celebrate' ? styles.hop : ''}`,
  )

  return (
    <svg
      class={`${styles.mascot} ${props.class ?? ''}`}
      viewBox="0 0 120 140"
      width={size()}
      height={(size() * 140) / 120}
      role={props.title === '' ? 'presentation' : 'img'}
      aria-label={props.title === '' ? undefined : (props.title ?? 'Merc')}
      style={{ '--merc-bob': bobDur() } as JSX.CSSProperties}
    >
      <defs>
        <linearGradient id={id('gBody')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#c0a0f6" />
          <stop offset=".4" stop-color="#c4bced" />
          <stop offset=".58" stop-color="#d0e9ec" />
          <stop offset=".78" stop-color="#84e0d5" />
          <stop offset="1" stop-color="#3fd1bf" />
        </linearGradient>
        <radialGradient id={id('gSub')} cx="46%" cy="37%" r="45%">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".52" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
        <linearGradient id={id('gRim')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset=".5" stop-color="#dbe6f1" />
          <stop offset="1" stop-color="#a9bccb" />
        </linearGradient>
        <linearGradient id={id('gGlow')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#bc8cff" />
          <stop offset="1" stop-color="#2dd4bf" />
        </linearGradient>
        <linearGradient id={id('gSpec')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#58a6ff" />
          <stop offset=".5" stop-color="#2dd4bf" />
          <stop offset="1" stop-color="#bc8cff" />
        </linearGradient>
        <filter id={id('glow')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={id('soft')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      {/* ground shadow (stays put while Merc bobs) */}
      <ellipse
        cx="60"
        cy="132"
        rx="22"
        ry="3.4"
        fill="#000"
        opacity=".26"
        filter={url('soft')}
      />

      {/* fixed accents that don't move with the body */}
      <Switch>
        <Match when={state() === 'idle'}>
          <Note x={32} y={34} color="#2dd4bf" />
          <Note x={86} y={42} color="#bc8cff" class={styles.nb} />
        </Match>
        <Match when={state() === 'listening'}>
          <g class={styles.ripple}>
            <path
              d="M104 72 Q109 79 104 86"
              fill="none"
              stroke={url('gSpec')}
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M99 74 Q103 79 99 84"
              fill="none"
              stroke={url('gSpec')}
              stroke-width="2"
              stroke-linecap="round"
            />
          </g>
        </Match>
        <Match when={state() === 'celebrate'}>
          <Note x={40} y={28} color="#58a6ff" />
          <Note x={60} y={22} color="#2dd4bf" class={styles.nb} />
          <Note x={80} y={28} color="#bc8cff" class={styles.nc} />
        </Match>
        <Match when={state() === 'singing'}>
          <path
            class={styles.ribbon}
            d="M70 84 C86 80 88 60 104 56"
            fill="none"
            stroke={url('gSpec')}
            stroke-width="2.4"
            stroke-linecap="round"
          />
          <Note x={100} y={44} color="#2dd4bf" class={styles.nb} small />
        </Match>
      </Switch>

      <g class={poseClass()}>
        <g class={bobClass()}>
          {/* raised arms behind the body on celebrate */}
          <Show when={state() === 'celebrate'}>
            <g fill={url('gBody')} stroke={url('gRim')} stroke-width="1.3">
              <ellipse
                cx="23"
                cy="58"
                rx="4.6"
                ry="7.8"
                transform="rotate(42 23 58)"
              />
              <ellipse
                cx="97"
                cy="58"
                rx="4.6"
                ry="7.8"
                transform="rotate(-42 97 58)"
              />
            </g>
          </Show>

          {/* soft outer glow */}
          <path
            d={BODY}
            fill={url('gGlow')}
            filter={url('glow')}
            opacity=".72"
          />
          {/* feet peeking below */}
          <ellipse cx="50" cy="125" rx="6.4" ry="4.8" fill="#4fd8c6" />
          <ellipse cx="70" cy="125" rx="6.4" ry="4.8" fill="#4fd8c6" />
          {/* body + luminous core + glassy rim */}
          <path d={BODY} fill={url('gBody')} />
          <ellipse
            cx="60"
            cy="99"
            rx="25"
            ry="19"
            fill="#63ecd8"
            opacity=".3"
            filter={url('soft')}
          />
          <path d={BODY} fill={url('gSub')} />
          <path d={BODY} fill="none" stroke={url('gRim')} stroke-width="2.6" />
          <path
            d={BODY}
            fill="none"
            stroke="#ffffff"
            stroke-width="1"
            opacity=".22"
          />
          {/* top-left rim highlight + gloss */}
          <path
            d="M29 66 Q33 30 58 20"
            fill="none"
            stroke="#ffffff"
            stroke-width="3"
            stroke-linecap="round"
            opacity=".9"
          />
          <ellipse
            cx="52"
            cy="40"
            rx="20"
            ry="13"
            fill="#ffffff"
            opacity=".13"
            filter={url('soft')}
          />
          <ellipse
            cx="44"
            cy="45"
            rx="9"
            ry="14"
            fill="#ffffff"
            opacity=".55"
            transform="rotate(-22 44 45)"
            filter={url('soft')}
          />
          <ellipse
            cx="38"
            cy="64"
            rx="3.1"
            ry="5.4"
            fill="#ffffff"
            opacity=".42"
            filter={url('soft')}
          />

          {/* face per state */}
          <Switch>
            <Match when={state() === 'idle'}>
              <g class={styles.eyes}>
                <ellipse cx="49" cy="79" rx="4.2" ry="5.6" fill="#2c2e48" />
                <ellipse cx="71" cy="79" rx="4.2" ry="5.6" fill="#2c2e48" />
                <circle cx="47.4" cy="76.6" r="1.5" fill="#ffffff" />
                <circle cx="69.4" cy="76.6" r="1.5" fill="#ffffff" />
              </g>
              <path
                d="M53 90 Q60 95 67 90"
                fill="none"
                stroke="#2c2e48"
                stroke-width="2.3"
                stroke-linecap="round"
              />
            </Match>

            <Match when={state() === 'listening'}>
              <g class={styles.eyes}>
                <ellipse cx="50" cy="79" rx="4.4" ry="5.8" fill="#2c2e48" />
                <ellipse cx="72" cy="79" rx="4.4" ry="5.8" fill="#2c2e48" />
                <circle cx="48.2" cy="76.4" r="1.6" fill="#ffffff" />
                <circle cx="70.2" cy="76.4" r="1.6" fill="#ffffff" />
              </g>
              <ellipse cx="61" cy="91" rx="3" ry="3.3" fill="#2c2e48" />
            </Match>

            <Match when={state() === 'celebrate'}>
              <g class={styles.eyes}>
                <ellipse cx="49" cy="77" rx="4.8" ry="6.2" fill="#2c2e48" />
                <ellipse cx="71" cy="77" rx="4.8" ry="6.2" fill="#2c2e48" />
                <circle cx="47" cy="74.2" r="1.8" fill="#ffffff" />
                <circle cx="69" cy="74.2" r="1.8" fill="#ffffff" />
              </g>
              <path d="M52 87 Q60 98 68 87 Q60 91 52 87 Z" fill="#2c2e48" />
            </Match>

            <Match when={state() === 'encouraging'}>
              <ellipse
                cx="44"
                cy="84"
                rx="5.2"
                ry="3.2"
                fill="#ff9ec4"
                opacity=".38"
              />
              <ellipse
                cx="76"
                cy="84"
                rx="5.2"
                ry="3.2"
                fill="#ff9ec4"
                opacity=".38"
              />
              <path
                d="M44 79 Q49 74 54 79"
                fill="none"
                stroke="#2c2e48"
                stroke-width="2.3"
                stroke-linecap="round"
              />
              <path
                d="M66 79 Q71 74 76 79"
                fill="none"
                stroke="#2c2e48"
                stroke-width="2.3"
                stroke-linecap="round"
              />
              <path
                d="M52 88 Q60 94 68 88"
                fill="none"
                stroke="#2c2e48"
                stroke-width="2.3"
                stroke-linecap="round"
              />
            </Match>

            <Match when={state() === 'singing'}>
              <path
                d="M44 76 Q49 81 54 76"
                fill="none"
                stroke="#2c2e48"
                stroke-width="2.3"
                stroke-linecap="round"
              />
              <path
                d="M66 76 Q71 81 76 76"
                fill="none"
                stroke="#2c2e48"
                stroke-width="2.3"
                stroke-linecap="round"
              />
              <ellipse cx="60" cy="91" rx="4.6" ry="5.8" fill="#2c2e48" />
              <ellipse cx="60" cy="93.5" rx="2.6" ry="2.8" fill="#ff8fb0" />
            </Match>

            <Match when={state() === 'sleep'}>
              <path
                d="M45 79 Q49 82 53 79"
                fill="none"
                stroke="#2c2e48"
                stroke-width="2.2"
                stroke-linecap="round"
              />
              <path
                d="M67 79 Q71 82 75 79"
                fill="none"
                stroke="#2c2e48"
                stroke-width="2.2"
                stroke-linecap="round"
              />
              <ellipse cx="60" cy="90" rx="2.3" ry="2.5" fill="#2c2e48" />
            </Match>
          </Switch>
        </g>
      </g>
    </svg>
  )
}

export default Mascot
