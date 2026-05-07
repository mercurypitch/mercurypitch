# GitHub Workflow Guide

> **Audience**: AI agent assistants working on this project.
> **Purpose**: Standard operating procedure for the full GitHub lifecycle — from issue to merged PR.

---

## Introduction

You are an agent assistant. When you work on GitHub issues, you follow a consistent, predictable workflow. This document encodes every rule, convention, and git hook constraint into a single reference. Follow it for every issue, every time.

### Prerequisites

- **GitHub CLI** (`gh`) must be installed and authenticated
- If `gh` is not authenticated, ask the user for a PAT token:
  ```bash
  export GITHUB_TOKEN=<token>
  gh auth login --with-token
  ```
- Determine the repository by asking the user for the repo link, or infer it from the remote:
  ```bash
  gh repo view --json nameWithOwner -q .nameWithOwner
  ```

### Dynamic Variables

Throughout this guide, angle-bracketed tokens like `<repo>` are placeholders. You substitute them with actual values at runtime. See the [Variables Reference](#variables-reference) at the end of this document for every variable used.

---

## 1. Starting Work on an Issue

### 1.1 Fetch Issue Details

When given a GitHub issue link or number, **always use `gh` CLI**. Never use `WebFetch` or raw API calls — the repository may be private and WebFetch returns 404.

```bash
# View issue title and description
gh issue view <issue-number> --repo <repo>

# View issue comments (if any)
gh issue view <issue-number> --repo <repo> --comments
```

### 1.2 Check for Existing Work

Before creating a new branch, check whether work already exists for this issue:

```bash
# Check open PRs
gh pr list --repo <repo> --state open

# Search for related branches (local and remote)
git branch -a | grep -i "<issue-number-or-keyword>"
```

If a branch or PR already exists for the issue, **continue work on it** rather than creating a duplicate.

### 1.3 Create a Feature Branch

If no existing work is found, create a new branch from `<default-branch>` (typically `dev`; fallback to `main` if the repo has no `dev`):

```bash
git fetch origin <default-branch>
git checkout -b <branch-name> origin/<default-branch>
```

**Branch naming conventions:**

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/issue-<issue-number>-<short-desc>` | `feat/issue-234-add-sensitivity-slider` |
| Bug fix | `fix/issue-<issue-number>-<short-desc>` | `fix/issue-235-null-pointer-on-startup` |

- The `<short-desc>` is 2–4 kebab-case words from the issue title
- **Never branch from or push to `<default-branch>` directly.** Git hooks reject direct commits/pushes to protected branches.

---

## 2. Implementing the Fix or Feature

### 2.1 Assess and Plan

Before writing code, evaluate the issue:

- **Complex or ambiguous issues**: Enter plan mode, explore the codebase, design an approach, and get user approval before coding.
- **Simple, well-defined fixes**: Implement directly, referencing the issue description.

### 2.2 Follow Project Conventions

- Use existing patterns, architecture, and code style from the codebase
- Check `docs/skills/` for any applicable skill guides
- Check `CLAUDE.md` and project memory for additional instructions
- Do not add unnecessary abstractions, refactoring, or features beyond what the issue requires

---

## 3. Committing

### 3.1 Commit Format

Every commit message follows this structure:

```
<issue-id>: <commit-title>

<commit-body>
```

**Example:**

```
GH-234: Fix autocorrelation normalization bias

Remove lag-dependent n/(n-lag) normalization factor from the
autocorrelator detector. The old formula biased correlation scores
toward larger lags (lower frequencies), causing 16/22 test notes to
be misdetected as ~65 Hz. Replace with plain sum/r0 normalization.
```

**Rules:**
- `<issue-id>` starts with the project's issue prefix (e.g., `GH-234`, `#234`)
- `<commit-title>` is a short, imperative-mood summary ("Fix X", "Add Y", "Remove Z")
- `<commit-body>` explains **what** changed and **why** — not how
- Blank line separates title from body
- **Never use `--force`** on commits or pushes

### 3.2 Always Push After Commit

```bash
git add -A
git commit -m "<issue-id>: <commit-title>

<commit-body>"
git push origin <branch-name>
```

- **Never leave uncommitted changes** in the working tree
- **Never force push** — always add commits on top
- **Never push to `<default-branch>`** — git hooks will reject it

---

## 4. Opening a Pull Request

### 4.1 Create the PR

```bash
gh pr create \
  --repo <repo> \
  --base <default-branch> \
  --head <branch-name> \
  --title "<pr-title>" \
  --body "<pr-body>"
```

### 4.2 PR Description Format

```
## Summary

Brief description of what was done and why.

## Changes

- Change 1
- Change 2
- Change 3

## Testing

How the changes were tested (build, test suite, manual testing).

## Screenshots / Output

Any relevant test output, screenshots, or terminal logs.

Closes #<issue-number>
```

- The `Closes #<issue-number>` line is **required** — it auto-resolves the issue when the PR is merged
- PR title should be clear and descriptive, matching the commit style

### 4.3 Target Branch

**Always target `<default-branch>`**, never `main` directly (unless `<default-branch>` is `main`). Merges to `main` happen as a separate step controlled by the maintainer.

---

## 5. Review Process

### 5.1 Checking PR Feedback

```bash
# View PR details and general comments
gh pr view <pr-number> --repo <repo> --comments

# List inline review comments
gh api repos/<repo>/pulls/<pr-number>/comments
```

### 5.2 Responding to Review

- Address reviewer comments with **additional commits** on the same branch
- Push new commits — the PR updates automatically
- **Do not force-push** — add commits on top so review history is preserved
- If a rebase is needed, use `git rebase origin <default-branch>` (**never** `git reset --hard`)

---

## 6. After Work Is Complete

### 6.1 Check for New Issues

After finishing a task, scan for open issues:

```bash
gh issue list --repo <repo> --state open --limit 10
```

### 6.2 Continuous Workflow

After completing one issue, move to the next relevant one. This keeps work aligned with the project's GitHub issue tracker.

---

## Quick Reference

| Action | Command |
|--------|---------|
| View issue | `gh issue view <issue-number> --repo <repo>` |
| View issue comments | `gh issue view <issue-number> --repo <repo> --comments` |
| List open issues | `gh issue list --repo <repo> --state open --limit 10` |
| List open PRs | `gh pr list --repo <repo> --state open` |
| View PR | `gh pr view <pr-number> --repo <repo>` |
| View PR comments | `gh pr view <pr-number> --repo <repo> --comments` |
| List review comments | `gh api repos/<repo>/pulls/<pr-number>/comments` |
| Create feature branch | `git checkout -b <branch-name> origin/<default-branch>` |
| Commit | `git add -A && git commit -m "<issue-id>: <commit-title>"` |
| Push | `git push origin <branch-name>` |
| Create PR | `gh pr create --repo <repo> --base <default-branch> --head <branch-name>` |
| Rebase on default branch | `git rebase origin <default-branch>` |
| Authenticate GH CLI | `export GITHUB_TOKEN=<token> && gh auth login --with-token` |

---

## Rules Summary

1. **Use `gh` CLI** for all GitHub access — never WebFetch or raw API calls
2. **Branch from `<default-branch>`**, never from `main` directly (unless it is the default)
3. **Target `<default-branch>`** when opening PRs
4. **Never push to `<default-branch>` or `main`** — git hooks enforce this
5. **Never force push** — add commits on top
6. **Never use `git reset --hard` for rebasing** — use `git rebase origin <default-branch>`
7. **Always push after commit** — no uncommitted changes left behind
8. **Commit format**: `<issue-id>: <commit-title>` with blank line + body paragraph
9. **PR descriptions** must include `Closes #<issue-number>`
10. **Never deploy** to live unless explicitly asked
11. **Always commit lockfile changes** after `npm install` / `pnpm install`

---

## Variables Reference

These placeholders appear throughout the guide. Substitute them with actual values at runtime.

| Variable | Description | How to determine |
|----------|-------------|------------------|
| `<repo>` | The repository in `owner/name` format | Ask user for repo link, or run `gh repo view --json nameWithOwner -q .nameWithOwner` |
| `<issue-number>` | The GitHub issue number (digits only) | Extracted from the issue URL or the issue title the user provides |
| `<issue-id>` | The formatted issue ID for commits (e.g., `GH-234`, `#234`) | Prefix from project convention + issue number |
| `<issue-number-or-keyword>` | Issue number or search keyword for branch lookup | Same as `<issue-number>`, or a partial branch name |
| `<default-branch>` | The base branch for all work (e.g., `dev`) | Check with `git branch -a`: look for `dev`; fallback to `main` |
| `<branch-name>` | Full feature branch name | `feat/issue-<issue-number>-<short-desc>` or `fix/issue-<issue-number>-<short-desc>` |
| `<short-desc>` | 2–4 kebab-case words from the issue title | Derived from issue title (e.g., "Fix autocorrelation normalization bias" → `fix-autocorr-norm`) |
| `<commit-title>` | Short imperative-mood summary | Written by you based on what changed |
| `<commit-body>` | Paragraph explaining what and why | Written by you — describe the change and the reason |
| `<pr-number>` | The pull request number (digits only) | Available after PR creation, or from GitHub |
| `<pr-title>` | Descriptive PR title | Written by you, matching commit style |
| `<pr-body>` | Full PR description with Summary, Changes, Testing sections | Written by you following the template in section 4.2 |
| `<token>` | GitHub Personal Access Token (classic or fine-grained) | Ask the user if `gh` is not authenticated |
