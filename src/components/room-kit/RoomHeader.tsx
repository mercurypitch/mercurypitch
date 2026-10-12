// ============================================================
// The room's head: the timer, the chip, the result and Merc's line
// ============================================================
//
// The block above a premium room's stage. While a take runs it holds the
// big timer and one chip under it (the chip's words come from the room's
// pacer, chip-pacer.ts); at a result, the result card (the big number and
// one line under it, such as Long note's steadiness); otherwise Merc's line
// in a bubble. The room decides which shows when; each part takes its test
// id from the room, so a room's tests and markers keep its own names.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import styles from './RoomHeader.module.css'

export interface RoomHeaderProps {
  /** Out of reach while a demo has the room. */
  inert: boolean
  children: JSX.Element
}

export function RoomHeader(props: RoomHeaderProps): JSX.Element {
  return (
    <div class={styles.top} inert={props.inert}>
      {props.children}
    </div>
  )
}

export interface RoomTimerProps {
  testId?: string
  /** The time, and anything that sits beside it (a demo's 4x). */
  children: JSX.Element
}

export function RoomTimer(props: RoomTimerProps): JSX.Element {
  return (
    <div class={styles.timer} data-testid={props.testId}>
      {props.children}
    </div>
  )
}

export interface RoomChipProps {
  /** The chip's words; null or empty shows no chip, and the row keeps its place. */
  text: string | null
  testId: string
}

export function RoomChip(props: RoomChipProps): JSX.Element {
  return (
    <div class={styles.chipRow}>
      <Show when={props.text}>
        {(text) => (
          <span class={styles.chip} data-testid={props.testId}>
            {text()}
          </span>
        )}
      </Show>
    </div>
  )
}

export interface RoomBubbleProps {
  testId: string
  children: JSX.Element
}

/** Merc's line, between takes. */
export function RoomBubble(props: RoomBubbleProps): JSX.Element {
  return (
    <p class={styles.bubble} data-testid={props.testId}>
      {props.children}
    </p>
  )
}

export interface ResultCardProps {
  /** The big number ("9.4 s"). */
  value: string
  /** One line under it; null shows none. */
  detail: string | null
  testId: string
  detailTestId: string
}

/** A take's result: the big number, and one line under it. */
export function ResultCard(props: ResultCardProps): JSX.Element {
  return (
    <div class={styles.result} data-testid={props.testId}>
      <div class={styles.timer}>{props.value}</div>
      <Show when={props.detail}>
        {(detail) => (
          <div class={styles.detail} data-testid={props.detailTestId}>
            {detail()}
          </div>
        )}
      </Show>
    </div>
  )
}
