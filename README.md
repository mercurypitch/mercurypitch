# Find Your Pitch films

Not code: the lesson films, kept on this branch so they can be downloaded. The branch holds only
films, is never merged and needs no pull request. The films are stored with Git LFS, because each
is over GitHub's 100 MB limit for a plain file.

| File | What it is | sha256 |
| --- | --- | --- |
| `lesson-04/film-04.mp4` | Lesson 4, "The major scale and home", the picture lock that passed film round 4: 8:04.7, 1920x1080, 60 fps, H.264 and AAC. It still speaks with the scratch voices (Kokoro); film-05 brings the final ElevenLabs voices. | `5551b70e408f24f0a5002bd959e6e4fac136b16c1b503fe02f66924a339836d6` |
| `lesson-04/film-05.mp4` | Lesson 4, "The major scale and home", with the final voices: the owner's ElevenLabs voices for Merc and Tavi, and the film re-timed to them. 9:11.2, 1920x1080, 60 fps, H.264 and AAC. | `e44ddab788cc15397814c609713940d81c4dd929d5624ec2c6643f915c8c8162` |
| `lesson-04/film-06.mp4` | Lesson 4, "The major scale and home", with the final voices and the holds round: the board now settles through the longer voiced lines, and the practise card's line stays put. 9:11.2, 1920x1080, 60 fps, H.264 and AAC. | `5481187b50a14193f2d771f0269de1630456678f0579474b5168f8798fceb344` |
| `lesson-04/web/lesson-04-1080p.mp4` | film-06 as the lesson page plays it, for Cloudflare R2: 9:11.2, 1920x1080, 30 fps, H.264 and AAC, starts playing before it has downloaded. 55 MB. | `ded3caad7e561267d017e022fb49caf59caf89498cfeb6ad1a489cb18817e095` |
| `lesson-04/web/lesson-04-720p.mp4` | The same at 1280x720 for phones, for Cloudflare R2: 9:11.2, 30 fps, H.264 and AAC. 32 MB. | `eb92fe55b45f6f2093ed8d7197b3ca027e4ad30207f679b3d636883061ec75e8` |

## Download

On GitHub, open the file on this branch and press Download.

With git (Git LFS installed):

```bash
git fetch origin feat/lesson-04-films
git worktree add ../lesson-films FETCH_HEAD
sha256sum ../lesson-films/lesson-04/*.mp4 ../lesson-films/lesson-04/web/*.mp4
```

Only the two web copies (each film fetched counts against the organisation's monthly Git LFS allowance,
so fetch only what you need):

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 -b feat/lesson-04-films https://github.com/mercurypitch/mercurypitch lesson-films
cd lesson-films
git lfs pull --include="lesson-04/web/*"
sha256sum lesson-04/web/*.mp4
```
