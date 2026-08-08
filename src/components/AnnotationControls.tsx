// ============================================================
// AnnotationControls — Annotation management panel
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createSignal, For, onCleanup, Show } from 'solid-js'
import { scheduleAnnotationTones } from '@/lib/synth-annotation-playback'
import { exportAnnotationsCSV, importAnnotationsCSV, removeAnnotation, updateAnnotation, } from '@/stores/annotation-store'
import type { Annotation, AnnotationType } from '@/types'
import styles from './AnnotationControls.module.css'
import { Clock, ExportFile, ImportFile, Pencil, Play, SpeedGauge, Split, X, } from './icons'

interface AnnotationControlsProps {
  annotations: Annotation[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDeselectAll: () => void
}

export const AnnotationControls: Component<AnnotationControlsProps> = (
  props,
) => {
  const [filterType, setFilterType] = createSignal<AnnotationType | 'all'>(
    'all',
  )
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editLabel, setEditLabel] = createSignal('')

  const filtered = () => {
    const anns = props.annotations
    const ft = filterType()
    if (ft === 'all') return [...anns].sort((a, b) => a.time - b.time)
    return anns.filter((a) => a.type === ft).sort((a, b) => a.time - b.time)
  }

  const formatTime = (t: number): string => {
    const mins = Math.floor(t / 60)
    const secs = (t % 60).toFixed(1)
    return `${mins}:${secs.padStart(4, '0')}`
  }

  // The three annotation kinds as SVG marks (repo rule: no emoji, and no
  // glyph standing in for an icon). A time instant is a point on the clock,
  // a value is a reading off a meter, a region is a stretch bounded at both
  // ends — which is what Split's two blocks either side of a boundary draw.
  const typeIcon = (type: AnnotationType): JSX.Element => {
    if (type === 'instant') return <Clock />
    if (type === 'value') return <SpeedGauge />
    return <Split />
  }

  const handleExport = () => {
    const csv = exportAnnotationsCSV()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `annotations-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result as string
        importAnnotationsCSV(text)
      }
      reader.readAsText(file)
    }
    input.click()
  }

  // Reuse a single AudioContext across "Play Tones" clicks (browsers cap
  // concurrent contexts at ~6) and tear everything down on unmount.
  let toneCtx: AudioContext | null = null
  let toneTimer: ReturnType<typeof setTimeout> | null = null
  let toneStop: (() => void) | null = null

  const handlePlayTones = () => {
    const instants = props.annotations
      .filter((a) => a.type === 'instant')
      .map((a) => ({ time: a.time, label: a.label }))
    if (instants.length === 0) return

    // Cancel any in-flight playback before starting a new one.
    if (toneTimer !== null) clearTimeout(toneTimer)
    toneStop?.()

    if (toneCtx === null || toneCtx.state === 'closed') {
      toneCtx = new AudioContext()
    }
    const ctx = toneCtx
    void ctx.resume()
    toneStop = scheduleAnnotationTones(ctx, instants).stop

    // Annotation times are not guaranteed sorted — use the max.
    const lastTime = instants.reduce((max, i) => Math.max(max, i.time), 0)
    toneTimer = setTimeout(
      () => {
        toneStop?.()
        toneStop = null
        toneTimer = null
      },
      (lastTime + 1) * 1000,
    )
  }

  onCleanup(() => {
    if (toneTimer !== null) clearTimeout(toneTimer)
    toneStop?.()
    if (toneCtx !== null && toneCtx.state !== 'closed') void toneCtx.close()
  })

  const startEdit = (a: Annotation) => {
    setEditingId(a.id)
    setEditLabel(a.label ?? '')
  }

  const commitEdit = () => {
    const id = editingId()
    if (id === null) return
    updateAnnotation(id, { label: editLabel() || undefined })
    setEditingId(null)
  }

  return (
    <div class={styles.panel}>
      {/* Header */}
      <div class={styles.header}>
        <div class={styles.titleGroup}>
          <span class={styles.title}>Annotations</span>
          <span class={styles.count}>{props.annotations.length}</span>
        </div>
        <div class={styles.actions}>
          <button
            type="button"
            class={styles.actionBtn}
            onClick={handleImport}
            title="Import CSV"
          >
            <ImportFile />
            Import
          </button>
          <button
            type="button"
            class={styles.actionBtn}
            onClick={handleExport}
            title="Export CSV"
            disabled={props.annotations.length === 0}
          >
            <ExportFile />
            Export
          </button>
          <button
            type="button"
            class={`${styles.actionBtn} ${styles.toneBtn}`}
            onClick={handlePlayTones}
            title="Play reference tones at annotation times"
            disabled={
              props.annotations.filter((a) => a.type === 'instant').length === 0
            }
          >
            <Play />
            Play Tones
          </button>
        </div>
      </div>

      {/* Type filter */}
      <div
        class={styles.filters}
        role="group"
        aria-label="Filter annotations by type"
      >
        <For each={['all', 'instant', 'value', 'region'] as const}>
          {(t) => (
            <button
              type="button"
              class={styles.filterBtn}
              classList={{ [styles.filterActive]: filterType() === t }}
              aria-pressed={filterType() === t}
              onClick={() => setFilterType(t)}
            >
              {t === 'all' ? null : (
                <span class={styles.filterGlyph} aria-hidden="true">
                  {typeIcon(t)}
                </span>
              )}
              {t === 'all' ? 'All' : `${t}s`}
            </button>
          )}
        </For>
      </div>

      {/* Annotation list */}
      <div class={styles.list}>
        <Show
          when={filtered().length > 0}
          fallback={
            <div class={styles.empty}>
              <span class={styles.emptyGlyph} aria-hidden="true">
                <Pencil size={19} />
              </span>
              <h4 class={styles.emptyTitle}>No annotations</h4>
              <p class={styles.emptyBody}>
                Click on the canvas, or press{' '}
                <kbd class={styles.key}>Space</kbd> during playback, to drop
                one.
              </p>
            </div>
          }
        >
          <For each={filtered()}>
            {(a) => (
              <div
                class={styles.row}
                classList={{ [styles.rowSelected]: a.id === props.selectedId }}
                onClick={() => props.onSelect(a.id)}
              >
                <span class={styles.rowIcon} aria-hidden="true">
                  {typeIcon(a.type)}
                </span>
                <span class={styles.rowTime}>{formatTime(a.time)}</span>

                <Show
                  when={editingId() === a.id}
                  fallback={
                    <span class={styles.rowLabel}>
                      {a.label != null ? (
                        a.label
                      ) : (
                        <i class={styles.rowUnlabeled}>unlabeled</i>
                      )}
                    </span>
                  }
                >
                  <input
                    class={styles.rowInput}
                    value={editLabel()}
                    onInput={(e) => setEditLabel(e.currentTarget.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autofocus
                  />
                </Show>

                <button
                  type="button"
                  class={styles.rowBtn}
                  onClick={(e) => {
                    e.stopPropagation()
                    startEdit(a)
                  }}
                  title="Edit label"
                >
                  <Pencil />
                </button>
                <button
                  type="button"
                  class={`${styles.rowBtn} ${styles.rowBtnDanger}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (a.id === props.selectedId) props.onDeselectAll()
                    removeAnnotation(a.id)
                  }}
                  title="Delete"
                >
                  <X />
                </button>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  )
}
