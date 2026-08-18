// ============================================================
// AdminWeeklyPage — owner-only weekly-challenge authoring (#/admin/weekly)
// ============================================================
// Unlocks with the X-Admin-Key (stored locally), lists every row, and
// creates/edits/deletes challenges. Targets are entered as note names
// ("G4 A4 B4") and converted to MelodyItem[]. A founder seed score can be set
// here (the "sing it to record" flow is a later polish). All writes go through
// the admin-gated /api/weekly endpoints.

import type { Component } from 'solid-js'
import { createEffect, createResource, createSignal, For, onCleanup, Show, untrack, } from 'solid-js'
import { showNotification } from '@/stores/notifications-store'
import type { MelodyItem } from '@/types'
import styles from './AdminWeeklyPage.module.css'
import { CHALLENGE_PERIODS, DEFAULT_PERIOD_WEEKS, formatIsoWeek, reflowChanges, reflowQueue, reorder, shiftWeeks, weeksBetween, windowFrom, } from './challenge-window'
import type { WeeklyAdminRow } from './weekly-service'
import { createWeekly, deleteWeekly, getAdminKey, listAllWeekly, melodyItemsToNotes, notesToMelodyItems, plusOneWeekIso, setAdminKey, thisMondayUtcIso, updateWeekly, } from './weekly-service'

// Inline rather than from the icon set: the admin console does not import it,
// and a few 14px chevrons are not worth a new dependency edge.
//
// Functions, NOT shared JSX values. A module-level `const x = (<svg/>)` is one
// DOM node: rendering it twice does not copy it, it MOVES it — so inside a
// `<For>` only the last row kept its glyph and every earlier row rendered an
// empty circle. Each call has to build its own element.
const arrowLeft = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M15 5l-7 7 7 7"
    />
  </svg>
)

const arrowUp = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M5 15l7-7 7 7"
    />
  </svg>
)

const arrowDown = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M5 9l7 7 7-7"
    />
  </svg>
)

const gripGlyph = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path
      fill="currentColor"
      d="M9 5h2v2H9V5zm4 0h2v2h-2V5zM9 11h2v2H9v-2zm4 0h2v2h-2v-2zM9 17h2v2H9v-2zm4 0h2v2h-2v-2z"
    />
  </svg>
)

const arrowRight = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M9 5l7 7-7 7"
    />
  </svg>
)

const FEAT_TYPES = [
  'money-note',
  'sustain',
  'low-note',
  'range',
  'melisma-run',
  'register-jump',
  'vibrato',
  'belt-vs-falsetto',
]
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced']
const STATUSES = ['queued', 'active', 'closed']

interface FormState {
  id: string | null
  slug: string
  title: string
  description: string
  featType: string
  difficulty: string
  targetScore: number
  notes: string
  hearItUrl: string
  startsAt: string
  endsAt: string
  founderScore: string
  evergreen: boolean
  status: string
}

function blankForm(): FormState {
  const startsAt = thisMondayUtcIso()
  return {
    id: null,
    slug: '',
    title: '',
    description: '',
    featType: 'money-note',
    difficulty: 'intermediate',
    targetScore: 70,
    notes: '',
    hearItUrl: '',
    startsAt,
    endsAt: plusOneWeekIso(startsAt),
    founderScore: '',
    evergreen: true,
    status: 'active',
  }
}

function rowToForm(row: WeeklyAdminRow): FormState {
  let items: MelodyItem[] = []
  try {
    items = JSON.parse(row.targetItems) as MelodyItem[]
  } catch {
    items = []
  }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    featType: row.featType,
    difficulty: row.difficulty,
    targetScore: row.targetScore,
    notes: melodyItemsToNotes(items),
    hearItUrl: row.hearItUrl ?? '',
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    founderScore: row.founderScore !== null ? String(row.founderScore) : '',
    evergreen: row.evergreen === 1,
    status: row.status,
  }
}

/**
 * The genuinely live challenge is the one whose window covers *now* AND is
 * marked active — not merely one with status "active". Several rows can carry
 * status "active" at once; only ones passing this are actually on Home.
 */
function isLiveNow(row: WeeklyAdminRow): boolean {
  const now = Date.now()
  return (
    row.status === 'active' &&
    Date.parse(row.startsAt) <= now &&
    now < Date.parse(row.endsAt)
  )
}

interface AdminWeeklyPageProps {
  onClose?: () => void
  /** The Content Studio owns authentication when this is supplied. */
  adminKey?: string
  /** Removes the modal frame so the existing authoring UI can fill the studio. */
  embedded?: boolean
  class?: string
  onDirtyChange?: (dirty: boolean) => void
}

export const AdminWeeklyPage: Component<AdminWeeklyPageProps> = (props) => {
  // These frame/auth props are fixed for the lifetime of a mounted admin page.
  const suppliedAdminKey = untrack(() => props.adminKey)
  const embedded = untrack(() => props.embedded) === true
  const embeddedClass = untrack(() => props.class)
  const onClose = untrack(() => props.onClose)
  const onDirtyChange = untrack(() => props.onDirtyChange)
  const initialKey = suppliedAdminKey ?? getAdminKey()
  const [key, setKey] = createSignal(initialKey)
  const [keyInput, setKeyInput] = createSignal(initialKey)
  const [form, setForm] = createSignal<FormState | null>(null)
  const [saving, setSaving] = createSignal(false)

  createEffect(() => {
    onDirtyChange?.(form() !== null)
  })

  onCleanup(() => {
    onDirtyChange?.(false)
  })

  const [rows, { refetch }] = createResource(
    () => key(),
    (k) => (k !== '' ? listAllWeekly(k) : Promise.resolve(null)),
  )

  const unlocked = () => key() !== '' && rows() !== null && rows() !== undefined
  const studioOwnsAuth = suppliedAdminKey !== undefined

  function saveKey(): void {
    const k = keyInput().trim()
    setAdminKey(k)
    setKey(k)
  }

  function edit<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ): void {
    setForm((f) => (f ? { ...f, [field]: value } : f))
  }

  // ── The run window, in weeks ─────────────────────────────────
  // `startsAt`/`endsAt` remain the only stored truth; these just do the
  // arithmetic somebody was otherwise doing in their head.

  /** How many weeks the form currently describes. */
  const formWeeks = (): number => {
    const f = form()
    if (f === null) return 1
    return Math.max(1, weeksBetween(f.startsAt, f.endsAt))
  }

  /** Move the opening week, carrying the closing week with it. */
  function nudgeStart(weeks: number): void {
    const f = form()
    if (f === null) return
    const length = Math.max(1, weeksBetween(f.startsAt, f.endsAt))
    const next = windowFrom(shiftWeeks(f.startsAt, weeks), length)
    edit('startsAt', next.startsAt)
    edit('endsAt', next.endsAt)
  }

  /** Move the closing week alone, which is what changes the length. */
  function nudgeEnd(weeks: number): void {
    const f = form()
    if (f === null) return
    const proposed = shiftWeeks(f.endsAt, weeks)
    // One week is the floor: a window that closes before it opens is live
    // forever, because the `now < endsAt` guard fails the other way.
    const floor = shiftWeeks(f.startsAt, 1)
    edit('endsAt', Date.parse(proposed) < Date.parse(floor) ? floor : proposed)
  }

  /** Set the length outright, keeping the opening week. */
  function setPeriod(weeks: number): void {
    const f = form()
    if (f === null) return
    const next = windowFrom(f.startsAt, weeks)
    edit('startsAt', next.startsAt)
    edit('endsAt', next.endsAt)
  }

  async function save(): Promise<void> {
    const f = form()
    if (!f) return
    const items = notesToMelodyItems(f.notes)
    if (items.length === 0) {
      showNotification('Enter target notes, e.g. "G4 A4 B4"', 'error')
      return
    }
    if (f.slug.trim() === '' || f.title.trim() === '') {
      showNotification('Slug and title are required', 'error')
      return
    }
    const founder = f.founderScore.trim() === '' ? null : Number(f.founderScore)
    const payload: Record<string, unknown> = {
      slug: f.slug.trim(),
      title: f.title.trim(),
      description: f.description.trim(),
      featType: f.featType,
      difficulty: f.difficulty,
      targetScore: f.targetScore,
      targetItems: items,
      hearItUrl: f.hearItUrl.trim() === '' ? null : f.hearItUrl.trim(),
      startsAt: f.startsAt,
      endsAt: f.endsAt,
      founderScore: founder,
      evergreen: f.evergreen,
      status: f.status,
    }
    setSaving(true)
    let ok = false
    if (f.id !== null) {
      ok = await updateWeekly(f.id, payload, key())
    } else {
      const res = await createWeekly(payload, key())
      ok = 'id' in res
      if (!ok && 'error' in res) showNotification(res.error, 'error')
    }
    setSaving(false)
    if (ok) {
      showNotification(
        f.id !== null ? 'Challenge updated' : 'Challenge created',
        'success',
      )
      setForm(null)
      void refetch()
    }
  }

  async function remove(row: WeeklyAdminRow): Promise<void> {
    if (!confirm(`Delete "${row.title}"? This cannot be undone.`)) return
    const ok = await deleteWeekly(row.id, key())
    if (ok) {
      showNotification('Deleted', 'info')
      void refetch()
    } else {
      showNotification('Delete failed', 'error')
    }
  }

  /** Make this row THE live challenge: retarget to the current week + active. */
  async function setLive(row: WeeklyAdminRow): Promise<void> {
    const start = thisMondayUtcIso()
    const ok = await updateWeekly(
      row.id,
      { startsAt: start, endsAt: plusOneWeekIso(start), status: 'active' },
      key(),
    )
    if (ok) {
      showNotification(`"${row.title}" is live this week`, 'success')
      void refetch()
    } else {
      showNotification('Could not set it live — try again', 'error')
    }
  }

  // Live one(s) first, then most-recent window; flag when >1 is live at once.
  const sortedRows = (): WeeklyAdminRow[] =>
    [...(rows() ?? [])].sort(
      (a, b) =>
        Number(isLiveNow(b)) - Number(isLiveNow(a)) ||
        Date.parse(b.startsAt) - Date.parse(a.startsAt),
    )
  const liveCount = (): number => (rows() ?? []).filter(isLiveNow).length

  // ── The queue behind the live one ────────────────────────────
  //
  // Changing when the live challenge runs used to mean hand-editing every
  // challenge behind it, one ISO string at a time, in order, without leaving
  // a gap. The list's order IS its dates — it is sorted by `startsAt` — so
  // reordering and re-dating are the same operation.
  //
  // Nothing is written until the button is pressed. An automatic reflow on
  // every drag would move a live challenge out from under whoever is
  // attempting it, and would make an accidental drag destructive.

  const liveRow = (): WeeklyAdminRow | undefined =>
    (rows() ?? []).find(isLiveNow)

  /** Everything queued behind the live one, soonest first. */
  const queuedRows = (): WeeklyAdminRow[] =>
    (rows() ?? [])
      .filter((row) => !isLiveNow(row) && row.status !== 'closed')
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))

  const [draggedId, setDraggedId] = createSignal<string | null>(null)
  // Null means "no drag has happened" — the stored order is the order.
  const [queueOrder, setQueueOrder] = createSignal<string[] | null>(null)
  const [reflowing, setReflowing] = createSignal(false)
  const [queueWeeks, setQueueWeeks] = createSignal(DEFAULT_PERIOD_WEEKS)

  /** The queue in the order the admin has arranged it. */
  const arrangedQueue = (): WeeklyAdminRow[] => {
    const rowsById = new Map(queuedRows().map((row) => [row.id, row]))
    const order = queueOrder()
    if (order === null) return queuedRows()
    const arranged = order
      .map((id) => rowsById.get(id))
      .filter((row): row is WeeklyAdminRow => row !== undefined)
    // Anything added since the drag joins the end rather than vanishing.
    for (const row of queuedRows()) {
      if (!order.includes(row.id)) arranged.push(row)
    }
    return arranged
  }

  const queueDirty = (): boolean => {
    const order = queueOrder()
    if (order === null) return false
    const stored = queuedRows().map((row) => row.id)
    return (
      order.length !== stored.length || order.some((id, i) => id !== stored[i])
    )
  }

  function dropOn(targetId: string): void {
    const id = draggedId()
    setDraggedId(null)
    if (id === null || id === targetId) return
    const current = arrangedQueue().map((row) => row.id)
    setQueueOrder(reorder(current, id, current.indexOf(targetId)))
  }

  /** Re-date the queue behind the live challenge. Writes; asks first. */
  async function recomputeQueue(): Promise<void> {
    const live = liveRow()
    if (live === undefined) {
      showNotification(
        'Nothing is live — set a challenge live first, then recompute',
        'warning',
      )
      return
    }
    const order = arrangedQueue().map((row) => row.id)
    const planned = reflowQueue({
      liveEndsAt: live.endsAt,
      order,
      periodWeeks: queueWeeks(),
    })
    const stored = new Map(
      queuedRows().map((row) => [
        row.id,
        { startsAt: row.startsAt, endsAt: row.endsAt },
      ]),
    )
    const changes = reflowChanges(planned, stored)
    if (changes.length === 0) {
      showNotification('Every queued challenge is already in place', 'info')
      setQueueOrder(null)
      return
    }

    setReflowing(true)
    let written = 0
    for (const change of changes) {
      const ok = await updateWeekly(
        change.id,
        { startsAt: change.startsAt, endsAt: change.endsAt },
        key(),
      )
      if (ok) written += 1
      // Keep going: a partial reflow is recoverable by pressing it again,
      // whereas stopping at the first failure leaves a gap mid-queue.
    }
    setReflowing(false)
    setQueueOrder(null)
    void refetch()
    showNotification(
      written === changes.length
        ? `Re-dated ${written} challenge${written === 1 ? '' : 's'} after "${live.title}"`
        : `Re-dated ${written} of ${changes.length} — press again to finish`,
      written === changes.length ? 'success' : 'warning',
    )
  }

  return (
    <div
      class={embedded ? embeddedClass : styles.overlay}
      role={embedded ? 'region' : 'dialog'}
      aria-modal={embedded ? undefined : 'true'}
      aria-label={embedded ? 'Legend Attempt authoring' : undefined}
      aria-labelledby={embedded ? undefined : 'weekly-admin-title'}
    >
      <div class={embedded ? undefined : styles.panel}>
        <Show when={!embedded}>
          <header class={styles.head}>
            <h2 id="weekly-admin-title" class={styles.title}>
              Weekly Legend — Authoring
            </h2>
            <button
              class={styles.close}
              onClick={() => onClose?.()}
              aria-label="Close"
            >
              ×
            </button>
          </header>
        </Show>

        <Show
          when={unlocked()}
          fallback={
            <Show
              when={studioOwnsAuth}
              fallback={
                <div class={styles.unlock}>
                  <p>Enter the admin key to author weekly challenges.</p>
                  <Show when={key() !== '' && rows() === null}>
                    <p class={styles.err}>That key was rejected.</p>
                  </Show>
                  <div class={styles.unlockRow}>
                    <input
                      type="password"
                      placeholder="Admin key"
                      value={keyInput()}
                      onInput={(e) => setKeyInput(e.currentTarget.value)}
                    />
                    <button onClick={saveKey}>Unlock</button>
                  </div>
                </div>
              }
            >
              <div
                class={styles.unlock}
                role={rows.loading ? 'status' : 'alert'}
                aria-live="polite"
              >
                <p>
                  {rows.loading
                    ? 'Loading challenges…'
                    : 'Challenges could not be loaded. Change the admin key or try again.'}
                </p>
              </div>
            </Show>
          }
        >
          <Show
            when={form()}
            fallback={
              <div class={styles.body}>
                <div class={styles.toolbar}>
                  <button
                    class={styles.primary}
                    onClick={() => setForm(blankForm())}
                  >
                    New challenge
                  </button>
                  <button class={styles.linkBtn} onClick={() => void refetch()}>
                    Refresh
                  </button>
                </div>

                <p class={styles.hint}>
                  The live challenge is the one whose window covers today —
                  that's what shows on Home. "Status" is just the stored flag.
                </p>
                <Show when={liveCount() > 1}>
                  <p class={styles.warn}>
                    {liveCount()} challenges are live this week — only one shows
                    on Home. Reschedule or close the extras (Edit → Status).
                  </p>
                </Show>

                {/* ── The queue ───────────────────────────────────────
                    Drag to reorder, then press the button. Deliberately
                    manual: an automatic reflow would move a live challenge
                    out from under whoever is attempting it, and would make
                    a mis-drag destructive. */}
                <Show when={arrangedQueue().length > 0}>
                  <section class={styles.queue} data-testid="challenge-queue">
                    <header class={styles.queueHead}>
                      <h3>Queue</h3>
                      <span class={styles.hint}>
                        {liveRow() === undefined
                          ? 'Nothing is live — set one live to date the queue from it.'
                          : `Runs after "${liveRow()!.title}", back to back.`}
                      </span>
                    </header>

                    <ol class={styles.queueList}>
                      <For each={arrangedQueue()}>
                        {(row, index) => (
                          <li
                            class={styles.queueItem}
                            classList={{
                              [styles.queueDragging]: draggedId() === row.id,
                            }}
                            draggable={true}
                            data-testid={`queue-item-${row.id}`}
                            onDragStart={() => setDraggedId(row.id)}
                            onDragEnd={() => setDraggedId(null)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => dropOn(row.id)}
                          >
                            <span class={styles.queueGrip} aria-hidden="true">
                              {gripGlyph()}
                            </span>
                            <span class={styles.queuePos}>{index() + 1}</span>
                            <span class={styles.queueTitle}>{row.title}</span>
                            <span class={styles.queueWindow}>
                              {formatIsoWeek(row.startsAt)} →{' '}
                              {formatIsoWeek(row.endsAt)}
                            </span>
                            {/* Keyboard equivalent: a drag handle alone is
                                unreachable without a pointer. */}
                            <span class={styles.queueMove}>
                              <button
                                type="button"
                                aria-label={`Move ${row.title} earlier`}
                                data-testid={`queue-up-${row.id}`}
                                disabled={index() === 0}
                                onClick={() =>
                                  setQueueOrder(
                                    reorder(
                                      arrangedQueue().map((r) => r.id),
                                      row.id,
                                      index() - 1,
                                    ),
                                  )
                                }
                              >
                                {arrowUp()}
                              </button>
                              <button
                                type="button"
                                aria-label={`Move ${row.title} later`}
                                data-testid={`queue-down-${row.id}`}
                                disabled={
                                  index() === arrangedQueue().length - 1
                                }
                                onClick={() =>
                                  setQueueOrder(
                                    reorder(
                                      arrangedQueue().map((r) => r.id),
                                      row.id,
                                      index() + 1,
                                    ),
                                  )
                                }
                              >
                                {arrowDown()}
                              </button>
                            </span>
                          </li>
                        )}
                      </For>
                    </ol>

                    <div class={styles.queueActions}>
                      <span class={styles.windowLabel}>Each runs</span>
                      <For each={CHALLENGE_PERIODS}>
                        {(period) => (
                          <button
                            type="button"
                            class={styles.period}
                            classList={{
                              [styles.periodOn]: queueWeeks() === period.weeks,
                            }}
                            data-testid={`queue-period-${period.weeks}`}
                            onClick={() => setQueueWeeks(period.weeks)}
                          >
                            {period.label}
                          </button>
                        )}
                      </For>
                      <button
                        class={styles.primary}
                        disabled={reflowing() || liveRow() === undefined}
                        data-testid="queue-recompute"
                        onClick={() => void recomputeQueue()}
                      >
                        {reflowing() ? 'Re-dating…' : 'Recompute dates'}
                      </button>
                      <Show when={queueDirty()}>
                        <span class={styles.warn} data-testid="queue-dirty">
                          Order changed — nothing is saved until you recompute.
                        </span>
                      </Show>
                    </div>
                  </section>
                </Show>

                <ul class={styles.list}>
                  <For
                    each={sortedRows()}
                    fallback={<li class={styles.empty}>No challenges yet.</li>}
                  >
                    {(row) => (
                      <li
                        class={styles.row}
                        classList={{ [styles.rowLive]: isLiveNow(row) }}
                      >
                        <div class={styles.rowMain}>
                          <span class={styles.rowTitle}>
                            {row.title}
                            <Show when={isLiveNow(row)}>
                              <span class={styles.live}>Live now</span>
                            </Show>
                          </span>
                          <span class={styles.rowMeta}>
                            {row.featType} · {row.difficulty} · status:{' '}
                            <span
                              class={styles.status}
                              classList={{
                                [styles.statusActive]: row.status === 'active',
                                [styles.statusClosed]: row.status === 'closed',
                              }}
                            >
                              {row.status}
                            </span>
                            <Show when={row.founderScore !== null}>
                              {' '}
                              · founder {row.founderScore}%
                            </Show>
                          </span>
                          <span class={styles.rowWindow}>
                            {row.startsAt.slice(0, 10)} →{' '}
                            {row.endsAt.slice(0, 10)}
                          </span>
                        </div>
                        <div class={styles.rowActions}>
                          <Show when={!isLiveNow(row)}>
                            <button
                              class={styles.setLive}
                              onClick={() => void setLive(row)}
                              title="Retarget to the current period and set active"
                            >
                              Set live this week
                            </button>
                          </Show>
                          <button onClick={() => setForm(rowToForm(row))}>
                            Edit
                          </button>
                          <button
                            class={styles.danger}
                            onClick={() => void remove(row)}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            }
          >
            {/* ── Editor form ─────────────────────────────── */}
            <fieldset class={styles.form} disabled={saving()}>
              <label>
                Title
                <input
                  value={form()!.title}
                  onInput={(e) => edit('title', e.currentTarget.value)}
                />
              </label>
              <label>
                Slug (unique)
                <input
                  value={form()!.slug}
                  onInput={(e) => edit('slug', e.currentTarget.value)}
                />
              </label>
              <label class={styles.wide}>
                Description
                <textarea
                  rows="2"
                  value={form()!.description}
                  onInput={(e) => edit('description', e.currentTarget.value)}
                />
              </label>
              <label class={styles.wide}>
                Target notes (e.g. "G4 A4 B4 B4")
                <input
                  value={form()!.notes}
                  onInput={(e) => edit('notes', e.currentTarget.value)}
                  placeholder="Space or comma separated note names"
                />
              </label>
              <label>
                Feat type
                <select
                  value={form()!.featType}
                  onChange={(e) => edit('featType', e.currentTarget.value)}
                >
                  <For each={FEAT_TYPES}>
                    {(t) => <option value={t}>{t}</option>}
                  </For>
                </select>
              </label>
              <label>
                Difficulty
                <select
                  value={form()!.difficulty}
                  onChange={(e) => edit('difficulty', e.currentTarget.value)}
                >
                  <For each={DIFFICULTIES}>
                    {(d) => <option value={d}>{d}</option>}
                  </For>
                </select>
              </label>
              <label>
                Target score
                <input
                  type="number"
                  value={form()!.targetScore}
                  onInput={(e) =>
                    edit('targetScore', Number(e.currentTarget.value))
                  }
                />
              </label>
              <label>
                Founder score (optional)
                <input
                  type="number"
                  value={form()!.founderScore}
                  onInput={(e) => edit('founderScore', e.currentTarget.value)}
                  placeholder="e.g. 88"
                />
              </label>
              <label class={styles.wide}>
                Hear-it URL (official upload)
                <input
                  value={form()!.hearItUrl}
                  onInput={(e) => edit('hearItUrl', e.currentTarget.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
              </label>
              {/* ── When it runs ────────────────────────────────────
                  Two ISO strings used to mean doing the arithmetic in your
                  head. The model is still two ISO strings — there is no
                  period field anywhere, which is exactly why the run length
                  can change without a migration — but the form counts weeks
                  for you now. */}
              <div class={`${styles.wide} ${styles.window}`}>
                <div class={styles.windowRow}>
                  <span class={styles.windowLabel}>Opens</span>
                  <button
                    type="button"
                    class={styles.step}
                    aria-label="Move the opening week back"
                    data-testid="window-start-back"
                    onClick={() => nudgeStart(-1)}
                  >
                    {arrowLeft()}
                  </button>
                  <span class={styles.week} data-testid="window-start-week">
                    {formatIsoWeek(form()!.startsAt)}
                  </span>
                  <button
                    type="button"
                    class={styles.step}
                    aria-label="Move the opening week forward"
                    data-testid="window-start-forward"
                    onClick={() => nudgeStart(1)}
                  >
                    {arrowRight()}
                  </button>
                  <span class={styles.windowDate}>
                    {form()!.startsAt.slice(0, 10)}
                  </span>
                </div>

                <div class={styles.windowRow}>
                  <span class={styles.windowLabel}>Closes</span>
                  <button
                    type="button"
                    class={styles.step}
                    aria-label="Move the closing week back"
                    data-testid="window-end-back"
                    onClick={() => nudgeEnd(-1)}
                  >
                    {arrowLeft()}
                  </button>
                  <span class={styles.week} data-testid="window-end-week">
                    {formatIsoWeek(form()!.endsAt)}
                  </span>
                  <button
                    type="button"
                    class={styles.step}
                    aria-label="Move the closing week forward"
                    data-testid="window-end-forward"
                    onClick={() => nudgeEnd(1)}
                  >
                    {arrowRight()}
                  </button>
                  <span class={styles.windowDate}>
                    {form()!.endsAt.slice(0, 10)}
                  </span>
                </div>

                <div class={styles.windowRow}>
                  <span class={styles.windowLabel}>Runs for</span>
                  <For each={CHALLENGE_PERIODS}>
                    {(period) => (
                      <button
                        type="button"
                        class={styles.period}
                        classList={{
                          [styles.periodOn]: formWeeks() === period.weeks,
                        }}
                        data-testid={`window-period-${period.weeks}`}
                        onClick={() => setPeriod(period.weeks)}
                      >
                        {period.label}
                      </button>
                    )}
                  </For>
                  <span class={styles.windowDate} data-testid="window-length">
                    {formWeeks()} {formWeeks() === 1 ? 'week' : 'weeks'}
                  </span>
                </div>
              </div>

              <label>
                Opens (ISO)
                <input
                  value={form()!.startsAt}
                  onInput={(e) => edit('startsAt', e.currentTarget.value)}
                />
              </label>
              <label>
                Closes (ISO)
                <input
                  value={form()!.endsAt}
                  onInput={(e) => edit('endsAt', e.currentTarget.value)}
                />
              </label>
              <label>
                Status
                <select
                  value={form()!.status}
                  onChange={(e) => edit('status', e.currentTarget.value)}
                >
                  <For each={STATUSES}>
                    {(s) => <option value={s}>{s}</option>}
                  </For>
                </select>
              </label>
              <label class={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={form()!.evergreen}
                  onChange={(e) => edit('evergreen', e.currentTarget.checked)}
                />
                Evergreen (eligible for Encore weeks)
              </label>

              <div class={styles.formActions}>
                <button
                  class={styles.primary}
                  disabled={saving()}
                  onClick={() => void save()}
                >
                  {saving() ? 'Saving…' : 'Save'}
                </button>
                <button class={styles.linkBtn} onClick={() => setForm(null)}>
                  Cancel
                </button>
                <button
                  class={styles.linkBtn}
                  onClick={() => {
                    const start = thisMondayUtcIso()
                    edit('startsAt', start)
                    edit('endsAt', plusOneWeekIso(start))
                    showNotification(
                      'Dates set to this week — Save to apply',
                      'info',
                    )
                  }}
                >
                  Set dates to this week
                </button>
              </div>
            </fieldset>
          </Show>
        </Show>
      </div>
    </div>
  )
}
