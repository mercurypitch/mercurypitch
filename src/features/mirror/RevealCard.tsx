// ============================================================
// Voice Mirror — the tappable results card + legend reveal.
//
// The voiceprint is the card FRONT; the famous-singer "voice twin"
// is hidden until the singer taps. Two reveal styles, switchable so
// we can compare (or use flip on the first visit, lenticular on the
// returning/delta visit):
//
//   flip       — the card spins a few turns in 3D and lands on its
//                back face: the legend's portrait + name.
//   lenticular — the portrait shines through the data; on a pointer
//                device, moving the cursor tilts the card in 3D and
//                the data + legend interleave with a moving specular.
//
// The front face is mounted by the parent (it hosts the shareable
// voiceprint canvas); this component owns the 3D, the tilt and the
// reveal state. A raster portrait that fails to load falls back to
// the vector constellation, so the reveal never lands on a blank.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, Show } from 'solid-js'
import { IconChevron, IconSpark } from './icons'
import { legendArt, LegendCaricature } from './LegendCaricature'

export type RevealMode = 'flip' | 'lenticular'

export const RevealCard: Component<{
  legend: string | null
  voiceType: string | null
  mode: RevealMode
  revealed: boolean
  /** Spoken/selectable summary of the front card (range, scores) — the data
   *  only exists as canvas pixels, so this is its accessibility surface. */
  frontLabel?: string
  onToggle: () => void
  /** Ref for the front face — the parent mounts the voiceprint canvas here. */
  mountFront: (el: HTMLDivElement) => void
}> = (props) => {
  const [tilt, setTilt] = createSignal({ x: 0, y: 0 })
  const [portraitBroken, setPortraitBroken] = createSignal(false)
  const hasLegend = (): boolean => props.legend !== null && props.legend !== ''

  // A missing/renamed webp must not leave a blank back face — drop to the
  // vector constellation instead. Reset when the legend changes.
  createEffect(() => {
    void props.legend
    setPortraitBroken(false)
  })
  const portraitSrc = (): string | undefined =>
    portraitBroken() ? undefined : legendArt(props.legend ?? '').imageSrc

  const onMove = (e: PointerEvent): void => {
    if (props.mode !== 'lenticular' || !props.revealed) return
    const el = e.currentTarget as HTMLElement
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTilt({ x: -py * 14, y: px * 18 })
  }
  const onLeave = (): void => {
    setTilt({ x: 0, y: 0 })
  }

  const cardTransform = (): string =>
    props.mode === 'lenticular' && props.revealed
      ? `perspective(1000px) rotateX(${tilt().x}deg) rotateY(${tilt().y}deg)`
      : ''

  // Lenticular interleave: tilt shifts how much of the portrait shines through.
  const legendOpacity = (): number => {
    if (props.mode !== 'lenticular' || !props.revealed) return 0
    return Math.max(0.32, Math.min(0.95, 0.74 - tilt().y / 34))
  }

  // The full-bleed portrait drifts gently against the card tilt (parallax),
  // which is what sells the "two layers inside one card" lenticular depth.
  // Scale stays small so the crop hides as little of the art as possible.
  const portraitParallax = (): string =>
    `translate(${(tilt().y * 0.9).toFixed(1)}px, ${(-tilt().x * 0.9).toFixed(1)}px) scale(1.045)`

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
          <IconChevron size={22} />
          <IconChevron size={22} />
        </span>
        <span class="mirror-reveal-arrow right" aria-hidden="true">
          <IconChevron size={22} />
          <IconChevron size={22} />
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
            ? (props.frontLabel ?? 'Your voiceprint')
            : props.revealed
              ? 'Show your voiceprint'
              : props.frontLabel !== undefined
                ? `${props.frontLabel}. Reveal your voice twin`
                : 'Reveal your voice twin'
        }
      >
        <div class="mirror-reveal-inner">
          <div
            class="mirror-card-face mirror-card-front"
            ref={props.mountFront}
          />
          <div
            class="mirror-card-face mirror-card-back"
            classList={{ 'has-image': portraitSrc() !== undefined }}
          >
            <Show when={hasLegend()}>
              {/* Raster twin: full-bleed art + caption over a scrim — the
                  same integration as the lenticular, flip is just the
                  animation. Vector fallback keeps the framed layout. */}
              <Show
                when={portraitSrc()}
                fallback={
                  <div class="mirror-legend-portrait">
                    <LegendCaricature legend={props.legend ?? ''} />
                  </div>
                }
              >
                {(src) => (
                  <>
                    <img
                      class="mirror-back-img"
                      src={src()}
                      alt=""
                      onError={() => setPortraitBroken(true)}
                    />
                    <div class="mirror-back-scrim" />
                  </>
                )}
              </Show>
              <div class="mirror-legend-caption">
                <span class="mirror-legend-kicker">
                  <IconSpark size={10} /> your voice twin{' '}
                  <IconSpark size={10} />
                </span>
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

        {/* Lenticular overlay — the twin shines through the data. Raster
            portraits go full-bleed (cover) so the card melts into the
            caricature; the vector constellation stays for legends without
            an image. A bottom mask keeps the stats text legible. */}
        <Show when={props.mode === 'lenticular' && hasLegend()}>
          <div
            class="mirror-lenticular-portrait"
            style={{ opacity: String(legendOpacity()) }}
          >
            <Show
              when={portraitSrc()}
              fallback={<LegendCaricature legend={props.legend ?? ''} />}
            >
              {(src) => (
                <img
                  class="mirror-lenticular-img"
                  src={src()}
                  alt=""
                  style={{ transform: portraitParallax() }}
                  onError={() => setPortraitBroken(true)}
                />
              )}
            </Show>
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
              <span class="mirror-reveal-spark">
                <IconSpark size={13} />
              </span>
              {props.mode === 'flip'
                ? 'tap to meet your voice twin'
                : 'tap, then tilt, to meet your voice twin'}
            </p>
          }
        >
          <p class="mirror-reveal-hint revealed">
            <span
              class="mirror-chip mirror-voicechip"
              title="A playful range match — voice type and the legend you overlap with depend on more than range, so it stays a hint."
            >
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
