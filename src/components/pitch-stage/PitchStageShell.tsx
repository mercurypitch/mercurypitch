import type { Component, JSX } from 'solid-js'
import { children, For, Show } from 'solid-js'
import styles from './PitchStageShell.module.css'

export type PitchStageMode = 'stem-edit' | 'zen-monitor' | 'zen-exercise'

export interface PitchStageLegendItem {
  label: string
  color: string
}

export interface PitchStageShellProps {
  mode: PitchStageMode
  ariaLabel: string
  testId?: string
  class?: string
  eyebrow: string
  title: string
  icon: JSX.Element
  referenceColor: string
  userColor: string
  legend?: readonly PitchStageLegendItem[]
  legendAriaLabel?: string
  headerMeta?: JSX.Element
  primaryAction?: JSX.Element
  canvas?: JSX.Element
  sidecar?: JSX.Element
  sidecarAriaLabel?: string
  footer?: JSX.Element
}

/**
 * Shared full-screen chrome for pitch-focused experiences.
 *
 * The shell owns presentation only: identity, legend, optional canvas mount,
 * sidecar, and footer slots. Audio, pitch detection, editing, scoring, and
 * navigation stay in each mode's controller and facade.
 */
export const PitchStageShell: Component<PitchStageShellProps> = (props) => {
  // Resolve JSX slots under this component's owner. Rendering a raw JSX prop
  // from inside a conditional can otherwise mount effects (such as the Stem
  // edit toolbar's Escape listener) outside the render root, leaking them
  // across unmounts.
  const icon = children(() => props.icon)
  const headerMeta = children(() => props.headerMeta)
  const primaryAction = children(() => props.primaryAction)
  const canvas = children(() => props.canvas)
  const sidecar = children(() => props.sidecar)
  const footer = children(() => props.footer)

  const hasCanvas = () => canvas() !== undefined
  const hasSidecar = () => sidecar() !== undefined
  const hasFooter = () => footer() !== undefined

  return (
    <section
      class={`${styles.stage}${
        props.class !== undefined && props.class !== '' ? ` ${props.class}` : ''
      }`}
      data-testid={props.testId}
      data-pitch-stage-mode={props.mode}
      data-has-canvas={hasCanvas() ? 'true' : 'false'}
      data-has-sidecar={hasSidecar() ? 'true' : 'false'}
      data-has-footer={hasFooter() ? 'true' : 'false'}
      aria-label={props.ariaLabel}
      style={{
        '--pitch-reference': props.referenceColor,
        '--pitch-user': props.userColor,
      }}
    >
      <header class={styles.header}>
        <div class={styles.identity}>
          <span class={styles.mark} aria-hidden="true">
            {icon()}
          </span>
          <div>
            <p>{props.eyebrow}</p>
            <h2>{props.title}</h2>
          </div>
        </div>

        <div
          class={styles.legend}
          aria-label={props.legendAriaLabel ?? 'Pitch layer legend'}
        >
          <For each={props.legend ?? []}>
            {(item) => (
              <span>
                <i
                  class={styles.legendSwatch}
                  style={{ '--pitch-layer-color': item.color }}
                />
                {item.label}
              </span>
            )}
          </For>
        </div>

        <div class={styles.headerMeta}>
          {headerMeta()}
          {primaryAction()}
        </div>
      </header>

      <Show when={hasCanvas()}>
        <div class={styles.canvasSurface} data-pitch-stage-canvas>
          {canvas()}
        </div>
      </Show>

      <Show when={hasSidecar()}>
        <aside class={styles.sidecar} aria-label={props.sidecarAriaLabel}>
          {sidecar()}
        </aside>
      </Show>

      <Show when={hasFooter()}>
        <footer class={styles.footer}>{footer()}</footer>
      </Show>
    </section>
  )
}
