import { Show } from 'solid-js'
import { AssetStage } from '@/components/AssetStage'
import type { CharacterStateId, ContentPack, MomentId } from '@/content'
import { DEFAULT_CONTENT_PACK, MOMENTS, resolveMoment } from '@/content'

// Kept as the app's name for the mascot's four presentation states. The art,
// the caption and the spoken line now come from the content pack, so an art or
// recording pass lands without touching a screen.
export type MascotState = CharacterStateId

interface MascotStageProps {
  /** The named beat this screen is showing. Preferred over `state`. */
  moment?: MomentId
  /** Direct state, for surfaces that are not a beat of their own. */
  state?: MascotState
  /** Which pull the beat is about, so its cue token can appear. */
  pullId?: string
  /** Rotates the spoken line deterministically. */
  rotation?: number
  compact?: boolean
  pack?: ContentPack
}

const STATE_MOMENTS: Readonly<Record<MascotState, MomentId>> = {
  rest: 'return',
  notice: 'cue.open',
  turn: 'turn.b-side',
  quiet: 'turn.a-side',
}

export function MascotStage(props: MascotStageProps) {
  const pack = () => props.pack ?? DEFAULT_CONTENT_PACK
  const moment = () => props.moment ?? STATE_MOMENTS[props.state ?? 'rest']
  const presentation = () =>
    resolveMoment(pack(), moment(), {
      ...(props.pullId === undefined ? {} : { pullId: props.pullId }),
      ...(props.rotation === undefined ? {} : { rotation: props.rotation }),
    })

  return (
    <figure
      class="mascot-stage"
      classList={{ 'mascot-stage--compact': props.compact === true }}
      data-state={presentation().characterState}
    >
      <div class="mascot-stage__record" aria-hidden="true" />
      <div class="mascot-stage__sleeve">
        <AssetStage
          class="mascot-stage__art"
          slot={presentation().art}
          size={1024}
        />
        <Show when={presentation().entity}>
          {(entity) => (
            // Rendered through the same camera and crop as the character, so
            // it lands exactly where he is looking with no positioning here.
            <AssetStage
              class="mascot-stage__cue"
              slot={entity().noticeOverlay}
              size={1024}
            />
          )}
        </Show>
        <span class="mascot-stage__wash" aria-hidden="true" />
      </div>
      <figcaption>{MOMENTS[moment()].caption}</figcaption>
    </figure>
  )
}
