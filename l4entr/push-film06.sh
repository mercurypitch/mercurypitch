#!/usr/bin/env bash
# Push film-06 to the films-only branch feat/lesson-04-films with Git LFS, beside film-04 and film-05
# (push-film05.sh, 31 Oct). Run once render-l4.sh has written "seams: CLEAN" and the film line.
# The work repo lives in /dev/shm/films (RAM); a container restart empties it, so it is cloned again
# without the films' bytes (GIT_LFS_SKIP_SMUDGE=1, depth 1). Commits as the owner. Stops before
# committing if anything does not match. Verification asks GitHub's LFS batch API whether it holds the
# object (an upload query, which costs no bandwidth): downloads are blocked while the organisation's
# LFS budget is spent (31 Oct). Log: l4entr/push-film06.log
set -euo pipefail
P=/home/user/mercurypitch/output/motion/lesson-04
F=/dev/shm/l4film/film-06.mp4
D=$P/renders/film-06.mp4
ST=$P/renders/film-06.status
R=/dev/shm/films
B=feat/lesson-04-films
URL=https://github.com/mercurypitch/mercurypitch
WANT=551.205

grep -q "seams: CLEAN" "$ST" || { echo "STOP: seams not CLEAN in $ST"; exit 1; }
[ -s "$F" ] || { echo "STOP: no $F"; exit 1; }
if [ -s "$D" ]; then cmp "$F" "$D" && echo "disk copy $D matches"; else echo "NOTE: no disk copy at $D"; fi

VS=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate -of csv=p=0 "$F")
AS=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$F")
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$F")
echo "video $VS, audio $AS, $DUR s"
[ "$VS" = "h264,1920,1080,60/1" ] && [ "$AS" = "aac" ] || { echo "STOP: unexpected streams"; exit 1; }
MMSS=$(python3 -c "import sys; d=float(sys.argv[1]); w=float(sys.argv[2]); assert abs(d-w)<0.1, d; print(f'{int(d//60)}:{d%60:04.1f}')" "$DUR" "$WANT")
SHA=$(sha256sum "$F" | cut -d' ' -f1)
SIZE=$(stat -c %s "$F")
echo "film-06 $MMSS sha256 $SHA ($SIZE bytes)"

if [ ! -d "$R/.git" ]; then
  GIT_LFS_SKIP_SMUDGE=1 git clone -q --depth 1 --single-branch -b "$B" "$URL" "$R"
  echo "cloned $B into $R (pointers only)"
fi
cd "$R"
git fetch -q origin "$B"
[ "$(git rev-parse HEAD)" = "$(git rev-parse FETCH_HEAD)" ] || { echo "STOP: $B moved on origin"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "STOP: $R not clean"; git status --short; exit 1; }
cp "$F" lesson-04/film-06.mp4
cmp "$F" lesson-04/film-06.mp4

python3 - "$SHA" "$MMSS" <<'PY'
import sys
sha, mmss = sys.argv[1], sys.argv[2]
p = "README.md"
s = open(p).read()
row = ("| `lesson-04/film-06.mp4` | Lesson 4, \"The major scale and home\", with the final voices and the holds round: the "
       f"board now settles through the longer voiced lines, and the practise card's line stays put. {mmss}, 1920x1080, "
       f"60 fps, H.264 and AAC. | `{sha}` |\n")
anchor = s.index("| `lesson-04/film-05.mp4`")
end = s.index("\n", anchor) + 1
assert "film-06.mp4`" not in s
s = s[:end] + row + s[end:]
assert "sha256sum ../lesson-films/lesson-04/*.mp4" in s
open(p, "w").write(s)
PY

git add lesson-04/film-06.mp4 README.md
# Read the staged blob: it must be an LFS pointer to this film (not "git lfs ls-files | grep -q": under
# pipefail grep -q quits at the first match and git-lfs dies of SIGPIPE on the next line).
PTR=$(git cat-file -p :lesson-04/film-06.mp4)
grep -qx "oid sha256:$SHA" <<<"$PTR" && grep -qx "version https://git-lfs.github.com/spec/v1" <<<"$PTR" \
  || { echo "STOP: film-06 is not stored in LFS"; git reset -q; exit 1; }
echo "staged as an LFS pointer: $(tr '\n' ' ' <<<"$PTR")"
git diff --cached --stat
git diff --cached README.md
git -c user.name=Komediruzecki -c user.email=komediruzecki.2015@gmail.com commit -q -F - <<MSG
chore(films): Lesson 4 after the holds round, film-06, to download

Lesson 4 on the owner's ElevenLabs voices, with the board settling through the longer voiced lines (film round 5's holds) and the practise card's line held still: $MMSS, as film-05. Stored with Git LFS beside film-04 and film-05, on the branch that holds only films and is never merged.
MSG
git log -1 --format='%h %an <%ae> %s'

ok=0
for wait in 0 2 4 8 16; do
  sleep $wait
  if git push -u origin "$B"; then ok=1; break; fi
  echo "push failed; retrying after a pause"
done
[ $ok = 1 ] || { echo "STOP: push failed 5 times; the commit is local in $R"; exit 1; }
REMOTE=$(git ls-remote origin "refs/heads/$B" | cut -f1)
[ "$REMOTE" = "$(git rev-parse HEAD)" ] || { echo "STOP: origin $B is $REMOTE, not HEAD"; exit 1; }
echo "origin $B at $(git rev-parse --short HEAD)"

ANS=$(curl -sS -X POST -H "Accept: application/vnd.git-lfs+json" -H "Content-Type: application/vnd.git-lfs+json" \
  --data "{\"operation\":\"upload\",\"transfers\":[\"basic\"],\"objects\":[{\"oid\":\"$SHA\",\"size\":$SIZE}]}" \
  "$URL.git/info/lfs/objects/batch")
python3 - "$ANS" "$SHA" <<'PY'
import json, sys
d = json.loads(sys.argv[1]); sha = sys.argv[2]
o = [x for x in d.get("objects", []) if x.get("oid") == sha]
assert o, f"no answer for {sha}: {d}"
o = o[0]
if o.get("actions") or o.get("error"):
    print("STOP: GitHub does not hold the object:", o); sys.exit(1)
print(f"VERIFIED: GitHub holds the LFS object {sha} (the batch API asks for no upload)")
PY
echo "$URL/blob/$B/lesson-04/film-06.mp4"
