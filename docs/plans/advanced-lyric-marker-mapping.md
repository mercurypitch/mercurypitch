# Advanced lyric marker mapping

## Outcome

The lyric text itself is the timing surface. During playback, the mapper presses
the first word at its first audible sound and drags a translucent marker through
the text. Position records intra-word highlight progress; time spent stationary
records a held sound. Crossing into the next word closes the previous interval
and stamps the next onset. Releasing closes the current word, including the
final word before a pause, at the end of a line, or at the end of the song.

This makes the timing contract visible and direct:

- word start = the first audible phoneme, not completion of the word;
- word end = the final audible phoneme;
- held vowel = marker dwell inside a word;
- pause = release, then press the next word when singing resumes;
- correction = a user-adjustable reaction-time subtraction, default 180 ms.

Tap mode remains available as an accessible, keyboard-friendly fallback. In
that mode, `W` records the next word onset and `L` skips the rest of the line.

## Why this model

Common karaoke formats model active text as timed intervals or syllable
durations:

- ASS karaoke `\k` tags assign a duration to each syllable, while `\K`/`\kf`
  sweep the secondary colour across it.
- WebVTT timestamp tags identify the text active after each internal timestamp.
- TTML uses explicit `begin`, `end`, and `dur` timing.

The prior mapper stored word starts only and inferred visual duration from an
English syllable estimate. That cannot distinguish a short word followed by a
pause from the same word sung as a long melisma. A marker-authored start, end,
and monotonic progress curve can represent both without requiring the mapper to
know phonetic notation.

## Timing and playback audit

The implementation addresses four timing failure modes:

1. Long sung words were cut short by a syllable-duration estimate. Explicit word
   ends now take precedence for marker-authored timing.
2. A fixed hidden tap correction made different input devices and users
   systematically early or late. The correction is now visible and adjustable.
3. `AudioContext.currentTime` describes the render clock, which can be ahead of
   audible output. Lyric playback now uses `getOutputTimestamp()` with
   `outputLatency` fallback; transport, scoring, and analysis retain the render
   clock.
4. Standard enhanced LRC has word onsets but no portable word ends or intra-word
   curves. MercuryPitch stores the extra data in an ignored LRC ID tag,
   `[x-mp-timing:...]`, so ordinary players still parse the lyric and
   MercuryPitch re-imports it losslessly.

## Reference-song verification

Use the supplied Iron Maiden “Como Estais Amigos” LRC directory as a manual
reference without committing copyrighted lyric content:

1. Import `Iron Maiden - Como Estais Amigos - 2015 Remaster_WordTiming.lrc`.
2. Enter the mapper; playback starts at 0.75x unless it was already slower.
3. Remap a fast phrase, a phrase with a long held vowel, the phrase before the
   long break, and the final line.
4. Finish, download, then re-import the result.
5. Confirm word onsets remain compatible with the reference while held sounds
   visually follow the recorded marker path and stay stable across the break.
6. Compare the suspect archive files only as negative examples. Some timestamps
   encode word completion rather than onset and therefore drift by many
   seconds; they are not valid ground truth.

For a repeatable onset comparison, run:

```sh
pnpm lyrics:compare reference.lrc mapped-candidate.lrc
```

The report includes median, mean, 95th-percentile, and maximum absolute onset
error, signed median bias, and text-alignment mismatches. It identifies
mismatches by line and word number without printing copyrighted lyric text.

## Sources

- [Aegisub ASS override tags](https://aegisubdocs.zahuczky.com/manual/ASS_Tags.html)
- [Aegisub audio timing](https://aegisubdocs.zahuczky.com/3.2/Timing/index.htm)
- [W3C WebVTT concepts](https://www.w3.org/wiki/VTT_Concepts)
- [W3C TTML2 timing](https://www.w3.org/TR/2017/WD-ttml2-20170106/)
- [Web Audio API output timestamps](https://www.w3.org/TR/webaudio-1.0/)
- [Improving Lyrics Alignment through Joint Pitch Detection](https://arxiv.org/abs/2202.01646)
