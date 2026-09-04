// ============================================================
// ProgressCabinet — every badge and achievement, and where you stand on each
// ============================================================
// The Milestones shelf above it shows what has been earned. This is the whole
// catalogue, earned or not, so the next mark is always in view. Pure display,
// like the rest of the page: the view-model decides labels, grouping and art,
// and this renders them.
//
// It moved here from the Challenges tab, where it sat under the practice
// drills. A badge is a record of what practice earned, and Progress is the
// record.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { IconBadge, iconByName, IconCheckSolid, IconStarChallenge, renderIcon, } from '@/components/hidden-features-icons'
import { InfoPopover } from '@/components/InfoPopover'
import styles from './ProgressCabinet.module.css'
import type { ProgressAchievementRowView, ProgressAchievementShelfView, ProgressBadgeTileView, ProgressCabinetView, } from './ProgressPage'

interface ProgressCabinetProps {
  cabinet: ProgressCabinetView
}

const BadgeTile: Component<{ badge: ProgressBadgeTileView }> = (props) => (
  <li
    class={styles.badge}
    classList={{
      [styles.badgeEarned]: props.badge.earned,
      [styles.badgeLocked]: !props.badge.earned,
    }}
    data-testid={`cabinet-badge-${props.badge.id}`}
  >
    <div class={styles.badgeArt}>
      <Show
        when={props.badge.artUrl}
        fallback={
          <span class={styles.badgeGlyph} aria-hidden="true">
            {renderIcon(iconByName(props.badge.icon))}
          </span>
        }
      >
        {(src) => (
          <img
            src={src()}
            width="192"
            height="192"
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
      </Show>
    </div>

    <Show when={props.badge.earned}>
      <span class={styles.badgeCheck} title="Earned">
        <IconCheckSolid />
      </span>
    </Show>

    {/* Only the 'i' opens it. A hover on the whole tile fires on every pass
        of the mouse across the grid, which is noise rather than help. */}
    <InfoPopover
      class={styles.badgeHint}
      label={`How to earn ${props.badge.title}`}
    >
      {props.badge.howToEarn}
      <Show when={props.badge.earnedAtLabel}>
        {(label) => <span class={styles.badgeHintEarned}>{label()}</span>}
      </Show>
    </InfoPopover>

    <div class={styles.badgeStrip}>
      <span class={styles.badgeName}>{props.badge.title}</span>
      <span class={styles.badgeTier}>{props.badge.tier}</span>
    </div>
  </li>
)

const AchievementRow: Component<{ row: ProgressAchievementRowView }> = (
  props,
) => (
  <li
    class={styles.row}
    classList={{ [styles.rowUnlocked]: props.row.unlocked }}
    data-testid={`cabinet-achievement-${props.row.id}`}
  >
    <span class={styles.rowIcon} aria-hidden="true">
      {renderIcon(iconByName(props.row.icon))}
    </span>
    <div class={styles.rowBody}>
      <div class={styles.rowHead}>
        <span class={styles.rowName}>{props.row.title}</span>
        <Show when={props.row.unlocked}>
          <span class={styles.rowPoints}>{props.row.pointsLabel}</span>
        </Show>
      </div>
      <p class={styles.rowDetail}>{props.row.detail}</p>
      <div
        class={styles.rowProgress}
        role="progressbar"
        aria-label={`${props.row.title}: ${props.row.countLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={props.row.percent}
      >
        <span class={styles.rowCount}>{props.row.countLabel}</span>
        <span class={styles.rowTrack}>
          <span
            class={styles.rowFill}
            style={{ width: `${props.row.percent}%` }}
          />
        </span>
      </div>
    </div>
    <Show when={props.row.unlocked}>
      <span class={styles.rowDone} title="Unlocked">
        <IconCheckSolid />
      </span>
    </Show>
  </li>
)

const Shelf: Component<{ shelf: ProgressAchievementShelfView }> = (props) => (
  <section
    class={styles.shelf}
    aria-labelledby={`cabinet-shelf-${props.shelf.id}`}
  >
    <div class={styles.shelfHead}>
      <h4 id={`cabinet-shelf-${props.shelf.id}`}>{props.shelf.title}</h4>
      <span class={styles.shelfCount}>
        {props.shelf.unlockedCount} / {props.shelf.items.length}
      </span>
    </div>
    <p class={styles.shelfBlurb}>{props.shelf.blurb}</p>
    <ul class={styles.rows}>
      <For each={props.shelf.items}>
        {(row) => <AchievementRow row={row} />}
      </For>
    </ul>
  </section>
)

export const ProgressCabinet: Component<ProgressCabinetProps> = (props) => (
  <section
    class={styles.chapter}
    aria-labelledby="cabinet-title"
    data-testid="progress-cabinet"
  >
    <div class={styles.header}>
      <div>
        <span>Earned, and still to earn</span>
        <h2 id="cabinet-title">Badges and achievements</h2>
      </div>
      <p class={styles.summary}>{props.cabinet.summary}</p>
    </div>

    <Show
      when={props.cabinet.available}
      fallback={
        <p class={styles.unavailable}>
          Reconnect to load your badges and achievements. Nothing has been
          removed.
        </p>
      }
    >
      <div class={styles.group}>
        <h3 class={styles.groupTitle}>
          <IconBadge />
          <span>Badges</span>
          <span class={styles.groupCount}>{props.cabinet.badgesLabel}</span>
        </h3>
        <ul class={styles.badgeGrid} aria-label="Badges">
          <For each={props.cabinet.badges}>
            {(badge) => <BadgeTile badge={badge} />}
          </For>
        </ul>
      </div>

      <div class={styles.group}>
        <h3 class={styles.groupTitle}>
          <IconStarChallenge />
          <span>Achievements</span>
          <span class={styles.groupCount}>
            {props.cabinet.achievementsLabel}
          </span>
        </h3>
        <For each={props.cabinet.shelves}>
          {(shelf) => <Shelf shelf={shelf} />}
        </For>
      </div>
    </Show>
  </section>
)
