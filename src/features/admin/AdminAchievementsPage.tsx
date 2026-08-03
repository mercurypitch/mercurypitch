import type { Component } from 'solid-js'
import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { iconByName, iconNames, renderIcon, } from '@/components/hidden-features-icons'
import { Plus, Trash2 } from '@/components/icons'
import type { Achievement, AchievementCategory } from '@/db/entities'
import { measurableAchievements } from '@/db/services/badge-grant-engine'
import { useConfirm } from '@/lib/use-confirm'
import { showNotification } from '@/stores/notifications-store'
import type { AchievementDraft } from './achievements-admin-service'
import { createAchievement, deleteAchievement, listAchievements, updateAchievement, } from './achievements-admin-service'
import styles from './AdminAchievementsPage.module.css'

interface AdminAchievementsPageProps {
  adminKey: string
  onDirtyChange?: (dirty: boolean) => void
}

const BANDS: ReadonlyArray<{
  id: AchievementCategory
  label: string
  blurb: string
}> = [
  {
    id: 'beginnings',
    label: 'Beginnings',
    blurb: 'First times — reachable in week one.',
  },
  {
    id: 'building',
    label: 'Building',
    blurb: 'The weekly rhythm — one should land most weeks.',
  },
  { id: 'mastery', label: 'Mastery', blurb: 'The long haul — months.' },
]

const blankDraft = (): AchievementDraft => ({
  name: '',
  description: '',
  icon: 'medal',
  points: 10,
  condition: '',
  required: 1,
  sortOrder: 0,
  category: 'beginnings',
})

/**
 * Read a number field without the `Number(v) || fallback` trap: 0 is falsy,
 * so that idiom rewrites a deliberately typed 0 into the fallback and the
 * save-time validation never sees the value the author actually entered.
 */
const numeric = (value: string, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toDraft = (row: Achievement): AchievementDraft => ({
  name: row.name,
  description: row.description,
  icon: row.icon,
  points: row.points,
  condition: row.condition,
  required: row.required,
  sortOrder: row.sortOrder,
  category: row.category ?? 'beginnings',
})

/**
 * Author the achievement definitions the Challenges page shows.
 *
 * The one thing this screen exists to prevent: an achievement the grant
 * engine cannot measure. Progress is computed by matching `name` against a
 * table in `badge-grant-engine.ts`, so a new row with a name that table does
 * not know renders perfectly and never unlocks for anyone — silently, with
 * no error anywhere. Every list row and the editor say so plainly, and the
 * engine's measurable names are offered as a datalist while typing.
 */
export const AdminAchievementsPage: Component<AdminAchievementsPageProps> = (
  props,
) => {
  const [rows, setRows] = createSignal<Achievement[]>([])
  const [loading, setLoading] = createSignal(true)
  const [loadFailed, setLoadFailed] = createSignal(false)
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [draft, setDraft] = createSignal<AchievementDraft>(blankDraft())
  const [open, setOpen] = createSignal(false)
  const [saving, setSaving] = createSignal(false)
  const [error, setError] = createSignal('')
  const deleteConfirm = useConfirm()

  const measurable = new Set(measurableAchievements())
  const icons = iconNames()

  const setDirty = (dirty: boolean): void => {
    props.onDirtyChange?.(dirty)
  }

  const field = <K extends keyof AchievementDraft>(
    key: K,
    value: AchievementDraft[K],
  ): void => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const refresh = async (): Promise<void> => {
    setLoading(true)
    const list = await listAchievements()
    setLoading(false)
    if (list === null) {
      setLoadFailed(true)
      return
    }
    setLoadFailed(false)
    setRows(list)
  }

  onMount(() => {
    void refresh()
  })

  const banded = createMemo(() =>
    BANDS.map((band) => ({
      ...band,
      items: rows().filter((r) => (r.category ?? 'beginnings') === band.id),
    })),
  )

  const unmeasured = createMemo(
    () => rows().filter((r) => !measurable.has(r.name)).length,
  )

  const startNew = (): void => {
    setEditingId(null)
    setDraft(blankDraft())
    setError('')
    setOpen(true)
    setDirty(false)
  }

  const startEdit = (row: Achievement): void => {
    setEditingId(row.id)
    setDraft(toDraft(row))
    setError('')
    setOpen(true)
    setDirty(false)
  }

  const cancel = (): void => {
    setOpen(false)
    setEditingId(null)
    setError('')
    setDirty(false)
  }

  const save = async (): Promise<void> => {
    const d = draft()
    if (d.name.trim() === '') {
      setError('A name is required — the grant engine matches on it.')
      return
    }
    if (d.required <= 0) {
      setError('Target must be at least 1, or progress divides by zero.')
      return
    }
    const clash = rows().some(
      (r) => r.name === d.name.trim() && r.id !== editingId(),
    )
    if (clash) {
      setError('Another achievement already uses that name.')
      return
    }

    setSaving(true)
    setError('')
    const payload: AchievementDraft = {
      ...d,
      name: d.name.trim(),
      description: d.description.trim(),
      condition: d.condition.trim(),
    }
    const id = editingId()
    const saved =
      id === null
        ? await createAchievement(props.adminKey, payload)
        : await updateAchievement(props.adminKey, id, payload)
    setSaving(false)

    if (saved === null) {
      setError(
        'The write was rejected. Check the admin key, then try again — nothing was changed.',
      )
      return
    }
    showNotification(
      id === null
        ? `Achievement created: ${payload.name}`
        : `Achievement saved: ${payload.name}`,
      'success',
    )
    setDirty(false)
    setOpen(false)
    setEditingId(null)
    await refresh()
  }

  const confirmDelete = (row: Achievement): void => {
    deleteConfirm.request({
      title: 'Delete this achievement?',
      message:
        `"${row.name}" disappears from every Challenges page. Anyone who ` +
        'already unlocked it keeps their record, but it will no longer show.',
      confirmLabel: 'Delete',
      onConfirm: () => {
        void (async () => {
          const ok = await deleteAchievement(props.adminKey, row.id)
          if (!ok) {
            showNotification('Could not delete that achievement.', 'error')
            return
          }
          if (editingId() === row.id) cancel()
          showNotification(`Deleted: ${row.name}`, 'info')
          await refresh()
        })()
      },
    })
  }

  return (
    <div class={styles.root} data-testid="admin-achievements">
      <div class={styles.toolbar}>
        <div>
          <strong>{rows().length} achievements</strong>
          <span>
            {banded()
              .map((b) => `${b.label} ${b.items.length}`)
              .join(' · ')}
          </span>
        </div>
        <button type="button" class={styles.addButton} onClick={startNew}>
          <Plus /> New achievement
        </button>
      </div>

      <Show when={unmeasured() > 0}>
        <p class={styles.warning}>
          <strong>
            {unmeasured()}{' '}
            {unmeasured() === 1 ? 'achievement has' : 'achievements have'} no
            measure
          </strong>
          They render on the Challenges page but can never unlock, because the
          grant engine has no rule matching their name. Rename them to a known
          measure, or add the rule in{' '}
          <code>src/db/services/badge-grant-engine.ts</code>.
        </p>
      </Show>

      <Show when={open()}>
        <form
          class={styles.editor}
          /* The min/max attributes still constrain the steppers, but native
             constraint validation must not own the submit: a browser silently
             refuses to submit an invalid form and shows an untranslatable
             bubble, which swallowed this page's own explanation of WHY a
             target below 1 is refused. One voice, ours. */
          novalidate
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <div class={styles.editorHeading}>
            <div>
              <span>{editingId() === null ? 'New' : 'Editing'}</span>
              <h3>
                {draft().name === '' ? 'Untitled achievement' : draft().name}
              </h3>
            </div>
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          </div>

          <div class={styles.grid}>
            <label class={styles.wide}>
              <span>Name</span>
              <input
                list="achievement-measures"
                value={draft().name}
                onInput={(e) => field('name', e.currentTarget.value)}
                placeholder="First Note"
              />
              <small
                classList={{
                  [styles.hintBad]: !measurable.has(draft().name.trim()),
                }}
              >
                {measurable.has(draft().name.trim())
                  ? 'The grant engine measures this name.'
                  : 'No measure for this name yet — it will never unlock.'}
              </small>
            </label>

            <label>
              <span>Band</span>
              <select
                value={draft().category}
                onChange={(e) =>
                  field(
                    'category',
                    e.currentTarget.value as AchievementCategory,
                  )
                }
              >
                <For each={BANDS}>
                  {(band) => <option value={band.id}>{band.label}</option>}
                </For>
              </select>
              <small>
                {BANDS.find((b) => b.id === draft().category)?.blurb}
              </small>
            </label>

            <label>
              <span>Icon</span>
              <div class={styles.iconRow}>
                <span class={styles.iconPreview} aria-hidden="true">
                  {renderIcon(iconByName(draft().icon))}
                </span>
                <select
                  value={draft().icon}
                  onChange={(e) => field('icon', e.currentTarget.value)}
                >
                  <For each={icons}>
                    {(name) => <option value={name}>{name}</option>}
                  </For>
                </select>
              </div>
            </label>

            <label class={styles.wide}>
              <span>Description</span>
              <input
                value={draft().description}
                onInput={(e) => field('description', e.currentTarget.value)}
                placeholder="Finish your first practice session"
              />
              <small>Shown under the name on the card.</small>
            </label>

            <label>
              <span>Target</span>
              <input
                type="number"
                min="1"
                value={draft().required}
                onInput={(e) =>
                  field('required', numeric(e.currentTarget.value, 1))
                }
              />
              <small>How many the measure must reach.</small>
            </label>

            <label>
              <span>Points</span>
              <input
                type="number"
                min="0"
                value={draft().points}
                onInput={(e) =>
                  field('points', numeric(e.currentTarget.value, 0))
                }
              />
            </label>

            <label>
              <span>Sort order</span>
              <input
                type="number"
                value={draft().sortOrder}
                onInput={(e) =>
                  field('sortOrder', numeric(e.currentTarget.value, 0))
                }
              />
              <small>Low first, within the band.</small>
            </label>

            <label class={styles.wide}>
              <span>Condition note</span>
              <input
                value={draft().condition}
                onInput={(e) => field('condition', e.currentTarget.value)}
                placeholder="sessions >= 1"
              />
              <small>
                Internal shorthand for the rule. Not shown to singers — the
                engine reads the name, not this.
              </small>
            </label>
          </div>

          <Show when={error() !== ''}>
            <p class={styles.actionError} role="alert">
              {error()}
            </p>
          </Show>

          <div class={styles.editorActions}>
            <button type="submit" class={styles.primary} disabled={saving()}>
              {saving()
                ? 'Saving…'
                : editingId() === null
                  ? 'Create achievement'
                  : 'Save changes'}
            </button>
          </div>
        </form>
      </Show>

      <datalist id="achievement-measures">
        <For each={measurableAchievements()}>
          {(name) => <option value={name} />}
        </For>
      </datalist>

      <Show when={loadFailed()}>
        <p class={styles.actionError}>
          Could not reach the content API. Achievements are stored in the cloud
          database, so this page needs it up.
        </p>
      </Show>

      <Show when={loading()}>
        <p class={styles.loading}>Loading achievements…</p>
      </Show>

      <For each={banded()}>
        {(band) => (
          <section class={styles.band}>
            <div class={styles.bandHead}>
              <h3>{band.label}</h3>
              <span>{band.items.length}</span>
              <small>{band.blurb}</small>
            </div>
            <Show
              when={band.items.length > 0}
              fallback={<p class={styles.bandEmpty}>Nothing in this band.</p>}
            >
              <ul class={styles.list}>
                <For each={band.items}>
                  {(row) => (
                    <li
                      class={styles.row}
                      classList={{
                        [styles.rowActive]: editingId() === row.id,
                        [styles.rowUnmeasured]: !measurable.has(row.name),
                      }}
                    >
                      <button
                        type="button"
                        class={styles.rowMain}
                        onClick={() => startEdit(row)}
                      >
                        <span class={styles.rowIcon} aria-hidden="true">
                          {renderIcon(iconByName(row.icon))}
                        </span>
                        <span class={styles.rowText}>
                          <strong>{row.name}</strong>
                          <small>{row.description}</small>
                        </span>
                        <span class={styles.rowMeta}>
                          <span>×{row.required}</span>
                          <span>{row.points} pts</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        class={styles.rowDelete}
                        onClick={() => confirmDelete(row)}
                        aria-label={`Delete ${row.name}`}
                        title={`Delete ${row.name}`}
                      >
                        <Trash2 />
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </section>
        )}
      </For>

      <ConfirmDialog
        open={deleteConfirm.pending() !== null}
        title={deleteConfirm.pending()?.title ?? ''}
        message={deleteConfirm.pending()?.message ?? ''}
        confirmLabel={deleteConfirm.pending()?.confirmLabel}
        onConfirm={deleteConfirm.accept}
        onCancel={deleteConfirm.cancel}
      />
    </div>
  )
}

export default AdminAchievementsPage
