import type { Component } from 'solid-js'
import { ConfirmDialog } from './ConfirmDialog'

export interface GroupDeleteTarget {
  id: string
  name: string
  songCount: number
}

interface GroupDeleteConfirmDialogProps {
  target: GroupDeleteTarget | null
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const GroupDeleteConfirmDialog: Component<
  GroupDeleteConfirmDialogProps
> = (props) => {
  const songCount = (): number => props.target?.songCount ?? 0
  const songSummary = (): string => {
    if (songCount() === 0) return 'The empty group will be removed.'
    if (songCount() === 1) {
      return '1 song and its saved stems will be permanently deleted.'
    }
    return `${songCount()} songs and their saved stems will be permanently deleted.`
  }

  return (
    <ConfirmDialog
      open={props.target !== null}
      busy={props.busy}
      title={`Delete "${props.target?.name ?? 'group'}"?`}
      message={<>{songSummary()} This cannot be undone.</>}
      confirmLabel={props.busy ? 'Deleting…' : 'Delete group'}
      onConfirm={props.onConfirm}
      onCancel={props.onCancel}
    />
  )
}
