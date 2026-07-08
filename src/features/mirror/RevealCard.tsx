// ============================================================
// Voice Mirror — the tappable results card + legend reveal.
//
// The voiceprint is the card FRONT; the famous-singer "voice twin"
// is hidden until the singer taps. Two reveal styles, switchable so
// we can compare (or use flip on the first visit, lenticular on the
// returning/delta visit):
//
//   flip       — the card spins a few turns in 3D and lands on its
//                back face: the legend's constellation portrait + name.
//   lenticular — the portrait shines through the data; on a pointer
//                device, moving the cursor tilts the card in 3D and
//                the data + legend interleave with a moving specular.
//
// The front face is mounted by the parent (it hosts the shareable
// voiceprint canvas); this component owns the 3D, the tilt and the
// reveal state.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { legendArt, LegendCaricature } from './LegendCaricature'

export type RevealMode = 'flip' | 'lenticular'

export const RevealCard: Component<{
  legend: string | null
  voiceType: string | null
  mode: RevealMode
  revealed: boolean
  onToggle: () => void
  /** Ref for the front face — the parent mounts the voiceprint canvas here. */
  mountFront: (el: HTMLDivElement) => void
}> = (props) => {
  const [tilt, setTilt] = createSignal({ x: 0, y: 0, active: false })
  const hasLegend = (): boolean => props.legend !== null && props.legend !== ''

  const onMove = (e: PointerEvent): void => {
    if (props.mode !== 'lenticular' || !props.revealed) return
    const el = e.currentTarget as HTMLElement
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTilt({ x: -py * 14, y: px * 18, active: true })
  }
  const onLeave = (): void => {
    setTilt({ x: 0, y: 0, active: false })
  }

  const cardTransform = (): string =>
    props.mode === 'lenticular' && props.revealed
      ? `perspective(1000px) rotateX(${tilt().x}deg) rotateY(${tilt().y}deg)`
      : ''

  // Lenticular interleave: tilt shifts how much of the portrait shines through.
  const legendOpacity = (): number => {
    if (props.mode !== 'lenticular' || !props.revealed) return 0
    return Math.max(0.28, Math.min(0.92, 0.62 - tilt().y / 34))
  }

  return (
    <div
      class="mirror-reveal"
      classList={{
        'is-revealed': props.revealed,
        'mode-flip': props.mode === 'flip',
        'mode-lenticular': props.mode === 'lenticular',
        'has-legend': hasLegend(),
      }}
    >
      <Show when={hasLegend() && !props.revealed}>
        <span class="mirror-reveal-arrow left" aria-hidden="true">
          <span>❯</span>
          <span>❯</span>
        </span>
        <span class="mirror-reveal-arrow right" aria-hidden="true">
          <span>❮</span>
          <span>❮</span>
        </span>
      </Show>

      <button
        type="button"
        class="mirror-reveal-card"
        style={{ transform: cardTransform() }}
        onClick={() => hasLegend() && props.onToggle()}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        aria-label={
          !hasLegend()
            ? 'Your voiceprint'
            : props.revealed
              ? 'Show your voiceprint'
              : 'Reveal your voice twin'
        }
      >
        <div class="mirror-reveal-inner">
          <div
            class="mirror-card-face mirror-card-front"
            ref={props.mountFront}
          />
          <div class="mirror-card-face mirror-card-back">
            <Show when={hasLegend()}>
              <div class="mirror-legend-portrait">
                <LegendCaricature legend={props.legend ?? ''} />
              </div>
              <div class="mirror-legend-caption">
                <span class="mirror-legend-kicker">✦ your voice twin</span>
                <strong class="mirror-legend-name">{props.legend}</strong>
                <span class="mirror-legend-epithet">
                  {legendArt(props.legend ?? '').epithet}
                </span>
                <Show when={props.voiceType}>
                  <span class="mirror-legend-type">
                    {props.voiceType} range
                  </span>
                </Show>
              </div>
            </Show>
          </div>
        </div>

        {/* Lenticular overlay — the portrait shines through the data. */}
        <Show when={props.mode === 'lenticular' && hasLegend()}>
          <div
            class="mirror-lenticular-portrait"
            style={{ opacity: String(legendOpacity()) }}
          >
            <LegendCaricature legend={props.legend ?? ''} />
          </div>
          <div
            class="mirror-lenticular-shine"
            style={{
              opacity: props.revealed ? '1' : '0',
              transform: `translateX(${tilt().y * 5}px) rotate(20deg)`,
            }}
          />
        </Show>
      </button>

      <Show when={hasLegend()} fallback={<div class="mirror-reveal-spacer" />}>
        <Show
          when={props.revealed}
          fallback={
            <p class="mirror-reveal-hint">
              <span class="mirror-reveal-spark">✦</span>
              {props.mode === 'flip'
                ? 'tap to meet your voice twin'
                : 'tap, then tilt, to meet your voice twin'}
            </p>
          }
        >
          <p class="mirror-reveal-hint revealed">
            <span class="mirror-chip mirror-voicechip">
              {props.voiceType} · like {props.legend}
            </span>
            <button
              type="button"
              class="mirror-textbtn mirror-reveal-back"
              onClick={() => props.onToggle()}
            >
              {props.mode === 'flip' ? 'flip back' : 'hide twin'}
            </button>
          </p>
        </Show>
      </Show>
    </div>
  )
}
