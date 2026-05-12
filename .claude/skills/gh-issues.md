# GH Issues Skill

Fetch and manage GitHub issues for the mercury-pitch project.

## Usage

```
/gh-issues [filter]
```

### Filters

- **open** - List open issues (default)
- **all** - List all issues including closed
- **label:** - Filter by label (e.g., `label:bug`, `label:enhancement`)
- **issue:** - Show details of specific issue (e.g., `issue:155`)

### Examples

```
/gh-issues
/gh-issues open
/gh-issues label:bug
/gh-issues issue:155
```

## Implementation

Uses `gh` CLI to fetch issues from the repository.