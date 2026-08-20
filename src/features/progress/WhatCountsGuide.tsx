// ============================================================
// What counts where — the guide, written once
// ============================================================
//
// Rendered in two places: the modal behind every "What counts here?" pill
// row, and the Learn chapter, which reads the same sentences out of
// `what-counts-copy` as markdown. Same words, so the explanation cannot
// drift between the place people meet it and the place they are sent to
// read it properly.
//
// The prose exists because the app genuinely has four different things that
// all feel like "a session", and one of them is not a run at all. Nobody
// should have to reverse-engineer that from a number.

import type { Component } from 'solid-js'
import { For } from 'solid-js'
import { RUN_KINDS } from './run-kinds'
import { WHAT_COUNTS_LEDE, WHAT_COUNTS_SECTIONS, WHAT_COUNTS_TITLE, } from './what-counts-copy'
import styles from './WhatCountsGuide.module.css'

const TONE_CLASS: Record<string, string> = {
  practice: styles.tonePractice,
  exercise: styles.toneExercise,
  challenge: styles.toneChallenge,
  weekly: styles.toneWeekly,
}

export const WhatCountsGuide: Component<{ headingId?: string }> = (props) => (
  <div class={styles.guide}>
    <h2 class={styles.title} id={props.headingId}>
      {WHAT_COUNTS_TITLE}
    </h2>

    <p class={styles.lede}>{WHAT_COUNTS_LEDE}</p>

    <ul class={styles.kindList}>
      <For each={RUN_KINDS}>
        {(meta) => (
          <li class={`${styles.kind} ${TONE_CLASS[meta.tone]}`}>
            <div class={styles.kindHead}>
              <span class={styles.swatch} aria-hidden="true" />
              <strong class={styles.kindName}>{meta.label}</strong>
              <span class={styles.rank}>
                {meta.ranked ? 'Ranked' : 'Not ranked'}
              </span>
            </div>
            <p class={styles.kindBlurb}>{meta.blurb}</p>
          </li>
        )}
      </For>
    </ul>

    <For each={WHAT_COUNTS_SECTIONS}>
      {(section) => (
        <div>
          <h3 class={styles.subTitle}>{section.heading}</h3>
          <p class={styles.body}>{section.body}</p>
        </div>
      )}
    </For>
  </div>
)
