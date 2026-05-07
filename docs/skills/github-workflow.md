# GitHub Workflow Guide

This document defines the standard workflow for working on GitHub issues in this project. It captures conventions from git hooks, RTK instructions, and project memory.

---

## 1. Starting Work on an Issue

### 1.1 Fetch issue details with GitHub CLI

When given a GitHub issue link or number, **always use `gh` CLI**, never `WebFetch` or API calls. The repo is private and WebFetch returns 404.

```bash
# View issue title and description
gh issue view <ISSUE-NUMBER> --repo Komediruzecki/pitch-perfect

# View issue comments (if any)
gh issue view <ISSUE-NUMBER> --repo Komediruzecki/pitch-perfect --comments
```

If `gh` is not authenticated, ask the user for a PAT token. Set it via:

```bash
export GITHUB_TOKEN=<token>
gh auth login --with-token
```

### 1.2 Check for existing work

Before creating a new branch, check if work already exists:

```bash
# Check open PRs
gh pr list --repo Komediruzecki/pitch-perfect --state open

# Check existing branches (local and remote)
git branch -a | grep -i "<issue-number-or-keyword>"
```

If a branch or PR already exists for the issue, continue work on it rather than creating a duplicate.

### 1.3 Create a feature branch

If no existing work found, create a new branch from `dev` (fallback: `main` if repo doesn't have `dev`):

```bash
git fetch origin dev
git checkout -b feat/issue-<NUMBER>-<short-description> origin/dev
```

Branch naming conventions:
- `feat/issue-<N>-<kebab-case-description>` — new features
- `fix/issue-<N>-<kebab-case-description>` — bug fixes
- Use the issue number and a short (2-4 word) description from the title

**Never branch from `main`** — always from `dev`. Git hooks will reject direct commits/pushes to both `main` and `dev`.

---

## 2. Implementing the Fix or Feature

### 2.1 Plan or implement

Before writing code, assess the issue:

- **Complex issues**: Enter plan mode, explore the codebase, and propose an approach for user approval
- **Simple fixes**: Implement directly, referencing the issue description

### 2.2 Follow project conventions

- Use existing patterns, skills, and conventions from the codebase
- Check `docs/skills/` for any applicable skill guides
- Follow the code style and architecture already in use

---

## 3. Committing

### 3.1 Commit format

Each commit message should follow this format:

```
<ISSUE-ID>: <short-title-description>

<Description paragraph in assertive tone>
```

Example:

```
GH-234: Fix autocorrelation normalization bias

Remove lag-dependent n/(n-lag) normalization factor from the
autocorrelator detector. The old formula biased correlation scores
toward larger lags (lower frequencies), causing 16/22 test notes to
be misdetected as ~65 Hz. Replace with plain sum/r0 normalization.
```

Guidelines:
- Start with the issue ID (e.g., `GH-234:`)
- Short title in imperative mood (e.g., "Fix X", "Add Y", "Remove Z")
- Blank line, then descriptive paragraph explaining **what** and **why**
- Never use `--force` on commits or pushes

### 3.2 Always push after commit

```bash
git add -A
git commit -m "GH-<N>: <title>

<description>"
git push origin <branch>
```

**Never leave uncommitted changes.** Push immediately after commit. **Never force push.**

---

## 4. Opening a Pull Request

### 4.1 Create the PR

When the work is complete:

```bash
gh pr create \
  --repo Komediruzecki/pitch-perfect \
  --base dev \
  --head <branch-name> \
  --title "<descriptive-title>" \
  --body "<PR-description>"
```

### 4.2 PR description format

```
## Summary

Brief description of what was done.

## Changes

- Change 1
- Change 2
- Change 3

## Testing

How the changes were tested (build, test suite, manual testing).

## Screenshots / Output

Any relevant test output or screenshots.

Closes #<ISSUE-NUMBER>
```

The `Closes #<N>` line is required — it auto-resolves the issue when the PR is merged.

### 4.3 Target branch

**Always target `dev`**, never `main`. Merges to `main` happen separately.

---

## 5. Review Process

### 5.1 Checking PR feedback

```bash
# View PR details and comments
gh pr view <PR-NUMBER> --repo Komediruzecki/pitch-perfect --comments

# List review comments
gh api repos/Komediruzecki/pitch-perfect/pulls/<PR-NUMBER>/comments
```

### 5.2 Responding to review

- Address reviewer comments with additional commits on the same branch
- Push new commits — the PR updates automatically
- Do not force-push; add commits on top

---

## 6. After Work Is Complete

### 6.1 Check for new issues

After completing a task, check for open issues:

```bash
gh issue list --repo Komediruzecki/pitch-perfect --state open --limit 10
```

### 6.2 Continuous workflow

After finishing one issue, start on the next relevant one. This keeps work aligned with the project's GitHub issue tracker.

---

## Quick Reference

| Action | Command |
|--------|---------|
| View issue | `gh issue view <N> --repo Komediruzecki/pitch-perfect` |
| View issue comments | `gh issue view <N> --repo Komediruzecki/pitch-perfect --comments` |
| List open issues | `gh issue list --repo Komediruzecki/pitch-perfect --state open --limit 10` |
| List open PRs | `gh pr list --repo Komediruzecki/pitch-perfect --state open` |
| View PR | `gh pr view <N> --repo Komediruzecki/pitch-perfect` |
| Create feature branch | `git checkout -b feat/issue-<N>-<desc> origin/dev` |
| Commit | `git add -A && git commit -m "GH-<N>: <title>"` |
| Push | `git push origin <branch>` |
| Create PR | `gh pr create --repo Komediruzecki/pitch-perfect --base dev --head <branch>` |

## Rules Summary

1. **Use `gh` CLI** for all GitHub access — never WebFetch
2. **Branch from `dev`**, never from `main`
3. **Target `dev`** when opening PRs
4. **Never push to `main` or `dev`** — git hooks enforce this
5. **Never force push** — add commits on top
6. **Never use `git reset --hard` for rebasing** — use `git rebase origin dev`
7. **Always push after commit** — no uncommitted changes
8. **Commit format**: `GH-<N>: <title>` with description paragraph
9. **PR descriptions** must include `Closes #<N>`
10. **Never deploy** unless explicitly asked
