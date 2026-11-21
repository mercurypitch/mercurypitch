// Studio failure notices — how Studio says something went wrong. Playback, a preview or Auto-balance failing changes nothing in the song: it is said once, as the app's notice, where the app says everything else, never as a bar that stays in the Studio. A refused edit is said in a dialog the person acknowledges. Both say what happened and what to do; the error itself is in the console.
import type { Accessor } from 'solid-js'
import { createEffect, on } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { showNotification } from '@/stores/notifications-store'

/** Playback's notices share a channel: a new one replaces the last, so failures never stack. */
export const STUDIO_PLAYBACK_NOTICE = 'studio-playback'
export const STUDIO_EDIT_REFUSED_TITLE = 'That change was not made'

/** Say each failure `error` brings, once, as it arrives. */
export function useStudioFailureNotice(error: Accessor<string | null>): void {
  createEffect(
    on(error, (text) => {
      if (text !== null)
        showNotification(text, 'error', { channel: STUDIO_PLAYBACK_NOTICE })
    }),
  )
}

export interface StudioEditRefusalDialogProps {
  /** Why the edit was refused, in words for people; null when none was. */
  refusal: string | null
  onDismiss(): void
}

/** A refused edit, undo or redo, said in a dialog with one way out. */
export function StudioEditRefusalDialog(props: StudioEditRefusalDialogProps) {
  return (
    <ConfirmDialog
      open={props.refusal !== null}
      variant="notice"
      title={STUDIO_EDIT_REFUSED_TITLE}
      message={props.refusal}
      confirmLabel="OK"
      onConfirm={() => props.onDismiss()}
      onCancel={() => props.onDismiss()}
    />
  )
}
