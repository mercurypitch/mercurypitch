// ============================================================
// Skeleton — Shimmer loading placeholders
// ============================================================

import type { Component } from 'solid-js'
import { For } from 'solid-js'
import styles from './Skeleton.module.css'

// ── Common patterns ──────────────────────────────────────────

export const SkeletonText: Component<{ short?: boolean }> = (props) => (
  <div
    class={[
      styles.skeleton,
      props.short === true ? styles.skeletonTextShort : styles.skeletonText,
    ].join(' ')}
  />
)

export const SkeletonHeading: Component = () => (
  <div class={[styles.skeleton, styles.skeletonHeading].join(' ')} />
)

// ── Layouts ──────────────────────────────────────────────────
// These are used as Suspense fallbacks, so they are purely decorative —
// aria-hidden keeps assistive tech from announcing the placeholder boxes.

/** Full tab content: heading + text lines + card grid */
export const SkeletonTabContent: Component = () => (
  <div class={styles.skeletonTabContent} aria-hidden="true">
    <SkeletonHeading />
    <SkeletonText />
    <SkeletonText short />
    <div style="height: 12px" />
    <div class={styles.skeletonCardGrid}>
      <For each={[1, 2, 3, 4, 5, 6]}>
        {() => (
          <div class={[styles.skeleton, styles.skeletonCardItem].join(' ')} />
        )}
      </For>
    </div>
  </div>
)

/** Card grid for exercise library or community panels */
export const SkeletonCardGrid: Component<{ count?: number }> = (props) => (
  <div class={styles.skeletonCardGrid} aria-hidden="true">
    <For each={Array.from({ length: props.count ?? 6 })}>
      {() => (
        <div class={[styles.skeleton, styles.skeletonCardItem].join(' ')} />
      )}
    </For>
  </div>
)

/** List rows for session history, melody list, leaderboard */
export const SkeletonList: Component<{ rows?: number }> = (props) => (
  <div class={styles.skeletonList} aria-hidden="true">
    <For each={Array.from({ length: props.rows ?? 5 })}>
      {() => (
        <div class={[styles.skeleton, styles.skeletonListRow].join(' ')}>
          <div class={[styles.skeleton, styles.skeletonAvatar].join(' ')} />
          <div style="flex:1;display:flex;flex-direction:column;gap:6px">
            <SkeletonText />
            <SkeletonText short />
          </div>
        </div>
      )}
    </For>
  </div>
)
