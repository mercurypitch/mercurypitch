// ============================================================
// SingerMoreButton — the "..." at the end of a row that names a singer
// ============================================================
//
// One 44 px button, named for the singer ("More about Ada"), that opens the
// singer sheet on them (singer-sheet-store.ts): Report and Block. It stops
// its press there, so a row that opens something of its own (the
// Leaderboard's singer card) does not open that as well. It hands the sheet
// its board and its place there, so the focus can come back to that place
// when the sheet closes, whatever the sheet did to the row (sheet-focus.ts).
// The phone's screens hand it their own drawing of the dots.

import type { JSX } from 'solid-js'
import { MoreHorizontal } from '@/components/icons'
import type { SingerSheetSubject } from '@/stores/singer-sheet-store'
import { openSingerSheet } from '@/stores/singer-sheet-store'
import { openerOf } from './sheet-focus'
import styles from './SingerMoreButton.module.css'

export interface SingerMoreButtonProps {
  subject: SingerSheetSubject
  /** The dots as the host draws them; the web's own otherwise. */
  icon?: JSX.Element
  class?: string
}

export function SingerMoreButton(props: SingerMoreButtonProps): JSX.Element {
  return (
    <button
      type="button"
      class={
        props.class === undefined
          ? styles.more
          : `${styles.more} ${props.class}`
      }
      aria-label={`More about ${props.subject.displayName}`}
      aria-haspopup="dialog"
      data-singer-more={props.subject.userId}
      onClick={(event) => {
        event.stopPropagation()
        openSingerSheet(props.subject, openerOf(event.currentTarget))
      }}
    >
      {props.icon ?? <MoreHorizontal size={20} />}
    </button>
  )
}

/** The button's room on a row that has none, so the columns stay in line. */
export function SingerMoreSpace(props: { class?: string }): JSX.Element {
  return (
    <span
      class={
        props.class === undefined
          ? styles.space
          : `${styles.space} ${props.class}`
      }
      aria-hidden="true"
    />
  )
}
