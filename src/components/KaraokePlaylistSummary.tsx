// ============================================================
// KaraokePlaylistSummary — final scoreboard after the last song
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { perSongScores, phase, queue, restartPlaylist, stopPlaylist, } from '@/stores/karaoke-playlist-store'
import styles from './KaraokePlaylistSummary.module.css'

interface SingerRanking {
  name: string
  avgAccuracy: number
  songCount: number
  bestGrade: string
}

const GRADE_ORDER = ['D', 'C', 'B', 'A', 'S']

/** Trimmed singer name, or a fallback when none was assigned. */
function singerLabel(name: string | undefined, fallback: string): string {
  const trimmed = name?.trim() ?? ''
  return trimmed !== '' ? trimmed : fallback
}

export const KaraokePlaylistSummary: Component = () => {
  // Aggregate scored songs by singer (averages accuracy, keeps best grade).
  const rankings = createMemo<SingerRanking[]>(() => {
    const q = queue()
    const scores = perSongScores()
    const byName = new Map<
      string,
      { sum: number; count: number; best: number }
    >()
    q.forEach((entry, i) => {
      const score = scores[i]
      if (!score) return
      const name = singerLabel(entry.singerName, 'Unnamed')
      const cur = byName.get(name) ?? { sum: 0, count: 0, best: 0 }
      cur.sum += score.accuracyPct
      cur.count += 1
      cur.best = Math.max(cur.best, GRADE_ORDER.indexOf(score.grade))
      byName.set(name, cur)
    })
    return [...byName.entries()]
      .map(([name, v]) => ({
        name,
        avgAccuracy: Math.round(v.sum / v.count),
        songCount: v.count,
        bestGrade: GRADE_ORDER[v.best] ?? 'D',
      }))
      .sort((a, b) => b.avgAccuracy - a.avgAccuracy)
  })

  const hasScores = () => rankings().length > 0

  return (
    <Show when={phase() === 'summary'}>
      <div class={styles.overlay}>
        <div class={styles.card}>
          <div class={styles.trophy}>🏆</div>
          <h2 class={styles.title}>Playlist Complete</h2>

          <Show
            when={hasScores()}
            fallback={
              <p class={styles.noScores}>
                No scores recorded — enable the mic to be scored next time.
              </p>
            }
          >
            <div class={styles.leaderboard}>
              <For each={rankings()}>
                {(r, i) => (
                  <div
                    class={styles.row}
                    classList={{ [styles.winner]: i() === 0 }}
                  >
                    <span class={styles.rank}>{i() + 1}</span>
                    <span class={styles.name}>{r.name}</span>
                    <span
                      class={`${styles.grade} ${styles[`grade${r.bestGrade}`]}`}
                    >
                      {r.bestGrade}
                    </span>
                    <span class={styles.accuracy}>{r.avgAccuracy}%</span>
                    <span class={styles.songCount}>
                      {r.songCount} {r.songCount === 1 ? 'song' : 'songs'}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Per-song recap */}
          <div class={styles.recap}>
            <For each={queue()}>
              {(entry, i) => (
                <div class={styles.recapRow}>
                  <span class={styles.recapSong}>{entry.songTitle}</span>
                  <span class={styles.recapSinger}>
                    {singerLabel(entry.singerName, '—')}
                  </span>
                  <span class={styles.recapScore}>
                    {perSongScores()[i()]
                      ? `${perSongScores()[i()]!.accuracyPct}% (${perSongScores()[i()]!.grade})`
                      : '—'}
                  </span>
                </div>
              )}
            </For>
          </div>

          <div class={styles.actions}>
            <button class={styles.primaryBtn} onClick={() => restartPlaylist()}>
              Play again
            </button>
            <button class={styles.secondaryBtn} onClick={() => stopPlaylist()}>
              Close
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
