// ============================================================
// Paths, milestones and the league: where practice went, and what it earned
// ============================================================
//
// The paths are the record's route through the kinds of practice, the most
// recent marked by its filled lamp and said aloud, never by its colour
// alone. The milestones card shelves what has been earned, newest first;
// the whole cabinet, every badge and achievement with where the singer
// stands, opens from its row in a sheet, as the web lays it under the
// shelf. The league card opens the phone's own Leagues screen.
//
// A mark the app has no picture of wears the shell's cup: the shell's
// glyphs are the only ones the native app draws.

import type { JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import type { ProgressAchievementRowView, ProgressActionView, ProgressBadgeTileView, ProgressCabinetView, ProgressLeagueView, ProgressMilestoneView, ProgressPathsView, } from '@/features/progress/ProgressPage'
import { CheckIcon, ChevronIcon, LockIcon, PulseIcon, TrophyIcon, } from '../icons'
import { inAppAction, pathTag } from './progress-lines'
import { ActionRow, SheetTop, useSheetBack } from './progress-parts'

export function PathsCard(props: {
  paths: ProgressPathsView
  onAction?: (action: ProgressActionView) => void
}): JSX.Element {
  return (
    <section
      class="mp-prog-card"
      aria-labelledby="mp-prog-paths"
      data-testid="progress-paths"
    >
      <h2 class="mp-prog-eyebrow" id="mp-prog-paths">
        Practice paths
      </h2>
      <p class="mp-prog-card__lead">{props.paths.summary}</p>
      <Show when={props.paths.segments.length > 0}>
        <ol class="mp-prog-route">
          <For each={props.paths.segments}>
            {(segment) => (
              <li class="mp-prog-route__stop" data-status={segment.status}>
                <span class="mp-prog-route__mark" aria-hidden="true" />
                <div class="mp-prog-route__text">
                  <span class="mp-prog-route__name">
                    <b>{segment.label}</b>
                    <Show when={pathTag(segment.label, segment.source)}>
                      {(tag) => (
                        <span class="mp-prog-tag" data-source={segment.source}>
                          {tag()}
                        </span>
                      )}
                    </Show>
                    <Show when={segment.status === 'current'}>
                      <span class="mp-prog-sr">Most recent.</span>
                    </Show>
                  </span>
                  <span class="mp-prog-meta">{segment.detail}</span>
                </div>
              </li>
            )}
          </For>
        </ol>
      </Show>
      <Show when={inAppAction(props.paths.recommendation)}>
        {(action) => (
          <ActionRow
            action={action()}
            line={props.paths.recommendationReason}
            lead={<PulseIcon size={20} />}
            onAction={props.onAction}
          />
        )}
      </Show>
    </section>
  )
}

/** A mark's picture: its drawn medallion, or the shell's cup. */
function MarkArt(props: { artUrl?: string; size: number }): JSX.Element {
  return (
    <span class="mp-prog-mark-art" aria-hidden="true">
      <Show when={props.artUrl} fallback={<TrophyIcon size={props.size / 2} />}>
        {(src) => (
          <img
            src={src()}
            alt=""
            width={props.size}
            height={props.size}
            loading="lazy"
            decoding="async"
          />
        )}
      </Show>
    </span>
  )
}

function BadgeTile(props: { badge: ProgressBadgeTileView }): JSX.Element {
  return (
    <li
      class="mp-prog-cabinet-badge"
      data-earned={props.badge.earned ? 'on' : undefined}
      data-badge={props.badge.id}
    >
      <MarkArt artUrl={props.badge.artUrl} size={56} />
      <span class="mp-prog-cabinet-badge__name">{props.badge.title}</span>
      <span class="mp-prog-meta">{props.badge.tier}</span>
      <Show
        when={props.badge.earned}
        fallback={
          <span class="mp-prog-cabinet-badge__how">
            <LockIcon size={14} />
            {props.badge.howToEarn}
          </span>
        }
      >
        <span class="mp-prog-cabinet-badge__how" data-earned="on">
          <CheckIcon size={14} />
          {props.badge.earnedAtLabel ?? 'Earned'}
        </span>
      </Show>
    </li>
  )
}

function AchievementRow(props: {
  row: ProgressAchievementRowView
}): JSX.Element {
  return (
    <li
      class="mp-prog-goal"
      data-unlocked={props.row.unlocked ? 'on' : undefined}
      data-goal={props.row.id}
    >
      <span class="mp-prog-goal__icon" aria-hidden="true">
        {props.row.unlocked ? (
          <CheckIcon size={18} />
        ) : (
          <TrophyIcon size={18} />
        )}
      </span>
      <div class="mp-prog-goal__text">
        <span class="mp-prog-goal__head">
          <b>{props.row.title}</b>
          <Show when={props.row.unlocked}>
            <span class="mp-prog-meta">{props.row.pointsLabel}</span>
          </Show>
        </span>
        <span class="mp-prog-meta">{props.row.detail}</span>
        <span class="mp-prog-goal__bar">
          <span
            class="mp-prog-goal__track"
            role="progressbar"
            aria-label={`${props.row.title}: ${props.row.countLabel}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={props.row.percent}
          >
            <i style={{ width: `${props.row.percent}%` }} />
          </span>
          <span class="mp-prog-meta">{props.row.countLabel}</span>
        </span>
      </div>
    </li>
  )
}

/** Every badge and achievement, in a sheet over the page. */
function CabinetSheet(props: {
  open: boolean
  cabinet: ProgressCabinetView
  onClose: () => void
}): JSX.Element {
  useSheetBack(
    () => props.open,
    () => props.onClose(),
  )
  return (
    <Sheet
      isOpen={props.open}
      close={() => props.onClose()}
      ariaLabel="Badges and achievements"
      snap="tall"
      class="mp-prog-sheet"
    >
      <div class="mp-prog-cabinet" data-testid="progress-cabinet-sheet">
        <SheetTop
          eyebrow={props.cabinet.summary}
          title="Badges and achievements"
          titleId="mp-prog-cabinet-title"
          onClose={() => props.onClose()}
        />
        <Show
          when={props.cabinet.available}
          fallback={
            <p class="mp-prog-sheet__lead">
              Reconnect to load your badges and achievements. Nothing has been
              removed.
            </p>
          }
        >
          <h3 class="mp-prog-cabinet__group">
            Badges <span>{props.cabinet.badgesLabel}</span>
          </h3>
          <ul class="mp-prog-cabinet__badges">
            <For each={props.cabinet.badges}>
              {(badge) => <BadgeTile badge={badge} />}
            </For>
          </ul>
          <h3 class="mp-prog-cabinet__group">
            Achievements <span>{props.cabinet.achievementsLabel}</span>
          </h3>
          <For each={props.cabinet.shelves}>
            {(shelf) => (
              <section
                class="mp-prog-cabinet__shelf"
                aria-labelledby={`mp-prog-shelf-${shelf.id}`}
              >
                <h4 id={`mp-prog-shelf-${shelf.id}`}>
                  {shelf.title}{' '}
                  <span>
                    {shelf.unlockedCount} / {shelf.items.length}
                  </span>
                </h4>
                <p class="mp-prog-meta">{shelf.blurb}</p>
                <ul class="mp-prog-cabinet__goals">
                  <For each={shelf.items}>
                    {(row) => <AchievementRow row={row} />}
                  </For>
                </ul>
              </section>
            )}
          </For>
        </Show>
      </div>
    </Sheet>
  )
}

export interface MilestonesCardProps {
  milestones: readonly ProgressMilestoneView[]
  available?: boolean
  cabinet?: ProgressCabinetView
}

export function MilestonesCard(props: MilestonesCardProps): JSX.Element {
  const [cabinetOpen, setCabinetOpen] = createSignal(false)
  return (
    <section
      class="mp-prog-card"
      aria-labelledby="mp-prog-marks"
      data-testid="progress-milestones"
    >
      <div class="mp-prog-card__head">
        <h2 class="mp-prog-eyebrow" id="mp-prog-marks">
          Milestones
        </h2>
        <span class="mp-prog-meta">Earned, not estimated</span>
      </div>
      <Show
        when={props.available !== false}
        fallback={
          <p class="mp-prog-card__text">
            Earned marks are unavailable. Reconnect to load your saved badges
            and achievements. Nothing has been removed.
          </p>
        }
      >
        <Show
          when={props.milestones.length > 0}
          fallback={
            <p class="mp-prog-card__text">
              Your first earned mark will rest here. Milestones appear only
              after their real requirement is met.
            </p>
          }
        >
          <ul class="mp-prog-shelf" aria-label="Earned milestones" tabindex="0">
            <For each={props.milestones}>
              {(milestone) => (
                <li class="mp-prog-shelf__mark" data-milestone={milestone.id}>
                  <MarkArt artUrl={milestone.artUrl} size={64} />
                  <b class="mp-prog-shelf__name">{milestone.title}</b>
                  <span class="mp-prog-meta">{milestone.kindLabel}</span>
                  <span class="mp-prog-shelf__detail">{milestone.detail}</span>
                  <span class="mp-prog-meta">{milestone.earnedAtLabel}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>
      <Show when={props.cabinet}>
        {(cabinet) => (
          <>
            <button
              type="button"
              class="mp-prog-row"
              aria-haspopup="dialog"
              data-testid="progress-cabinet"
              onClick={() => setCabinetOpen(true)}
            >
              <span class="mp-prog-row__lead" aria-hidden="true">
                <TrophyIcon size={20} />
              </span>
              <span class="mp-prog-row__text">
                <span class="mp-prog-row__name">Badges and achievements</span>
                <span class="mp-prog-row__line">{cabinet().summary}</span>
              </span>
              <ChevronIcon class="mp-prog-row__chev" size={20} />
            </button>
            <CabinetSheet
              open={cabinetOpen()}
              cabinet={cabinet()}
              onClose={() => setCabinetOpen(false)}
            />
          </>
        )}
      </Show>
    </section>
  )
}

export function LeagueCard(props: {
  league: ProgressLeagueView
  onOpen: () => void
}): JSX.Element {
  const line = () =>
    [props.league.rankLabel, props.league.zoneLabel, props.league.periodLabel]
      .filter((part): part is string => part !== undefined && part !== '')
      .join(' · ')
  return (
    <button
      type="button"
      class="mp-prog-card mp-prog-league"
      data-testid="progress-league"
      onClick={() => props.onOpen()}
    >
      <span class="mp-prog-league__art" aria-hidden="true">
        <Show when={props.league.artUrl} fallback={<TrophyIcon size={22} />}>
          {(src) => (
            <img
              src={src()}
              alt=""
              width="44"
              height="44"
              loading="lazy"
              decoding="async"
            />
          )}
        </Show>
      </span>
      <span class="mp-prog-league__text">
        <span class="mp-prog-league__name">{props.league.title}</span>
        <span class="mp-prog-meta">{line()}</span>
      </span>
      <ChevronIcon class="mp-prog-row__chev" size={20} />
    </button>
  )
}
