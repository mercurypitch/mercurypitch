// ============================================================
// Skeleton — Shimmer loading placeholders
// ============================================================

import type { Component } from 'solid-js'
import { For } from 'solid-js'
import styles from './Skeleton.module.css'

// ── Primitives ───────────────────────────────────────────────

export const SkeletonBlock: Component<{
  width?: string
  height?: string
  class?: string
}> = (props) => (
  <div
    class={[styles.skeleton, props.class ?? ''].join(' ')}
    style={{
      width: props.width ?? '100%',
      height: props.height ?? '14px',
      'border-radius': undefined,
    }}
  />
)

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

export const SkeletonChip: Component = () => (
  <div class={[styles.skeleton, styles.skeletonChip].join(' ')} />
)

export const SkeletonCircle: Component<{ size?: number }> = (props) => (
  <div
    class={[styles.skeleton, styles.skeletonCircle].join(' ')}
    style={{
      width: `${props.size ?? 32}px`,
      height: `${props.size ?? 32}px`,
    }}
  />
)

// ── Layouts ──────────────────────────────────────────────────

/** Full tab content: heading + text lines + card grid */
export const SkeletonTabContent: Component = () => (
  <div class={styles.skeletonTabContent}>
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
  <div class={styles.skeletonCardGrid}>
    <For each={Array.from({ length: props.count ?? 6 })}>
      {() => (
        <div class={[styles.skeleton, styles.skeletonCardItem].join(' ')} />
      )}
    </For>
  </div>
)

/** List rows for session history, melody list, leaderboard */
export const SkeletonList: Component<{ rows?: number }> = (props) => (
  <div class={styles.skeletonList}>
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

/** Stats panel for sidebar sections */
export const SkeletonSidebarSection: Component<{ items?: number }> = (
  props,
) => (
  <div class={styles.skeletonList} style="margin-top:10px">
    <SkeletonHeading />
    <For each={Array.from({ length: props.items ?? 3 })}>
      {() => (
        <div class={styles.skeletonStatRow}>
          <SkeletonText short />
          <SkeletonChip />
        </div>
      )}
    </For>
  </div>
)
