# Draft pieces for LEDGER 35 and DECISIONS 140 (fill {{...}} from the FILM6 report and measure-film-06)

## LEDGER row 35

| 35 (film FILM6) | `/dev/shm/l4film/film-06.mp4` (60 fps, 9:11.2, full mix, the final voices, the holds round; the master copied to `renders/` and pushed to `feat/lesson-04-films`, bfd8196; the music-only in `/dev/shm`; seams 6, 11 and 20 blank first frames, pieces 5, 6, 10, 11, 19 and 20 re-rendered on one browser) | {{verdict and items}} | Decision 140: {{what happens}} | Holds 8.2 s (0.4 per 30 s), longest 0.4 s, no final hold (film-05: 25.7 s, 1.4 per 30 s, longest 0.9 s); -16.0 LUFS, LRA 5.5 LU, true peak -2.4 dBTP (film-05's: the sound is unchanged, its music bed byte-identical) |

## DECISIONS 140

140. **Film round 6 (critic FILM6, {{verdict}}) after the holds round.**
     - **The holds round** (decision 139; 31 October 23:40 to 1 November 01:3x):
       - Builder BC on s05 to s08: slow sideways camera creeps only (at most 30 px, sine.inOut, at most
         7.7 px/s on the near layer), labels that settle where Tavi is in frame and in S8 (whose camera
         holds F0), and S8's tally fade 0.2 to 0.45 s from the same start. Lab clips: S5 5.1 to 0.3 s of
         holds, S6 1.9 to 0.4, S7 4.6 to 0.5, S8 1.0 (and 0.2 at its end) to 0.4; none over 0.1 s.
       - Builder D on s09 to s11 and the practise card: S9 4.6 to 0.1 s, S10 2.4 to 0.3, S11 0.9 to 0.1.
         "Singing Voice Range" is marked by a chrome glow, with no change of size (a swell about its
         centre would reach the "›"), and the gear fades in from 0.88 to 1 over 0.3 s.
       - Every scene's first and last frames are identical to before; the full check 0 errors and 65
         warnings (the baseline); clock-lint silent; merc-tags 68 tags, none stale.
     - **The render** (`render-l4.sh`, frozen 04:20 as `l4film06proj`, 33,073 frames):
       - A container restart at 04:16 wiped `/dev/shm`: the film-05 copies there, the extract cache and
         the films work repo. Nothing needed was lost (film-05 on disk and on GitHub).
       - Two workers 04:22 to 06:52 with no memory kill (peak rss and shmem about 11.3 GB of the
         13.4 GiB cap). The memory fallback in `render-switch.sh` held the cgroup path from before the
         restart and could never have fired; `mem-guard.sh` replaced it at 06:19 and stood down when
         the capture ended.
       - The seam check flagged seams 6, 11 and 20: the first frames of those pieces were blank or half
         painted (frames 9000, 16500 and 16501, 30000 to 30002), likely a recycled browser capturing
         before the page painted. Pieces 5, 6, 10, 11, 19 and 20 were re-rendered on one browser with
         no recycling, 06:53 to 08:06, and every seam was clean.
       - 551.217 s (the cue sheet's 551.205). The master is 142 MB (film-05: 117 MB; the creeps
         compress less). `render-l4.sh` refused the master's copy to `renders/` (185 MB free, 186
         needed) and then copied the music-only into that room; the music-only's disk copy was
         replaced by the master at 08:11, checked byte for byte, and the script now skips the
         music-only when the master was refused. The master is on `feat/lesson-04-films` as bfd8196
         (Git LFS, verified with the batch API). `renders/film-05-music-only.mp4` went to `/dev/shm`
         to leave room on disk for the critic; its sound is byte-identical to film-06's music-only, so
         it rebuilds from `film-05.mp4`.
     - **FILM6 against FILM5:** {{marks}}
     - **Its items, and what happens to each:** {{items}}
