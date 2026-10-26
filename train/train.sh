#!/usr/bin/env bash
# train.sh: replay the held PRs in merge order onto origin/main in kit-ladder (detached),
# skipping each PR's module-map commit and regenerating the map after each PR instead.
# Stops at the first conflict and reports it. Writes tips to train/tips.txt.
S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
WT=/home/user/mercurypitch/.claude/worktrees/kit-ladder
ORDER="${ORDER:-leap-ladder-slug kit-ladder-reader kit-runs-chords-mic lesson-09-kit lesson-10-kit lesson-12-music lesson-order-warning arpeggio-jumper-v2 lesson-10-app-copy}"
START="${START:-origin/main}"
git -C $WT switch -q --detach "$START" || exit 1
: > $S/train/tips.txt
for b in $ORDER; do
  r=origin/feat/$b
  base=$(git -C $WT merge-base origin/main $r)
  echo "== $b ($(git -C $WT rev-list --count $base..$r) commits from $(git -C $WT rev-parse --short $base))"
  for c in $(git -C $WT rev-list --reverse $base..$r); do
    subj=$(git -C $WT log -1 --format=%s $c)
    if [ "$subj" = "docs(agent): regenerate the module map" ]; then echo "   skip map commit $(git -C $WT rev-parse --short $c)"; continue; fi
    if ! git -C $WT -c merge.conflictStyle=diff3 cherry-pick --allow-empty $c >/dev/null 2>&1; then
      u=$(git -C $WT diff --name-only --diff-filter=U); ok=1; regen=0
      for f in $u; do
        if [ "$f" = "docs/agent/INDEX.md" ]; then git -C $WT checkout -q --ours "$f"; regen=1
        elif [[ "$f" == docs/* ]] && python3 $S/rebase/merge_words.py "$WT/$f" >/dev/null 2>&1; then echo "$b $(git -C $WT rev-parse --short $c) $f" >> $S/train/wordmerged.txt; echo "   word-merged $f"
        else ok=0; fi
      done
      if [ $ok = 1 ]; then
        [ $regen = 1 ] && (cd $WT && node scripts/gen-agent-index.mjs >/dev/null 2>&1)
        git -C $WT add -A $u docs/agent && (cd $WT && GIT_EDITOR=true git cherry-pick --continue >/dev/null 2>&1) && { echo "   resolved at $(git -C $WT rev-parse --short $c)"; continue; }
      fi
      echo "   CONFLICT at $(git -C $WT rev-parse --short $c) $subj"
      git -C $WT diff --name-only --diff-filter=U | sed 's/^/     U /'
      echo "STOPPED $b" >> $S/train/tips.txt
      exit 2
    fi
  done
  (cd $WT && node scripts/gen-agent-index.mjs >/dev/null 2>&1)
  if [ -n "$(git -C $WT status --porcelain docs/agent)" ]; then
    git -C $WT add docs/agent && git -C $WT commit -q -m "docs(agent): regenerate the module map" && echo "   map regenerated"
  else
    echo "   map unchanged"
  fi
  echo "$b $(git -C $WT rev-parse HEAD)" >> $S/train/tips.txt
done
echo "== train complete: $(git -C $WT rev-parse --short HEAD)"
