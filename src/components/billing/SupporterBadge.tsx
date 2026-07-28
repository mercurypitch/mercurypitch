// ============================================================
// SupporterBadge — the "you gave" mark, styled per donation tier
// ============================================================
// One badge, two homes: the account identity row and the donate panel. The
// tier NAME comes from the DB (billing/me → sourceLabel), so renaming a tier
// never needs a release; only the visual treatment is keyed to the seed ids,
// and an unknown id falls back to the base look rather than rendering wrong.

import type { Component, JSX } from 'solid-js'
import { Show } from 'solid-js'
import { formatSupporterExpiry } from '@/db/services/billing-service'
import styles from './SupporterBadge.module.css'

/** Seeded donation tiers, ascending. Drives colour + icon only. */
const TIER_STYLE: Record<string, string> = {
  'sup-fund': styles.fund,
  'sup-extras': styles.extras,
  'sup-voice': styles.voice,
}

// Every path below is authored symmetric about the centre of a 24x24 box, so
// the glyph sits centred in the pill. Eyeballed paths drift — the first cut of
// the chime star spanned y 2..16, i.e. 3px high, and read visibly off.

/** Chime — one clear note: a single four-point star, centred on (12,12). */
function ChimeIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3L13.8 10.2L21 12L13.8 13.8L12 21L10.2 13.8L3 12L10.2 10.2Z"
      />
    </svg>
  )
}

/** Chorus — many voices: a large star with a smaller one, the pair's combined
 *  bounds centred on (12,12). */
function ChorusIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.75 2.75L11.55 8.45L17.25 10.25L11.55 12.05L9.75 17.75L7.95 12.05L2.25 10.25L7.95 8.45ZM17.75 13.25L18.75 16.25L21.75 17.25L18.75 18.25L17.75 21.25L16.75 18.25L13.75 17.25L16.75 16.25Z"
      />
    </svg>
  )
}

/** Anthem — the song everyone sings: a crown, bounds centred on (12,12). */
function CrownIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 6l4 3.5L12 3l5 6.5L21 6l-1.8 11.5H4.8L3 6zm2.6 13.5h12.8V21H5.6v-1.5z"
      />
    </svg>
  )
}

/** Fallback for an unnamed grant. Bounds already centre on (12,12.2). */
function HeartIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      />
    </svg>
  )
}

const TIER_ICON: Record<string, () => JSX.Element> = {
  'sup-fund': ChimeIcon,
  'sup-extras': ChorusIcon,
  'sup-voice': CrownIcon,
}

export interface SupporterBadgeProps {
  /** Donation tier id, e.g. "sup-voice". Unknown / null → base styling. */
  planId: string | null
  /** Tier display name from the DB, e.g. "Voice". */
  label?: string | null
  expiresAt: string | null
  /** Longer form with the expiry inline, for the donate panel. */
  verbose?: boolean
}

export const SupporterBadge: Component<SupporterBadgeProps> = (props) => {
  // Object.hasOwn, not a bare index: planId comes from the DB, and a value like
  // "constructor" would otherwise resolve to a prototype member.
  const tierClass = (): string =>
    props.planId != null && Object.hasOwn(TIER_STYLE, props.planId)
      ? TIER_STYLE[props.planId]
      : ''
  // An accessor called from JSX, deliberately not a child component: Solid runs
  // a component body once, so the icon would keep the tier it was created with
  // while the label around it updated — visible when a donor upgrades from
  // Chime to Anthem without reloading.
  const tierIcon = (): JSX.Element => {
    const make =
      props.planId != null && Object.hasOwn(TIER_ICON, props.planId)
        ? TIER_ICON[props.planId]
        : HeartIcon
    return make()
  }
  // "Voice supporter"; a tier we can't name is still a supporter.
  const name = (): string => {
    const label = String(props.label ?? '').trim()
    return label !== '' ? `${label} supporter` : 'Supporter'
  }
  const until = (): string => formatSupporterExpiry(props.expiresAt)

  return (
    <Show
      when={props.verbose}
      fallback={
        <span
          class={`${styles.pill} ${tierClass()}`}
          data-testid="supporter-badge"
          data-tier={props.planId ?? 'unknown'}
          title={until() !== '' ? `${name()} until ${until()}` : name()}
        >
          {tierIcon()}
          {name()}
        </span>
      }
    >
      <p
        class={`${styles.note} ${tierClass()}`}
        data-testid="supporter-badge-verbose"
        data-tier={props.planId ?? 'unknown'}
      >
        <span class={`${styles.pill} ${tierClass()}`}>
          {tierIcon()}
          {name()}
        </span>
        <span>
          <Show when={until() !== ''} fallback="Thank you.">
            until {until()}. Thank you.
          </Show>
        </span>
      </p>
    </Show>
  )
}
