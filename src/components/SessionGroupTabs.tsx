// ============================================================
// SessionGroupTabs — Horizontal pill tab bar for session groups
// ============================================================

import type { Component, Setter } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import type { SessionGroupRecord } from '@/db'
import { createGroup, deleteGroup, getGroupsReactive, renameGroup, } from '@/stores/app-store'
import { FilePlus, Trash2, X } from './icons'

// Inline SVGs for icons not in the shared icon set
const CheckIcon: Component<{ size?: number }> = (p) => (
  <svg
    width={p.size ?? 14}
    height={p.size ?? 14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const PencilIcon: Component<{ size?: number }> = (p) => (
  <svg
    width={p.size ?? 14}
    height={p.size ?? 14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
)

interface SessionGroupTabsProps {
  activeGroupId: string | null
  onSelectGroup: Setter<string | null>
}

export const SessionGroupTabs: Component<SessionGroupTabsProps> = (props) => {
  const groups = () => getGroupsReactive()
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editName, setEditName] = createSignal('')
  const [contextGroupId, setContextGroupId] = createSignal<string | null>(null)

  let addInputRef: HTMLInputElement | undefined
  let editInputRef: HTMLInputElement | undefined

  const handleCreate = () => {
    const name = editName().trim()
    if (!name) return
    void createGroup(name).then(() => {
      setEditName('')
    })
  }

  const handleRename = (groupId: string) => {
    const name = editName().trim()
    if (!name) {
      setEditingId(null)
      return
    }
    void renameGroup(groupId, name).then(() => {
      setEditingId(null)
      setEditName('')
    })
  }

  const handleDelete = (groupId: string) => {
    void deleteGroup(groupId)
    setContextGroupId(null)
    if (props.activeGroupId === groupId) {
      props.onSelectGroup(null)
    }
  }

  const startRename = (group: SessionGroupRecord) => {
    setEditingId(group.id)
    setEditName(group.name)
    setTimeout(() => editInputRef?.focus(), 0)
  }

  return (
    <div class="session-group-tabs" onContextMenu={(e) => e.preventDefault()}>
      {/* "All" tab */}
      <button
        class="session-group-tab"
        classList={{
          'session-group-tab--active': props.activeGroupId === null,
        }}
        onClick={() => props.onSelectGroup(null)}
        data-testid="group-tab-all"
      >
        All
      </button>

      <For each={groups()}>
        {(group) => (
          <div
            class="session-group-tab-wrapper"
            style={{ position: 'relative' }}
          >
            <Show
              when={editingId() === group.id}
              fallback={
                <button
                  class="session-group-tab"
                  classList={{
                    'session-group-tab--active':
                      props.activeGroupId === group.id,
                  }}
                  onClick={() => props.onSelectGroup(group.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextGroupId(group.id)
                  }}
                  data-testid={`group-tab-${group.id}`}
                >
                  {group.name}
                  <span class="session-group-tab-count">
                    {group.sessionIds.length}
                  </span>
                </button>
              }
            >
              <div class="session-group-tab-edit">
                <input
                  ref={editInputRef}
                  type="text"
                  class="session-group-tab-edit-input"
                  value={editName()}
                  onInput={(e) => setEditName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(group.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
                <button
                  class="session-group-tab-edit-btn"
                  onClick={() => handleRename(group.id)}
                >
                  <CheckIcon />
                </button>
                <button
                  class="session-group-tab-edit-btn"
                  onClick={() => setEditingId(null)}
                >
                  <X />
                </button>
              </div>
            </Show>

            {/* Context menu */}
            <Show when={contextGroupId() === group.id}>
              <div
                class="session-group-context-menu"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  class="session-group-context-item"
                  onClick={() => {
                    setContextGroupId(null)
                    startRename(group)
                  }}
                >
                  <PencilIcon /> Rename
                </button>
                <button
                  class="session-group-context-item session-group-context-item--danger"
                  onClick={() => handleDelete(group.id)}
                >
                  <Trash2 /> Delete
                </button>
              </div>
              <div
                class="session-group-context-backdrop"
                onClick={() => setContextGroupId(null)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextGroupId(null)
                }}
              />
            </Show>
          </div>
        )}
      </For>

      {/* Add group button / input */}
      <Show
        when={editingId() === '__new__'}
        fallback={
          <button
            class="session-group-tab session-group-tab--add"
            onClick={() => {
              setEditingId('__new__')
              setEditName('')
              setTimeout(() => addInputRef?.focus(), 0)
            }}
            title="Create new group"
            data-testid="group-tab-add"
          >
            <FilePlus />
          </button>
        }
      >
        <div class="session-group-tab-edit">
          <input
            ref={addInputRef}
            type="text"
            class="session-group-tab-edit-input"
            placeholder="Group name"
            value={editName()}
            onInput={(e) => setEditName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') {
                setEditingId(null)
                setEditName('')
              }
            }}
          />
          <button class="session-group-tab-edit-btn" onClick={handleCreate}>
            <CheckIcon />
          </button>
          <button
            class="session-group-tab-edit-btn"
            onClick={() => {
              setEditingId(null)
              setEditName('')
            }}
          >
            <X />
          </button>
        </div>
      </Show>
    </div>
  )
}
