// ============================================================
// The native Progress page's small parts, shared by its cards and sheets
// ============================================================
//
// Tiles for a figure and its words, a row that leads somewhere, the round
// glass button, a sheet's top line, and the glyph each kind of run wears.
// Every glyph is the shell's own (../icons.tsx).

import type { JSX } from 'solid-js'
import { createEffect, For, onCleanup, Show } from 'solid-js'
import type { ProgressActionView, ProgressEvidenceView, ProgressSourceKind, } from '@/features/progress/ProgressPage'
import { registerRoomBack } from '@/stores/native-shell-store'
import { CalendarIcon, ChevronIcon, CloseIcon, MicIcon, PrintIcon, PulseIcon, RefreshIcon, SparkleIcon, TargetIcon, TrophyIcon, } from '../icons'
import type { MomentGlyph } from './progress-lines'
import { leadNumber, linkHref } from './progress-lines'

/** The glyph a kind of run wears, beside its word: never its tint alone. */
export function SourceIcon(props: {
  source: ProgressSourceKind
  size?: number
}): JSX.Element {
  return (
    <>
      {props.source === 'practice' ? (
        <MicIcon size={props.size} />
      ) : props.source === 'exercise' ? (
        <PulseIcon size={props.size} />
      ) : props.source === 'challenge' ? (
        <TargetIcon size={props.size} />
      ) : (
        <CalendarIcon size={props.size} />
      )}
    </>
  )
}

/** The glyph on a moment's chip. */
export function MomentIcon(props: { glyph: MomentGlyph }): JSX.Element {
  const icons: Record<MomentGlyph, () => JSX.Element> = {
    calendar: () => <CalendarIcon size={16} />,
    pulse: () => <PulseIcon size={16} />,
    print: () => <PrintIcon size={16} />,
    mic: () => <MicIcon size={16} />,
    trophy: () => <TrophyIcon size={16} />,
    target: () => <TargetIcon size={16} />,
    return: () => <RefreshIcon size={16} />,
    sparkle: () => <SparkleIcon size={16} />,
  }
  return <>{icons[props.glyph]()}</>
}

/** Past this many characters a tile's figure is set smaller (progress.css). */
const LONG_FIGURE = 7

/** Figures with their words, two to a row: "4" over "active weeks". */
export function Tiles(props: {
  facts: readonly ProgressEvidenceView[]
}): JSX.Element {
  return (
    <Show when={props.facts.length > 0}>
      <dl class="mp-prog-tiles">
        <For each={props.facts}>
          {(fact) => (
            <div class="mp-prog-tile" data-fact={fact.id}>
              <dt class="mp-prog-tile__words">{fact.label}</dt>
              <dd
                class="mp-prog-tile__value"
                data-long={fact.value.length > LONG_FIGURE ? 'on' : undefined}
              >
                {fact.value}
              </dd>
              <Show when={fact.detail}>
                {(detail) => <dd class="mp-prog-tile__detail">{detail()}</dd>}
              </Show>
            </div>
          )}
        </For>
      </dl>
    </Show>
  )
}

/** A label written with its figure first ("3 active days"), as a tile. */
export function LabelTile(props: { label: string; id: string }): JSX.Element {
  const parts = () => leadNumber(props.label)
  return (
    <div class="mp-prog-tile" data-fact={props.id}>
      <span
        class="mp-prog-tile__value"
        data-long={parts().value.length > LONG_FIGURE ? 'on' : undefined}
      >
        {parts().value}
      </span>
      <Show when={parts().words !== ''}>
        <span class="mp-prog-tile__words">{parts().words}</span>
      </Show>
    </div>
  )
}

export interface ActionRowProps {
  action: ProgressActionView
  /** The smaller line under the action's name. */
  line?: string
  /** The row's own picture or glyph, at its leading edge. */
  lead?: JSX.Element
  onAction?: (action: ProgressActionView) => void
}

/**
 * A row that leads somewhere in the app: a link where the step has a
 * place (a hash route), a button where it has none or where the phone
 * pushes a screen of its own for it (progress-lines.ts linkHref).
 */
export function ActionRow(props: ActionRowProps): JSX.Element {
  const body = (): JSX.Element => (
    <>
      <Show when={props.lead}>
        {(lead) => (
          <span class="mp-prog-row__lead" aria-hidden="true">
            {lead()}
          </span>
        )}
      </Show>
      <span class="mp-prog-row__text">
        <span class="mp-prog-row__name">{props.action.label}</span>
        <Show when={props.line}>
          {(line) => <span class="mp-prog-row__line">{line()}</span>}
        </Show>
      </span>
      <ChevronIcon class="mp-prog-row__chev" size={20} />
    </>
  )
  return (
    <Show
      when={linkHref(props.action)}
      fallback={
        <button
          type="button"
          class="mp-prog-row"
          data-action={props.action.id}
          onClick={() => props.onAction?.(props.action)}
        >
          {body()}
        </button>
      }
    >
      {(href) => (
        <a
          class="mp-prog-row"
          href={href()}
          data-action={props.action.id}
          onClick={() => props.onAction?.(props.action)}
        >
          {body()}
        </a>
      )}
    </Show>
  )
}

/** A sheet's top line: what it is about, its title, and Close. */
export function SheetTop(props: {
  eyebrow?: string
  title: string
  titleId: string
  onClose: () => void
}): JSX.Element {
  return (
    <div class="mp-prog-sheet__top">
      <div class="mp-prog-sheet__titles">
        <Show when={props.eyebrow}>
          {(eyebrow) => <p class="mp-prog-meta">{eyebrow()}</p>}
        </Show>
        <h2 class="mp-prog-sheet__title" id={props.titleId}>
          {props.title}
        </h2>
      </div>
      <button
        type="button"
        class="mp-prog-round"
        aria-label="Close"
        data-testid="progress-sheet-close"
        onClick={() => props.onClose()}
      >
        <CloseIcon size={22} />
      </button>
    </div>
  )
}

/**
 * Back closes a sheet the page laid over its tab, as it does a room's
 * (native-shell-store.ts registerRoomBack), for as long as it is open.
 */
export function useSheetBack(open: () => boolean, close: () => void): void {
  createEffect(() => {
    if (!open()) return
    onCleanup(
      registerRoomBack(() => {
        close()
        return true
      }),
    )
  })
}
