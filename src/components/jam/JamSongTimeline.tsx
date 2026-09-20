// ── JamSongTimeline ───────────────────────────────────────────────────
// Where the song is: which line, your take so far, and the timeline.
//
// This was a row of its own between the room's controls and the words,
// with the song's name at the front of it. On a tablet that made three
// rows of chrome above the lyrics. The name went up into the room header
// (JamNowSinging) and the rest came in here, to sit on the SAME row as the
// playback controls wherever there is the width for it -- and to wrap
// under them, whole, where there is not.
//
// It can live outside the stage because nothing in it needs the audio
// element any more: a seek is a request the stage answers
// (jamSongSeekRequest), and the stage reports how long the file really is.

import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { jamPhoneLayout } from '@/lib/jam/jam-phone-layout'
import { lyricLineProgress } from '@/lib/jam/jam-song'
import { jamIsHost, jamSong, jamSongMediaDurationSec, jamSongPositionSec, jamSongRunScore, jamSongSeek, } from '@/stores/jam-store'
import { JamLyricVersionPicker } from './JamLyricVersionPicker'
import { JamSongScrubber } from './JamSongScrubber'
import styles from './JamSongTimeline.module.css'

export const JamSongTimeline: Component = () => {
  // A memo, so the text node is written when the LINE changes and not on
  // every tick of the clock that lands inside it.
  const progressText = createMemo((): string => {
    const progress = lyricLineProgress(
      jamSong()?.lines ?? [],
      jamSongPositionSec(),
    )
    switch (progress.phase) {
      case 'empty':
        return ''
      case 'intro':
        return `Intro · ${progress.totalLines} lines`
      case 'line':
        return `Line ${progress.lineNumber} / ${progress.totalLines}`
      case 'break':
        return `Break · next ${progress.nextLineNumber} / ${progress.totalLines}`
      case 'outro':
        return `Outro · ${progress.totalLines} lines`
    }
  })

  return (
    <Show when={jamSong()}>
      {(song) => (
        <div class={styles.timeline} data-testid="jam-song-timeline">
          <Show when={progressText() !== ''}>
            <span class={styles.lineProgress} aria-label="Lyric position">
              {progressText()}
            </span>
          </Show>
          {/* Your take so far. Only yours: everyone scores themselves
              from their own microphone, so this is not a scoreboard and
              is deliberately not presented as one. */}
          <Show when={jamSongRunScore()}>
            {(run) => (
              <span
                class={styles.runScore}
                aria-label={`Your take score: ${run().score} out of 100; ${run().completedLines} of ${run().totalLines} assigned scoreable lines completed; singing detected in ${run().sungLines}`}
              >
                <span class={styles.runLabel}>Take</span>
                <strong>{run().score}</strong>
                <span class={styles.runLines}>
                  {run().sungLines}/{run().totalLines} sung
                </span>
              </span>
            )}
          </Show>
          {/* Everyone sees the position; only the host can move it.
              Knowing where you are in the song is not a privilege, but a
              room with two people dragging the playhead is a room nobody
              can sing in. */}
          {/* Wrapped so a narrow layout can give it a whole line: it is
              the one control here that must not be squeezed. */}
          <div class={styles.scrub}>
            <JamSongScrubber
              positionSec={jamSongPositionSec}
              durationSec={() =>
                jamSongMediaDurationSec() ?? song().durationSec
              }
              canSeek={jamIsHost()}
              // A guest broadcasts nothing and moves nothing: it is not
              // their transport, and the stage's drift correction brings
              // them to wherever the host ends up anyway.
              onSeek={(to) => {
                if (jamIsHost()) jamSongSeek(to)
              }}
            />
          </div>

          {/* Which words are on the sheet is the host's edit to the sheet,
              so on anything wider than a phone it sits in the host's bar
              above the words (JamAssignBar) and this row stays short
              enough to share a line with the buttons. A phone has no room
              up there, and has it here: this bar is two lines on a phone
              anyway, and the first of them is half empty. */}
          <Show when={jamPhoneLayout()}>
            <JamLyricVersionPicker />
          </Show>
        </div>
      )}
    </Show>
  )
}
