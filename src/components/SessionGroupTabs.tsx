// ============================================================
// SessionGroupTabs — Horizontal pill tab bar for session groups
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import type { SessionGroupRecord } from '@/db'
import { createGroup, deleteGroupWithSessions, getGroupsReactive, renameGroup, } from '@/stores/app-store'
import { CheckSmall, DeleteGroup, FilePlus, MoreVertical, Pencil, X, } from './icons'

interface SessionGroupTabsProps {
  activeGroupId: string | null
  onSelectGroup: (value: string | null) => void
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
    void deleteGroupWithSessions(groupId)
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
                <div
                  class="session-group-tab"
                  classList={{
                    'session-group-tab--active':
                      props.activeGroupId === group.id,
                  }}
                >
                  <button
                    class="session-group-tab-label"
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
                  <button
                    class="session-group-tab-menu-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setContextGroupId((prev) =>
                        prev === group.id ? null : group.id,
                      )
                    }}
                    title="Group options"
                    data-testid={`group-tab-menu-${group.id}`}
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>
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
                  <CheckSmall />
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
                  <Pencil /> Rename
                </button>
                <button
                  class="session-group-context-item session-group-context-item--danger"
                  onClick={() => handleDelete(group.id)}
                >
                  <DeleteGroup /> Delete group & sessions
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
            <CheckSmall />
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
