import { JamPanel } from '@/components/jam/JamPanel'
import { useJamRoomBackground } from '@/features/jam/useJamRoomBackground'
import { jamRoomAlpha } from '@/stores/jam-store'
import styles from './JamPage.module.css'

/** Jam tab (TAB_JAM). JamPanel over an ambient rehearsal-room backdrop. */
export function JamPage() {
  const backdrop = useJamRoomBackground()

  return (
    <div
      id="jam-panel"
      class={styles.page}
      // The room's glass, driven by the header slider. Every jam surface
      // resolves its background from this one number (see JamPage.module.css).
      style={{ '--jam-alpha': String(jamRoomAlpha()) }}
    >
      <div
        class={styles.backdrop}
        style={backdrop.style()}
        aria-hidden="true"
      />
      <JamPanel />
    </div>
  )
}
