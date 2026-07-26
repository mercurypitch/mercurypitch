import { createMemo } from 'solid-js'
import { JamPanel } from '@/components/jam/JamPanel'
import { jamRoomId, jamState } from '@/stores/jam-store'
import styles from './JamPage.module.css'

// Generated rehearsal-room stills (public/jam/), shared with the home
// Jam Rooms card. A room id hashes to a stable pick so everyone in the
// same room lands in the same environment; the lobby gets the stage.
const ROOM_BACKDROPS = [
  '/jam/room-stage.webp',
  '/jam/room-singer.webp',
  '/jam/room-guitar.webp',
  '/jam/room-keys.webp',
] as const

function backdropForRoom(roomId: string): string {
  let hash = 0
  for (let i = 0; i < roomId.length; i++) {
    hash = (hash * 31 + roomId.charCodeAt(i)) >>> 0
  }
  return ROOM_BACKDROPS[hash % ROOM_BACKDROPS.length]
}

/** Jam tab (TAB_JAM). JamPanel over an ambient rehearsal-room backdrop. */
export function JamPage() {
  const backdrop = createMemo(() => {
    const roomId = jamRoomId()
    return jamState() === 'active' && roomId !== null
      ? backdropForRoom(roomId)
      : ROOM_BACKDROPS[0]
  })

  return (
    <div id="jam-panel" class={styles.page}>
      <div
        class={styles.backdrop}
        style={{ 'background-image': `url('${backdrop()}')` }}
        aria-hidden="true"
      />
      <JamPanel />
    </div>
  )
}
