// ============================================================
// AnnotationControls — Annotation management panel
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, Show } from 'solid-js'
import { scheduleAnnotationTones } from '@/lib/synth-annotation-playback'
import { exportAnnotationsCSV, importAnnotationsCSV, removeAnnotation, updateAnnotation, } from '@/stores/annotation-store'
import type { Annotation, AnnotationType } from '@/types'

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

  const typeIcon = (type: AnnotationType): string => {
    if (type === 'instant') return '📍'
    if (type === 'value') return '📊'
    return '📐'
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
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.95)',
        'border-radius': '8px',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '12px',
        display: 'flex',
        'flex-direction': 'column',
        gap: '8px',
        'max-height': '320px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          'justify-content': 'space-between',
          'align-items': 'center',
        }}
      >
        <span
          style={{
            color: 'rgba(255,255,255,0.8)',
            'font-size': '0.8rem',
            'font-weight': '600',
          }}
        >
          Annotations ({props.annotations.length})
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={handleImport}
            title="Import CSV"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              'font-size': '0.65rem',
              padding: '2px 8px',
              'border-radius': '4px',
              cursor: 'pointer',
            }}
          >
            Import
          </button>
          <button
            onClick={handleExport}
            title="Export CSV"
            disabled={props.annotations.length === 0}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              'font-size': '0.65rem',
              padding: '2px 8px',
              'border-radius': '4px',
              cursor: props.annotations.length ? 'pointer' : 'not-allowed',
              opacity: props.annotations.length ? 1 : 0.4,
            }}
          >
            Export
          </button>
          <button
            onClick={handlePlayTones}
            title="Play reference tones at annotation times"
            disabled={
              props.annotations.filter((a) => a.type === 'instant').length === 0
            }
            style={{
              background: 'rgba(63,185,80,0.1)',
              border: '1px solid rgba(63,185,80,0.25)',
              color: '#3fb950',
              'font-size': '0.65rem',
              padding: '2px 8px',
              'border-radius': '4px',
              cursor: props.annotations.filter((a) => a.type === 'instant')
                .length
                ? 'pointer'
                : 'not-allowed',
              opacity: props.annotations.filter((a) => a.type === 'instant')
                .length
                ? 1
                : 0.4,
            }}
          >
            Play Tones
          </button>
        </div>
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <For each={['all', 'instant', 'value', 'region'] as const}>
          {(t) => (
            <button
              onClick={() => setFilterType(t)}
              style={{
                background:
                  filterType() === t ? 'rgba(255,255,255,0.12)' : 'transparent',
                border: 'none',
                color: filterType() === t ? 'white' : 'rgba(255,255,255,0.4)',
                'font-size': '0.65rem',
                padding: '2px 8px',
                'border-radius': '4px',
                cursor: 'pointer',
              }}
            >
              {t === 'all' ? 'All' : `${typeIcon(t)} ${t}s`}
            </button>
          )}
        </For>
      </div>

      {/* Annotation list */}
      <div
        style={{
          overflow: 'auto',
          flex: 1,
          display: 'flex',
          'flex-direction': 'column',
          gap: '2px',
        }}
      >
        <Show
          when={filtered().length > 0}
          fallback={
            <span
              style={{
                color: 'rgba(255,255,255,0.3)',
                'font-size': '0.75rem',
                'text-align': 'center',
                padding: '12px',
              }}
            >
              No annotations. Click on the canvas or press Space during playback
              to add one.
            </span>
          }
        >
          <For each={filtered()}>
            {(a) => (
              <div
                onClick={() => props.onSelect(a.id)}
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '8px',
                  padding: '4px 8px',
                  'border-radius': '4px',
                  background:
                    a.id === props.selectedId
                      ? 'rgba(255,255,255,0.1)'
                      : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ 'font-size': '0.75rem' }}>
                  {typeIcon(a.type)}
                </span>
                <span
                  style={{
                    color: 'rgba(255,255,255,0.5)',
                    'font-size': '0.7rem',
                    'font-family': 'monospace',
                    'min-width': '48px',
                  }}
                >
                  {formatTime(a.time)}
                </span>

                <Show
                  when={editingId() === a.id}
                  fallback={
                    <span
                      style={{
                        color: 'rgba(255,255,255,0.8)',
                        'font-size': '0.75rem',
                        flex: 1,
                        overflow: 'hidden',
                        'text-overflow': 'ellipsis',
                        'white-space': 'nowrap',
                      }}
                    >
                      {a.label != null ? (
                        a.label
                      ) : (
                        <i style={{ color: 'rgba(255,255,255,0.3)' }}>
                          unlabeled
                        </i>
                      )}
                    </span>
                  }
                >
                  <input
                    value={editLabel()}
                    onInput={(e) => setEditLabel(e.currentTarget.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autofocus
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'white',
                      'font-size': '0.75rem',
                      padding: '2px 6px',
                      'border-radius': '3px',
                    }}
                  />
                </Show>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    startEdit(a)
                  }}
                  title="Edit label"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    'font-size': '0.7rem',
                    padding: '2px',
                  }}
                >
                  ✏
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (a.id === props.selectedId) props.onDeselectAll()
                    removeAnnotation(a.id)
                  }}
                  title="Delete"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    'font-size': '0.7rem',
                    padding: '2px',
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  )
}
