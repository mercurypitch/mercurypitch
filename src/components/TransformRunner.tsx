// ============================================================
// TransformRunner — Analysis transform launcher UI
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { getTransforms, registerBuiltinTransforms, } from '@/lib/transform-registry'
import type { TransformDescriptor } from '@/types'

export const TransformRunner: Component = () => {
  // Ensure transforms are registered
  registerBuiltinTransforms()

  const [search, setSearch] = createSignal('')
  const [activeCategory, setActiveCategory] = createSignal<string | null>(null)
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [isRunning, setIsRunning] = createSignal(false)

  const categories = createMemo(() => {
    const cats = new Set<string>()
    for (const t of getTransforms()) cats.add(t.category)
    return Array.from(cats).sort()
  })

  const filteredTransforms = createMemo(() => {
    let list = getTransforms()
    const cat = activeCategory()
    if (cat !== null) list = list.filter((t) => t.category === cat)
    const q = search().toLowerCase()
    if (q.length > 0) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      )
    }
    return list
  })

  const selected = createMemo(() => {
    const id = selectedId()
    if (id === null) return null
    return getTransforms().find((t) => t.id === id) ?? null
  })

  return (
    <div
      class="transform-runner"
      style={{
        padding: '12px',
        background: 'rgba(255,255,255,0.02)',
        'border-radius': '8px',
        border: '1px solid rgba(255,255,255,0.06)',
        'margin-top': '12px',
      }}
    >
      <h3
        style={{
          margin: '0 0 10px 0',
          'font-size': '0.85rem',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        🔌 Transform Plug-ins
      </h3>

      {/* Search + Category filter */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          'margin-bottom': '10px',
          'flex-wrap': 'wrap',
        }}
      >
        <input
          type="text"
          placeholder="Search transforms..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          style={{
            padding: '4px 8px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            'border-radius': '4px',
            color: '#fff',
            'font-size': '0.75rem',
            'min-width': '160px',
          }}
        />
        <For each={categories()}>
          {(cat) => (
            <button
              onClick={() =>
                setActiveCategory(activeCategory() === cat ? null : cat)
              }
              style={{
                padding: '4px 8px',
                'font-size': '0.65rem',
                'border-radius': '4px',
                cursor: 'pointer',
                background:
                  activeCategory() === cat
                    ? 'rgba(88,166,255,0.15)'
                    : 'rgba(255,255,255,0.05)',
                border:
                  activeCategory() === cat
                    ? '1px solid rgba(88,166,255,0.3)'
                    : '1px solid rgba(255,255,255,0.1)',
                color:
                  activeCategory() === cat
                    ? '#58a6ff'
                    : 'rgba(255,255,255,0.5)',
              }}
            >
              {cat}
            </button>
          )}
        </For>
      </div>

      {/* Transform list */}
      <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }}>
        <For each={filteredTransforms()}>
          {(t) => (
            <div
              onClick={() => setSelectedId(selectedId() === t.id ? null : t.id)}
              style={{
                flex: '1',
                'min-width': '180px',
                padding: '8px 10px',
                background:
                  selectedId() === t.id
                    ? 'rgba(88,166,255,0.1)'
                    : 'rgba(255,255,255,0.03)',
                border:
                  selectedId() === t.id
                    ? '1px solid rgba(88,166,255,0.25)'
                    : '1px solid rgba(255,255,255,0.08)',
                'border-radius': '6px',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  'font-size': '0.78rem',
                  color: 'rgba(255,255,255,0.7)',
                  'font-weight': '500',
                }}
              >
                {t.name}
              </div>
              <div
                style={{
                  'font-size': '0.65rem',
                  color: 'rgba(255,255,255,0.35)',
                  'margin-top': '2px',
                }}
              >
                {t.description.slice(0, 60)}
                {t.description.length > 60 ? '…' : ''}
              </div>
              <div
                style={{
                  'margin-top': '4px',
                  display: 'flex',
                  gap: '4px',
                  'flex-wrap': 'wrap',
                }}
              >
                <span
                  style={{
                    'font-size': '0.6rem',
                    padding: '1px 4px',
                    'border-radius': '3px',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  {t.category}
                </span>
                <span
                  style={{
                    'font-size': '0.6rem',
                    padding: '1px 4px',
                    'border-radius': '3px',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  v{t.version}
                </span>
                <Show when={t.minDuration !== undefined}>
                  <span
                    style={{
                      'font-size': '0.6rem',
                      padding: '1px 4px',
                      'border-radius': '3px',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.35)',
                    }}
                  >
                    min {t.minDuration}s
                  </span>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Selected transform details */}
      <Show when={selected()}>
        {(t: () => TransformDescriptor) => (
          <div
            style={{
              'margin-top': '10px',
              padding: '10px',
              background: 'rgba(88,166,255,0.05)',
              border: '1px solid rgba(88,166,255,0.15)',
              'border-radius': '6px',
            }}
          >
            <div
              style={{
                'font-size': '0.78rem',
                color: '#58a6ff',
                'font-weight': '500',
                'margin-bottom': '4px',
              }}
            >
              {t().name}
            </div>
            <div
              style={{
                'font-size': '0.7rem',
                color: 'rgba(255,255,255,0.45)',
                'margin-bottom': '6px',
              }}
            >
              {t().description}
            </div>
            <div
              style={{
                'font-size': '0.65rem',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              Outputs:{' '}
              {t()
                .outputs.map((o) => `${o.name} (${o.annotationType})`)
                .join(', ')}
            </div>
            <Show when={(t().parameters?.length ?? 0) > 0}>
              <div
                style={{
                  'margin-top': '4px',
                  'font-size': '0.65rem',
                  color: 'rgba(255,255,255,0.35)',
                }}
              >
                Parameters:{' '}
                {t()
                  .parameters?.map((p) => `${p.label} (${p.type})`)
                  .join(', ') ?? ''}
              </div>
            </Show>
            <button
              onClick={() => {
                setIsRunning(true)
                setTimeout(() => setIsRunning(false), 1000)
              }}
              disabled={isRunning()}
              style={{
                'margin-top': '8px',
                padding: '4px 12px',
                background: isRunning()
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(88,166,255,0.15)',
                border: isRunning()
                  ? '1px solid rgba(255,255,255,0.1)'
                  : '1px solid rgba(88,166,255,0.3)',
                color: isRunning() ? 'rgba(255,255,255,0.3)' : '#58a6ff',
                'font-size': '0.72rem',
                'border-radius': '4px',
                cursor: isRunning() ? 'not-allowed' : 'pointer',
              }}
            >
              {isRunning() ? 'Running…' : `Run ${t().name}`}
            </button>
          </div>
        )}
      </Show>
    </div>
  )
}
