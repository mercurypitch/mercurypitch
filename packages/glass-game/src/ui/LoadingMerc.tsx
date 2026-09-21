// Loading Merc — owns the temporary 3D preview and retains artwork if graphics fail.
import { createEffect, createSignal, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { createLoadingMerc } from '../render/loading-merc'
import type { AdventureLoadingPhase } from './loading-lifecycle'
import styles from './LoadingScreen.module.css'

interface LoadingMercProps {
  modelUrl: string
  artUrl: string
  generation: number
  phase: Exclude<AdventureLoadingPhase, 'ready'>
  completedUnits: number
  totalUnits: number
}

export function LoadingMerc(props: LoadingMercProps) {
  // A disposed WebGL context must never be reused by a retry. Key the complete
  // canvas lifetime to the real attempt, and skip the pre-mount generation.
  return (
    <Show
      when={props.generation || undefined}
      keyed
      fallback={
        <img
          class={styles.merc}
          src={props.artUrl}
          alt=""
          decoding="async"
          draggable={false}
        />
      }
    >
      {(generation) => (
        <LoadingMercAttempt {...props} generation={generation} />
      )}
    </Show>
  )
}

function LoadingMercAttempt(props: LoadingMercProps) {
  let canvas!: HTMLCanvasElement
  let preview: ReturnType<typeof createLoadingMerc> | undefined
  const [visible, setVisible] = createSignal(false)
  const [reducedMotion, setReducedMotion] = createSignal(false)
  const state = () => ({
    phase: props.phase,
    completedUnits: props.completedUnits,
    totalUnits: props.totalUnits,
  })

  onMount(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = (): void => {
      setReducedMotion(media.matches)
    }
    change()
    media.addEventListener('change', change)
    onCleanup(() => media.removeEventListener('change', change))
  })
  createEffect(
    on(
      () => props.modelUrl,
      (modelUrl) => {
        let active = true
        setVisible(false)
        try {
          const current = createLoadingMerc(canvas, {
            modelUrl,
            reducedMotion: untrack(reducedMotion),
            onFirstFrame: () => {
              if (active) setVisible(true)
            },
            onError: () => {
              if (active) setVisible(false)
            },
          })
          preview = current
          current.setState(untrack(state))
          onCleanup(() => {
            active = false
            if (preview === current) preview = undefined
            current.dispose()
          })
        } catch {
          // The game owns its readiness. A failed optional preview keeps the art.
          preview = undefined
        }
      },
    ),
  )
  createEffect(() => {
    const current = state()
    preview?.setState(current)
  })
  createEffect(() => {
    const still = reducedMotion()
    preview?.setReducedMotion(still)
  })

  return (
    <div
      class={styles.mercStage}
      data-testid="glass-loading-merc"
      data-ready={visible()}
      data-reduced-motion={reducedMotion()}
    >
      <img
        class={styles.merc}
        src={props.artUrl}
        alt=""
        decoding="async"
        draggable={false}
      />
      <canvas ref={canvas} class={styles.mercCanvas} aria-hidden="true" />
    </div>
  )
}
