// ============================================================
// CreditCoin — a credit, drawn as an amber token
// ============================================================
//
// The launch gift's art (onboarding's Keep beat and Map, Karaoke Night):
// a glossy amber sphere with a pale lower rim and a lilac light on its
// upper right, the token from the purchase mail's hero. Amber is the
// credits' colour and nothing else's, so the coin only ever means credits.
//
// `spent` draws a credit already used: the ring alone, no shine.
// Decoration only, always: whatever the coins count is said in words beside
// them.

import type { Component } from 'solid-js'
import styles from './CreditCoin.module.css'

export interface CreditCoinProps {
  /** Diameter in px. Default 40. */
  size?: number
  /** A credit already used: the ring alone. */
  spent?: boolean
  class?: string
}

export const CreditCoin: Component<CreditCoinProps> = (props) => (
  <span
    class={`${styles.coin} ${props.spent === true ? styles.spent : ''} ${props.class ?? ''}`}
    style={{ '--coin-size': `${props.size ?? 40}px` }}
    aria-hidden="true"
    data-coin={props.spent === true ? 'spent' : 'credit'}
  />
)

export default CreditCoin
