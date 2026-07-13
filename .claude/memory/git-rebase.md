---
name: git-rebase
description: NEVER use git reset --hard to rebase; always use git rebase origin BRANCHNAME
type: feedback
---
# Git Rebase - What NOT to Do

## The Critical Mistake
```bash
# ❌ WRONG - This OVERWRITES all your work!
git reset --hard origin/dev
# This discards all your commits and changes. It is NOT a rebase.
```

## The CORRECT Way to Rebase
```bash
# ✅ CORRECT - This REPLAYS your commits on TOP of the target branch
git fetch origin main
git rebase origin main
git push origin feat/your-branch --force-with-lease
```

## Rule
- **Use `rebase`** when you want to update a branch on top of another branch
- **Use `reset --hard`** ONLY when you explicitly want to discard all changes
- **NEVER** confuse these two - rebase preserves work, reset destroys it
- **NEVER** use `git reset --hard` for rebasing. Always use `git rebase origin BRANCHNAME`
