// ============================================================
// Home companion — Corky's place beside the deck
// ============================================================
//
// In v1 this is the approved rest still and nothing moves on it: there is no
// CSS motion on a photographic still. The living-rest loop (L01) plugs in
// through this same slot once it is accepted: give `CORKY_HOME_ART` in
// `pack.ts` a `video`, framed on the still's 1024 canvas, and this renders it
// muted, inline and looping, paused while the app is hidden, with the still
// as its poster and as the reduced-motion fallback. Nothing else on Home
// changes.
//
// The 1024 stills carry a transparent margin (the body sits at x 98–926,
// y 99–925), so the scene positions the body, not the file: this component's
// box is the visible body and the image hangs over its edges by the margin.

import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { AssetSlot } from '@/content'
import { resolveAsset } from '@/content'
import { NonCopyableArt } from '@/interaction/selection'
import styles from './HomeCompanion.module.css'

interface HomeCompanionProps {
  /** Its `alt` is shown as given: localize it before handing the slot in. */
  slot: AssetSlot
  class?: string
}

function reducedMotionPreferred(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function HomeCompanion(props: HomeCompanionProps) {
  const [reducedMotion, setReducedMotion] = createSignal(
    reducedMotionPreferred(),
  )
  const resolution = () =>
    resolveAsset(props.slot, {
      reducedMotion: reducedMotion(),
      ceiling: 'video',
    })

  let video: HTMLVideoElement | undefined

  onMount(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    )
      return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event: MediaQueryListEvent): void => {
      setReducedMotion(event.matches)
    }
    query.addEventListener('change', onChange)
    // A clip must not keep decoding behind a hidden app or another tab.
    const onVisibility = (): void => {
      if (video === undefined) return
      if (document.visibilityState === 'hidden') video.pause()
      else void video.play().catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVisibility)
    onCleanup(() => {
      query.removeEventListener('change', onChange)
      document.removeEventListener('visibilitychange', onVisibility)
    })
  })

  return (
    <div
      class={styles.companion}
      classList={{ [props.class ?? '']: props.class !== undefined }}
      data-tier={resolution().tier}
    >
      <img
        {...NonCopyableArt}
        class={styles.art}
        src={resolution().still}
        alt={resolution().alt}
        width="1024"
        height="1024"
        decoding="async"
      />
      <Show when={resolution().video}>
        {(source) => (
          <video
            ref={video}
            class={styles.art}
            src={source()}
            poster={resolution().still}
            width="1024"
            height="1024"
            autoplay
            muted
            loop
            playsinline
            aria-hidden="true"
          />
        )}
      </Show>
    </div>
  )
}
