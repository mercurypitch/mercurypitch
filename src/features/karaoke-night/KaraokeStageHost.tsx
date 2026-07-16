// The staged half of Karaoke Night: renders the StemMixer performance stage
// for the active song. The playlist runner lives in KaraokeNightRuntime
// (always mounted), so playlists work whether or not a song is staged yet.
// This module owns the heavy imports (the mixer + its styles) — the page
// shell lazy-loads it only when a song goes on stage.
import { LyricsUploaderStyles } from '@/components/LyricsUploader'
import { StemMixer, StemMixerStyles } from '@/components/StemMixer'
import { isPlaylistActive, stopPlaylist } from '@/stores/karaoke-playlist-store'
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
}

export function KaraokeStageHost(props: KaraokeStageHostProps) {
  return (
    <StemMixer
      sessionId={props.song.sessionId}
      stems={props.song.stems}
      songTitle={props.song.title}
      practiceMode="full"
      requestedStems={{ vocal: true, instrumental: true }}
      preset="performance"
      karaokeReferenceVocal={isPlaylistActive()}
      onBack={() => {
        if (isPlaylistActive()) stopPlaylist()
        props.onExit()
      }}
    />
  )
}
