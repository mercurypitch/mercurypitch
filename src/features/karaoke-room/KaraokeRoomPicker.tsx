// ============================================================
// The Karaoke room's picture, chosen from the chip (plan S8 §2, R5)
// ============================================================
//
// The room header's chip names the room; tapping it opens this, as it does
// in the Sing room: the other rooms' picker, embedded, over the karaoke
// surface's own controller. In the app the free rooms are the Broadway
// Theater (the room's default), the Mercury Theatre and Tokyo Cyber, all
// packaged; a supporter's rooms come from the server.

import type { Component } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import { PremiumBackgroundPicker } from '@/features/backgrounds/PremiumBackgroundPicker'
import type { BackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { thisDeviceLower } from '@/lib/device-noun'
import styles from './karaoke-room.module.css'

interface KaraokeRoomPickerProps {
  isOpen: boolean
  close: () => void
  background: BackgroundSurfaceController
}

/** How long a chosen-picture announcement stays in the live region. */
const ANNOUNCE_MS = 1800

export const KaraokeRoomPicker: Component<KaraokeRoomPickerProps> = (props) => {
  // A card changes a picture and nothing else on screen moves, so a screen
  // reader is told what was chosen, as the Sing room's picker says it.
  const [announcement, setAnnouncement] = createSignal('')
  let timer: number | null = null
  const announce = (message: string): void => {
    if (timer !== null) window.clearTimeout(timer)
    setAnnouncement(message)
    timer = window.setTimeout(() => {
      setAnnouncement('')
      timer = null
    }, ANNOUNCE_MS)
  }
  onCleanup(() => {
    if (timer !== null) window.clearTimeout(timer)
  })

  return (
    <Sheet
      isOpen={props.isOpen}
      close={() => props.close()}
      ariaLabel="Choose your Karaoke room"
      snap="tall"
    >
      <div class={styles.library} data-testid="karaoke-room-picker">
        <div class={styles.sheetHead}>
          <h2 class={styles.sheetTitle}>Your room</h2>
        </div>
        <p class={styles.groupNote}>
          The room is the picture behind your songs. Your choice stays on{' '}
          {thisDeviceLower()}.
        </p>

        <PremiumBackgroundPicker
          controller={props.background}
          embedded
          onSelect={(option) => {
            const accepted = props.background.select(option.id)
            if (accepted) announce(`${option.label} selected.`)
            return accepted
          }}
        />

        <p class={styles.srOnly} role="status" aria-live="polite">
          {announcement()}
        </p>
      </div>
    </Sheet>
  )
}
