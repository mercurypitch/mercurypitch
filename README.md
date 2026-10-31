# Find Your Pitch films

Not code: the lesson films, kept on this branch so they can be downloaded. The branch holds only
films, is never merged and needs no pull request. The films are stored with Git LFS, because each
is over GitHub's 100 MB limit for a plain file.

| File | What it is | sha256 |
| --- | --- | --- |
| `lesson-04/film-04.mp4` | Lesson 4, "The major scale and home", the picture lock that passed film round 4: 8:04.7, 1920x1080, 60 fps, H.264 and AAC. It still speaks with the scratch voices (Kokoro); film-05 brings the final ElevenLabs voices. | `5551b70e408f24f0a5002bd959e6e4fac136b16c1b503fe02f66924a339836d6` |

## Download

On GitHub, open the file on this branch and press Download.

With git (Git LFS installed):

```bash
git fetch origin feat/lesson-04-films
git worktree add ../lesson-films FETCH_HEAD
sha256sum ../lesson-films/lesson-04/film-04.mp4
```
