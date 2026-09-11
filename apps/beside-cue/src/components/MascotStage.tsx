import { Show } from 'solid-js'
import { AssetStage } from '@/components/AssetStage'
import type { AssetSlot, CharacterStateId, ContentPack, MomentId, } from '@/content'
import { DEFAULT_CONTENT_PACK, MOMENTS, resolveMoment } from '@/content'
import { PREMIUM_PULL_IDS } from '@/content/premium-pulls'

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
 * The premium cast's cutouts are cropped to the silhouette, with none of the
 * transparent margin the free renders keep, so the stage gives them a box of
 * their own (see `.mascot-stage__pull--token`).
 */
function isPremiumPullId(id: string): boolean {
  return (PREMIUM_PULL_IDS as readonly string[]).includes(id)
}

/**
 * Stands in for the creature of a self-named Pull: the plan's own Side A
 * label, as the Home pressing draws it, without its words. It is plainly the
 * app's record mark and not a character, so the person's own words are never
 * handed a face from the cast.
 *
 * Drawn as a ring, never a disc: the label is a gold annulus with its spindle
 * hole punched through to the sleeve, rimmed in ink the way the record icon
 * draws its ring, so at two dozen pixels it reads as a label and not a sun.
 */
function CustomPullMark() {
  return (
    <svg
      class="mascot-stage__pull mascot-stage__pull--mark"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <circle
        cx="50"
        cy="50"
        r="30"
        fill="none"
        stroke="#efc13b"
        stroke-width="32"
      />
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="#241913"
        stroke-opacity=".45"
        stroke-width="4"
      />
      <circle
        cx="50"
        cy="50"
        r="16"
        fill="none"
        stroke="#241913"
        stroke-opacity=".45"
        stroke-width="4"
      />
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
                class={
                  isPremiumPullId(pull().id)
                    ? 'mascot-stage__pull mascot-stage__pull--token'
                    : 'mascot-stage__pull'
                }
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
