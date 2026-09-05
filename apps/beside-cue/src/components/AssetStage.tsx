import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import type { AssetSlot, RenderableTierName } from '@/content'
import { resolveAsset } from '@/content'
import { NonCopyableArt } from '@/interaction/selection'

// ============================================================
// AssetStage — draws whichever tier of a slot is actually available
// ============================================================
//
// Every subject in the app (Corky, a cue token, whatever gets modelled next)
// hands this one slot. It picks a tier and draws it, so no screen has to know
// whether the art pass has reached video yet.
//
// The still is always in the DOM and richer tiers layer over it, rather than
// replacing it once they load. That way there is no blank frame while a video
// buffers, and a decode failure degrades to the still with no error path of
// its own.
//
// Frames matter more than they look: a Blender pass can bake a pose run
// cheaply, so a sequence is the tier most subjects reach before they ever get
// a video, and a non-looping sequence is how a character animates into a state
// and then holds there.

interface AssetStageProps {
  slot: AssetSlot
  /** Hold the tier down for a small or calm surface. */
  ceiling?: RenderableTierName
  class?: string
  /** Rendered size hint. The stills are square. */
  size?: number
}

function createReducedMotion(): () => boolean {
  if (typeof window === 'undefined' || window.matchMedia === undefined) {
    return () => false
  }
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  const [reduced, setReduced] = createSignal(query.matches)
  const listener = (event: MediaQueryListEvent): void => {
    setReduced(event.matches)
  }
  query.addEventListener('change', listener)
  onCleanup(() => {
    query.removeEventListener('change', listener)
  })
  return reduced
}

export function AssetStage(props: AssetStageProps) {
  const reducedMotion = createReducedMotion()
  const resolution = () =>
    resolveAsset(props.slot, {
      reducedMotion: reducedMotion(),
      ...(props.ceiling === undefined ? {} : { ceiling: props.ceiling }),
    })
  const size = () => props.size ?? 1024

  const [frame, setFrame] = createSignal(0)

  createEffect(() => {
    const sequence = resolution().frames
    setFrame(0)
    if (sequence === undefined || sequence.urls.length < 2) {
      return
    }
    const interval = setInterval(
      () => {
        setFrame((current) => {
          const next = current + 1
          if (next < sequence.urls.length) {
            return next
          }
          if (sequence.loop) {
            return 0
          }
          // A one-shot sequence holds its final pose rather than snapping back.
          clearInterval(interval)
          return current
        })
      },
      Math.max(1, Math.round(1000 / sequence.fps)),
    )
    onCleanup(() => {
      clearInterval(interval)
    })
  })

  const frameUrl = (): string | undefined => {
    const sequence = resolution().frames
    if (sequence === undefined) {
      return undefined
    }
    return sequence.urls[Math.min(frame(), sequence.urls.length - 1)]
  }

  return (
    <div
      class="asset-stage"
      classList={{ [props.class ?? '']: props.class !== undefined }}
      data-tier={resolution().tier}
    >
      <img
        {...NonCopyableArt}
        class="asset-stage__still"
        src={resolution().still}
        alt={resolution().alt}
        width={size()}
        height={size()}
        decoding="async"
      />
      <Show when={frameUrl()}>
        {(url) => (
          // Decorative: the still beneath already carries the description.
          <img
            {...NonCopyableArt}
            class="asset-stage__motion"
            src={url()}
            width={size()}
            height={size()}
            alt=""
            aria-hidden="true"
            decoding="async"
          />
        )}
      </Show>
      <Show when={resolution().video}>
        {(video) => (
          <video
            class="asset-stage__motion"
            src={video()}
            width={size()}
            height={size()}
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
