// ============================================================
// OptionsSheet — the standardized per-page practice-options sheet.
// ============================================================
//
// Decision D4: each mobile stage gets exactly ONE options sheet, built
// from the same section/row skeleton so every page feels identical.
// Pages inject their own rows; rows keep the 44px touch-target floor.
// Compose with <OptionSection> and <OptionRow>.

import type { Component, JSX } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import styles from './OptionsSheet.module.css'

interface OptionsSheetProps {
  isOpen: boolean
  close: () => void
  ariaLabel: string
  children: JSX.Element
}

export const OptionsSheet: Component<OptionsSheetProps> = (props) => (
  <Sheet
    isOpen={props.isOpen}
    close={() => props.close()}
    ariaLabel={props.ariaLabel}
  >
    {props.children}
  </Sheet>
)

interface OptionSectionProps {
  label: string
  children: JSX.Element
}

export const OptionSection: Component<OptionSectionProps> = (props) => (
  <section>
    <h3 class={styles.kicker}>{props.label}</h3>
    <div class={styles.rows}>{props.children}</div>
  </section>
)

interface OptionRowProps {
  label: string
  /** The control, rendered right-aligned. */
  children: JSX.Element
}

export const OptionRow: Component<OptionRowProps> = (props) => (
  <label class={styles.row}>
    <span class={styles.rowLabel}>{props.label}</span>
    <span class={styles.rowControl}>{props.children}</span>
  </label>
)
