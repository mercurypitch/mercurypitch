// ============================================================
// Home scene — the deck front-left, the plan's record on it, Corky beside
// ============================================================
//
// The landing hero's composition, scaled to the phone: the deck at 76% of the
// scene's width, Corky's body at 56% front-right and overlapping the deck's
// right edge (the parked tonearm sits behind Corky, which is also what keeps
// the baked-in arm from ever needing to move), the record seated on the
// platter by the geometry measured for the landing's Plate.
//
// Nothing here moves at rest. The record turns only on the way into a cue
// and settles once after a recorded Side B; Corky is the rest still. The
// deck is a bitmap and the record is SVG, so a deck that fails to load hides
// itself and leaves the record where it is: the seat's geometry comes from
// the CSS box, not the image.

import { createSignal, Show } from 'solid-js'
import type { AssetSlot } from '@/content'
import { CORKY_HOME_ART } from '@/content'
import { useCopy } from '@/i18n/ui-copy'
import { NonCopyableArt, NoSelect } from '@/interaction/selection'
import { HomeCompanion } from './HomeCompanion'
import type { RecordMotion, RecordSide } from './HomeRecord'
import { HomeRecord } from './HomeRecord'
import styles from './HomeScene.module.css'

/**
 * The landing's `turntable-hero.png` (900 x 606, an empty platter with the
 * tonearm parked), saved near-lossless as WebP with its alpha intact. Source:
 * packages/beside-cue/src/assets/props/turntable-hero.png in the landing
 * repo (disjoint-colliders). The record is not part of the bitmap.
 */
export const DECK_ART = `${import.meta.env.BASE_URL}art/props/turntable-hero-900.webp`

export interface HomeSceneRecord {
  side: RecordSide
  motion: RecordMotion
  /** The plan's Pull; absent for a self-named Pull. */
  pullId?: string
}

interface HomeSceneProps {
  /** Absent when there is no plan: the platter stays empty. */
  record?: HomeSceneRecord
  paused?: boolean
  /**
   * Corky, with an already localized `alt`. Defaults to the pack's Home
   * slot; a clip lands there, not here.
   */
  companion?: AssetSlot
  onSettled?: () => void
  class?: string
}

export function HomeScene(props: HomeSceneProps) {
  const copy = useCopy()
  const [deckFailed, setDeckFailed] = createSignal(false)

  return (
    <div
      class={styles.scene}
      classList={{ [props.class ?? '']: props.class !== undefined }}
      data-record={props.record === undefined ? 'empty' : props.record.side}
      data-motion={props.record?.motion ?? 'still'}
      data-deck={deckFailed() ? 'missing' : 'ready'}
      data-callout="none"
      {...NoSelect}
    >
      <span class={styles.glow} aria-hidden="true" />
      <Show when={props.paused}>
        <span class={styles.chip}>{copy.t('Paused')}</span>
      </Show>
      <div class={styles.deck}>
        <img
          {...NonCopyableArt}
          class={styles.deckArt}
          src={DECK_ART}
          alt=""
          width="900"
          height="606"
          decoding="async"
          hidden={deckFailed()}
          onError={() => setDeckFailed(true)}
        />
        <div class={styles.seat}>
          <Show when={props.record}>
            {(record) => (
              <HomeRecord
                side={record().side}
                motion={record().motion}
                {...(record().pullId === undefined
                  ? {}
                  : { pullId: record().pullId })}
                {...(props.onSettled === undefined
                  ? {}
                  : { onSettled: props.onSettled })}
              />
            )}
          </Show>
        </div>
      </div>
      <HomeCompanion
        class={styles.companion}
        slot={
          props.companion ?? {
            ...CORKY_HOME_ART,
            alt: copy.t(CORKY_HOME_ART.alt),
          }
        }
      />
    </div>
  )
}
