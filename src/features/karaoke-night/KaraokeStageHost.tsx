// The staged half of Karaoke Night: renders the StemMixer performance stage
// for the active song and runs the shared playlist runner, so "Start
// playlist" queues songs here exactly like in the studio. This module owns
// the heavy imports (mixer + playlist machinery) — the page shell lazy-loads
// it only when a song goes on stage.
import { LyricsUploaderStyles } from '@/components/LyricsUploader'
import { StemMixer, StemMixerStyles } from '@/components/StemMixer'
import { useKaraokePlaylistRunner } from '@/features/stem-mixer/karaoke-playlist-runner'
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
  /** Playlist runner hands the next armed song up to the page shell. */
  onSong: (song: KaraokeSong) => void
  onExit: () => void
}

export function KaraokeStageHost(props: KaraokeStageHostProps) {
  useKaraokePlaylistRunner((hydrated) => {
    props.onSong({
      sessionId: hydrated.sessionId,
      title: hydrated.originalFile?.name ?? 'Your song',
      stems: {
        vocal: hydrated.outputs?.vocal,
        instrumental: hydrated.outputs?.instrumental,
      },
    })
  })

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
