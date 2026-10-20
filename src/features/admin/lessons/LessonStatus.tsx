// ============================================================
// LessonStatus — the Lessons page's state marks: an icon, and the words beside it
// ============================================================
//
// One mark for every state the page shows, a step's or a lesson's, so the
// table, the cards and the publishing controls read alike. The icon only
// colours what the words already say.

import type { JSX } from 'solid-js'
import { Match, Switch } from 'solid-js'
import { AlertTriangle, CheckCircle, HelpCircle, Info, } from '@/components/icons'
import type { StepState } from './lesson-admin'
import styles from './LessonStatus.module.css'

/** How a cell or a step reads at a glance: a step's state, or nothing to say. */
export type Tone = StepState | 'none'

/** The icon for a tone; the words beside it carry the meaning. */
export function ToneIcon(props: { tone: Tone; class?: string }): JSX.Element {
  return (
    <span
      class={
        props.class === undefined
          ? styles.icon
          : `${styles.icon} ${props.class}`
      }
      data-tone={props.tone}
      aria-hidden="true"
    >
      <Switch>
        <Match when={props.tone === 'done'}>
          <CheckCircle />
        </Match>
        <Match when={props.tone === 'todo' || props.tone === 'checking'}>
          <span class={styles.ring} />
        </Match>
        <Match when={props.tone === 'by-hand'}>
          <Info size={14} />
        </Match>
        <Match when={props.tone === 'unknown'}>
          <HelpCircle size={14} />
        </Match>
        <Match when={props.tone === 'problem'}>
          <AlertTriangle />
        </Match>
      </Switch>
    </span>
  )
}

export function Status(props: {
  tone: Tone
  children: JSX.Element
}): JSX.Element {
  return (
    <span class={styles.status} data-tone={props.tone}>
      <ToneIcon tone={props.tone} />
      <span>{props.children}</span>
    </span>
  )
}
