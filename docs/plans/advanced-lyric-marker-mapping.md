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

## Syllables and sub-word timing

Marker playback is not a discrete English syllable tokenizer. Legacy
onset-only LRC still uses an English syllable estimate to avoid stretching a
word across a long pause, but marker-authored timing records a continuous
sub-word curve. Dragging through part of a word, dwelling on a vowel, and then
continuing produces the syllable-like visual effect without inventing phoneme
boundaries that the singer may not follow.

This is deliberate: melisma and pronunciation can divide the same written word
differently in different performances. Exact syllable labels can be added as a
separate editing layer later; the marker curve already preserves their audible
timing.

## Long-session performance

Mapping mode keeps the vocal waveform overview active at 30 fps, but pauses
live-waveform, pitch, MIDI, FFT, and mic-comparison work. Pointer input updates
only the active line and word, samples only the latest browser-coalesced pointer
position, and fills any crossed intermediate words so a fast drag remains
complete. Recovery snapshots are serialized at most once per short burst.

Playback speed is no longer changed automatically. The mapper exposes 1x,
0.85x, 0.75x, and 0.5x choices; 1x preserves the natural vocal sound, while
0.75x remains available for dense phrases.

`Discard changes` restores the complete lyric/timing snapshot captured before
the mapper opened. `Redo line` remains the targeted correction for one line.

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
