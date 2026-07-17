// The staged half of Karaoke Night: renders the StemMixer performance stage
// for the active song. The playlist runner lives in KaraokeNightRuntime
// (always mounted), so playlists work whether or not a song is staged yet.
// This module owns the heavy imports (the mixer + its styles) — the page
// shell lazy-loads it only when a song goes on stage.
import { LyricsUploaderStyles } from '@/components/LyricsUploader'
import { StemMixer, StemMixerStyles } from '@/components/StemMixer'
import { ensureSessionHydrated } from '@/features/stem-mixer/karaoke-playlist-runner'
import { isPlaylistActive, stopPlaylist } from '@/stores/karaoke-playlist-store'
import { getUvrSession } from '@/stores/uvr-store'
import { DEMO_SESSION_ID } from './demo-song'
import { trackKaraoke, trackKaraokeOnce } from './funnel'
import type { KaraokeSong } from './KaraokeRailPanels'

/** Inject a component's CSS string once (the studio app injects these at
 *  boot; here they ride along with this lazy chunk). */
function injectStyles(key: string, css: string): void {
  if (document.head.querySelector(`style[data-kn="${key}"]`) !== null) return
  const el = document.createElement('style')
  el.setAttribute('data-kn', key)
  el.textContent = css
  document.head.appendChild(el)
}
injectStyles('stem-mixer', StemMixerStyles)
injectStyles('lyrics-uploader', LyricsUploaderStyles)

interface KaraokeStageHostProps {
  song: KaraokeSong
  onExit: () => void
  /** Stage a different song (the zen stage's song sheet picks by id). */
  onSong: (song: KaraokeSong) => void
}

export function KaraokeStageHost(props: KaraokeStageHostProps) {
  // Mirror of the rail's singSession: verify + re-mint blob URLs before
  // staging (stored object URLs die with the page that minted them).
  const pickSession = async (sessionId: string): Promise<void> => {
    const s = getUvrSession(sessionId)
    if (s === undefined) return
    const hydrated = await ensureSessionHydrated(s)
    const outputs = hydrated.outputs
    if ((outputs?.vocal ?? '') === '' && (outputs?.instrumental ?? '') === '')
      return
    trackKaraoke('karaoke_song_staged')
    props.onSong({
      sessionId,
      title: s.originalFile?.name ?? 'Your song',
      stems: { vocal: outputs?.vocal, instrumental: outputs?.instrumental },
    })
  }

  return (
    <StemMixer
      sessionId={props.song.sessionId}
      stems={props.song.stems}
      songTitle={props.song.title}
      practiceMode="full"
      requestedStems={{ vocal: true, instrumental: true }}
      preset="performance"
      autoPlay={props.song.autoPlay === true}
      karaokeReferenceVocal={isPlaylistActive()}
      onThirtySecondsPlayed={
        props.song.sessionId === DEMO_SESSION_ID
          ? () => trackKaraokeOnce('karaoke_demo_complete')
          : undefined
      }
      onBack={() => {
        if (isPlaylistActive()) stopPlaylist()
        props.onExit()
      }}
      onPickSession={(id) => void pickSession(id)}
    />
  )
}
