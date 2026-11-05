// ============================================================
// History and coverage: the record behind the story, and where it is kept
// ============================================================
//
// The filters are the record's own (buildHistory): a chip asks the record
// to filter (onHistoryFilterChange) and the list is the snapshot it hands
// back, as on the web, so the two pages can never disagree on what a
// filter keeps. Each row says what was recorded, how it went and where it
// is kept, under its date, and leads to the practice it came from. The
// coverage note closes the page: whose record this is, how much of it was
// read, and the way to keep it with an account.

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { ProgressActionView, ProgressCoverageView, ProgressHistoryItemView, ProgressHistoryView, } from '@/features/progress/ProgressPage'
import { ChevronIcon, CloudIcon, InfoIcon, PhoneIcon } from '../icons'
import { historyDays, historyLine, historyWhere, inAppAction, sourceWord, } from './progress-lines'
import { SourceIcon } from './progress-parts'

function HistoryRow(props: {
  item: ProgressHistoryItemView
  onAction?: (action: ProgressActionView) => void
}): JSX.Element {
  const action = () => inAppAction(props.item.action)
  const body = (): JSX.Element => (
    <>
      <span
        class="mp-prog-item__icon"
        data-source={props.item.source}
        aria-hidden="true"
      >
        <SourceIcon source={props.item.source} size={22} />
      </span>
      <span class="mp-prog-item__text">
        <span class="mp-prog-item__title">{props.item.title}</span>
        <span class="mp-prog-meta">
          <span class="mp-prog-sr">{sourceWord(props.item.source)}: </span>
          {historyLine(props.item)}
        </span>
        <span class="mp-prog-meta mp-prog-item__where">
          {props.item.storageLabel === 'On this device' ? (
            <PhoneIcon size={14} />
          ) : (
            <CloudIcon size={14} />
          )}
          <span>{historyWhere(props.item)}</span>
        </span>
      </span>
      <Show when={action()}>
        {(next) => (
          <>
            <span class="mp-prog-sr">, {next().label}</span>
            <ChevronIcon class="mp-prog-row__chev" size={20} />
          </>
        )}
      </Show>
    </>
  )
  return (
    <Show
      when={action()?.href}
      fallback={
        <div class="mp-prog-item" data-history={props.item.id}>
          {body()}
        </div>
      }
    >
      {(href) => (
        <a
          class="mp-prog-item"
          href={href()}
          data-history={props.item.id}
          onClick={() => {
            const next = action()
            if (next !== undefined) props.onAction?.(next)
          }}
        >
          {body()}
        </a>
      )}
    </Show>
  )
}

export function HistorySection(props: {
  history: ProgressHistoryView
  onFilter?: (filterId: string) => void
  onAction?: (action: ProgressActionView) => void
}): JSX.Element {
  return (
    <section
      class="mp-prog-history"
      aria-labelledby="mp-prog-history"
      data-testid="progress-history"
    >
      <h2 class="mp-prog-history__title" id="mp-prog-history">
        History
      </h2>
      <p class="mp-prog-meta">{props.history.summary}</p>
      <div class="mp-prog-filters" role="group" aria-label="Filter history">
        <For each={props.history.filters}>
          {(filter) => (
            <button
              type="button"
              class="mp-prog-filter"
              data-filter={filter.id}
              aria-pressed={filter.id === props.history.activeFilterId}
              onClick={() => props.onFilter?.(filter.id)}
            >
              {filter.label}
            </button>
          )}
        </For>
      </div>
      <Show
        when={props.history.items.length > 0}
        fallback={
          <p class="mp-prog-history__none" role="status">
            No recorded practice matches this filter.
          </p>
        }
      >
        <For each={historyDays(props.history.items)}>
          {(day) => (
            <div class="mp-prog-day">
              <h3 class="mp-prog-day__label">{day.label}</h3>
              <ul class="mp-prog-day__items">
                <For each={day.items}>
                  {(item) => (
                    <li>
                      <HistoryRow item={item} onAction={props.onAction} />
                    </li>
                  )}
                </For>
              </ul>
            </div>
          )}
        </For>
      </Show>
    </section>
  )
}

export function CoverageNote(props: {
  coverage: ProgressCoverageView
  periodContext: string
  onAction?: (action: ProgressActionView) => void
}): JSX.Element {
  return (
    <div
      class="mp-prog-coverage"
      data-coverage={props.coverage.status}
      data-testid="progress-coverage"
    >
      <InfoIcon size={18} />
      <div class="mp-prog-coverage__text">
        <p>
          <b>{props.coverage.scopeLabel}</b> · {props.periodContext}
        </p>
        <p>{props.coverage.detail}</p>
        <Show when={props.coverage.boundaryLabel}>
          {(boundary) => <p>{boundary()}</p>}
        </Show>
        <Show when={inAppAction(props.coverage.continuityAction)}>
          {(action) => (
            <Show
              when={action().href}
              fallback={
                <button
                  type="button"
                  class="mp-prog-link"
                  onClick={() => props.onAction?.(action())}
                >
                  {action().label}
                </button>
              }
            >
              {(href) => (
                <a
                  class="mp-prog-link"
                  href={href()}
                  onClick={() => props.onAction?.(action())}
                >
                  {action().label}
                </a>
              )}
            </Show>
          )}
        </Show>
      </div>
    </div>
  )
}
