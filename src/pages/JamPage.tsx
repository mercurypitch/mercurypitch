import { createMemo } from 'solid-js'
import { JamPanel } from '@/components/jam/JamPanel'
import { jamRoomAlpha, jamRoomId } from '@/stores/jam-store'
import styles from './JamPage.module.css'

// Generated rehearsal-room stills (public/jam/, 2K + 4K via image-set),
// shared with the home Jam Rooms card. A room id hashes to a stable pick
// so everyone in the same room lands in the same environment; the lobby
// gets the stage.
const ROOM_BACKDROPS = [
  styles.roomStage,
  styles.roomSinger,
  styles.roomGuitar,
  styles.roomKeys,
] as const

function backdropForRoom(roomId: string): string {
  let hash = 0
  for (let i = 0; i < roomId.length; i++) {
    hash = (hash * 31 + roomId.charCodeAt(i)) >>> 0
  }
  return ROOM_BACKDROPS[hash % ROOM_BACKDROPS.length]!
}

/** Jam tab (TAB_JAM). JamPanel over an ambient rehearsal-room backdrop. */
export function JamPage() {
  // As soon as the room is NAMED, not once it is connected. A joiner has
  // its room id before the handshake, so gating on 'active' meant landing
  // in the lobby's stage first and being moved to the real room a second
  // later -- which reads as having joined the wrong room and been
  // corrected. Same room, same picture, from the first frame.
  const backdrop = createMemo(() => {
    const roomId = jamRoomId()
    return roomId === null ? ROOM_BACKDROPS[0] : backdropForRoom(roomId)
  })

  return (
    <div
      id="jam-panel"
      class={styles.page}
      // The room's glass, driven by the header slider. Every jam surface
      // resolves its background from this one number (see JamPage.module.css).
      style={{ '--jam-alpha': String(jamRoomAlpha()) }}
    >
      <div class={`${styles.backdrop} ${backdrop()}`} aria-hidden="true" />
      <JamPanel />
    </div>
  )
}
