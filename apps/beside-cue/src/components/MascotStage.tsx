import { Show } from 'solid-js'
import { AssetStage } from '@/components/AssetStage'
import type { AssetSlot, CharacterStateId, ContentPack, MomentId, } from '@/content'
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
  /** Which pull the beat is about, so its own creature can appear. */
  pullId?: string
  /** Rotates the spoken line deterministically. */
  rotation?: number
  compact?: boolean
  pack?: ContentPack
  /** Surface-specific art, while the named state still owns copy and motion. */
  artOverride?: AssetSlot
}

const STATE_MOMENTS: Readonly<Record<MascotState, MomentId>> = {
  rest: 'return',
  notice: 'cue.open',
  turn: 'turn.b-side',
  quiet: 'turn.a-side',
}

/**
 * Stands in for the creature of a self-named Pull: the plan's own Side A
 * label, as the Home pressing draws it, without its words. It is plainly the
 * app's record mark and not a character, so the person's own words are never
 * handed a face from the cast.
 */
function CustomPullMark() {
  return (
    <svg
      class="mascot-stage__pull mascot-stage__pull--mark"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="46" fill="#efc13b" />
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="#241913"
        stroke-opacity=".3"
      />
      <circle cx="50" cy="50" r="4.5" fill="#fff5dd" />
    </svg>
  )
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
          slot={props.artOverride ?? presentation().art}
          size={1024}
        />
        <Show when={presentation().showsPull}>
          <Show
            when={presentation().pullCharacter}
            fallback={<CustomPullMark />}
          >
            {(pull) => (
              // The Pull's approved cutout, placed by the stylesheet where
              // the notice pose looks. Decorative: the screen already names
              // the Pull in words, and Corky's own description says a Pull
              // has arrived, so a second description would only repeat it.
              <AssetStage
                class="mascot-stage__pull"
                slot={{ still: pull().token.still, alt: '' }}
                size={512}
              />
            )}
          </Show>
        </Show>
        <span class="mascot-stage__wash" aria-hidden="true" />
      </div>
      <figcaption>{MOMENTS[moment()].caption}</figcaption>
    </figure>
  )
}
