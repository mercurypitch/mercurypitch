// ============================================================
// SessionGroupTabs — Horizontal pill tab bar for session groups
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import type { SessionGroupRecord } from '@/db'
import { createGroup, deleteGroupWithSessions, getGroupsReactive, renameGroup, } from '@/stores/app-store'
import { showNotification } from '@/stores/notifications-store'
import type { GroupDeleteTarget } from './GroupDeleteConfirmDialog'
import { GroupDeleteConfirmDialog } from './GroupDeleteConfirmDialog'
import { CheckSmall, DeleteGroup, FilePlus, Pencil, X } from './icons'
import styles from './SessionGroupTabs.module.css'

interface SessionGroupTabsProps {
  activeGroupId: string | null
  onSelectGroup: (value: string | null) => void
}

export const SessionGroupTabs: Component<SessionGroupTabsProps> = (props) => {
  const groups = () => getGroupsReactive()
  const [editingId, setEditingId] = createSignal<string | null>(null)
  const [editName, setEditName] = createSignal('')
  const [contextGroupId, setContextGroupId] = createSignal<string | null>(null)
  const [groupToDelete, setGroupToDelete] =
    createSignal<GroupDeleteTarget | null>(null)
  const [deletingGroup, setDeletingGroup] = createSignal(false)

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

  const promptDelete = (group: SessionGroupRecord) => {
    setContextGroupId(null)
    setGroupToDelete({
      id: group.id,
      name: group.name,
      songCount: group.sessionIds.length,
    })
  }

  const confirmDelete = (): void => {
    const target = groupToDelete()
    if (target === null || deletingGroup()) return
    const wasActive = props.activeGroupId === target.id
    const selectGroup = props.onSelectGroup
    setDeletingGroup(true)
    void deleteGroupWithSessions(target.id)
      .then(() => {
        if (wasActive) selectGroup(null)
        setGroupToDelete(null)
      })
      .catch(() => {
        showNotification(
          'Could not delete the group. Your songs are still available.',
          'error',
        )
      })
      .finally(() => setDeletingGroup(false))
  }

  const startRename = (group: SessionGroupRecord) => {
    setEditingId(group.id)
    setEditName(group.name)
    setTimeout(() => editInputRef?.focus(), 0)
  }

  return (
    <div
      class={styles.sessionGroupTabs}
      onContextMenu={(e) => e.preventDefault()}
    >
      <GroupDeleteConfirmDialog
        target={groupToDelete()}
        busy={deletingGroup()}
        onCancel={() => setGroupToDelete(null)}
        onConfirm={confirmDelete}
      />

      {/* "All" tab */}
      <button
        class={styles.sessionGroupTab}
        classList={{
          [styles.sessionGroupTabActive]: props.activeGroupId === null,
        }}
        onClick={() => props.onSelectGroup(null)}
        data-testid="group-tab-all"
      >
        All
      </button>

      <For each={groups()}>
        {(group) => (
          <div
            class={styles.sessionGroupTabWrapper}
            style={{ position: 'relative' }}
          >
            <Show
              when={editingId() === group.id}
              fallback={
                <div
                  class={styles.sessionGroupTab}
                  classList={{
                    [styles.sessionGroupTabActive]:
                      props.activeGroupId === group.id,
                  }}
                >
                  <button
                    class={styles.sessionGroupTabLabel}
                    onClick={() => props.onSelectGroup(group.id)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setContextGroupId(group.id)
                    }}
                    data-testid={`group-tab-${group.id}`}
                  >
                    {group.name}
                    <span class={styles.sessionGroupTabCount}>
                      {group.sessionIds.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    class={styles.sessionGroupTabDeleteBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      promptDelete(group)
                    }}
                    title="Delete group"
                    data-testid={`group-tab-delete-${group.id}`}
                  >
                    <X />
                  </button>
                </div>
              }
            >
              <div class={styles.sessionGroupTabEdit}>
                <input
                  ref={editInputRef}
                  type="text"
                  class={styles.sessionGroupTabEditInput}
                  value={editName()}
                  onInput={(e) => setEditName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(group.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
                <button
                  class={styles.sessionGroupTabEditBtn}
                  onClick={() => handleRename(group.id)}
                >
                  <CheckSmall />
                </button>
                <button
                  class={styles.sessionGroupTabEditBtn}
                  onClick={() => setEditingId(null)}
                >
                  <X />
                </button>
              </div>
            </Show>

            {/* Context menu */}
            <Show when={contextGroupId() === group.id}>
              <div
                class={styles.sessionGroupContextMenu}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  class={styles.sessionGroupContextItem}
                  onClick={() => {
                    setContextGroupId(null)
                    startRename(group)
                  }}
                >
                  <Pencil /> Rename
                </button>
                <button
                  class={`${styles.sessionGroupContextItem} ${styles.sessionGroupContextItemDanger}`}
                  onClick={() => promptDelete(group)}
                >
                  <DeleteGroup /> Delete group & sessions
                </button>
              </div>
              <div
                class={styles.sessionGroupContextBackdrop}
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
            class={`${styles.sessionGroupTab} ${styles.sessionGroupTabAdd}`}
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
        <div class={styles.sessionGroupTabEdit}>
          <input
            ref={addInputRef}
            type="text"
            class={styles.sessionGroupTabEditInput}
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
          <button class={styles.sessionGroupTabEditBtn} onClick={handleCreate}>
            <CheckSmall />
          </button>
          <button
            class={styles.sessionGroupTabEditBtn}
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
