// ============================================================
// AdminWeeklyPage — owner-only weekly-challenge authoring (#/admin/weekly)
// ============================================================
// Unlocks with the X-Admin-Key (stored locally), lists every row, and
// creates/edits/deletes challenges. Targets are entered as note names
// ("G4 A4 B4") and converted to MelodyItem[]. A founder seed score can be set
// here (the "sing it to record" flow is a later polish). All writes go through
// the admin-gated /api/weekly endpoints.

import type { Component } from 'solid-js'
import { createResource, createSignal, For, Show } from 'solid-js'
import { showNotification } from '@/stores/notifications-store'
import type { MelodyItem } from '@/types'
import styles from './AdminWeeklyPage.module.css'
import type { WeeklyAdminRow } from './weekly-service'
import { createWeekly, deleteWeekly, getAdminKey, listAllWeekly, melodyItemsToNotes, notesToMelodyItems, plusOneWeekIso, setAdminKey, thisMondayUtcIso, updateWeekly, } from './weekly-service'

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

export const AdminWeeklyPage: Component<{ onClose: () => void }> = (props) => {
  const [key, setKey] = createSignal(getAdminKey())
  const [keyInput, setKeyInput] = createSignal(getAdminKey())
  const [form, setForm] = createSignal<FormState | null>(null)
  const [saving, setSaving] = createSignal(false)

  const [rows, { refetch }] = createResource(
    () => key(),
    (k) => (k !== '' ? listAllWeekly(k) : Promise.resolve(null)),
  )

  const unlocked = () => key() !== '' && rows() !== null && rows() !== undefined

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

  return (
    <div class={styles.overlay}>
      <div class={styles.panel}>
        <header class={styles.head}>
          <h2 class={styles.title}>Weekly Legend — Authoring</h2>
          <button
            class={styles.close}
            onClick={() => props.onClose()}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <Show
          when={unlocked()}
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
                              title="Retarget to the current week and set active"
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
            <div class={styles.form}>
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
              <label>
                Starts (ISO)
                <input
                  value={form()!.startsAt}
                  onInput={(e) => edit('startsAt', e.currentTarget.value)}
                />
              </label>
              <label>
                Ends (ISO)
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
            </div>
          </Show>
        </Show>
      </div>
    </div>
  )
}
