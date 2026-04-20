# Claude Code Workflow — GitHub Integration

## GitHub Instructions

### Using GitHub CLI
- Use GH CLI with PAT token stored at `~/.config/gh/hosts.yml`
- Fetch issues and comments:
  ```bash
  gh issue view ISSUE_ID
  gh issue comment ISSUE_ID --body "..."
  gh issue list --state open
  ```

### URL Parsing for Issues
For URLs like `https://github.com/Komediruzecki/pitch-perfect/issues/155`:
1. Extract the numeric ID (155)
2. Use `gh issue view 155` to fetch the issue
3. Use `gh issue comment 155` to add comments

### Closing Issues/PRs
- After fixing an issue and deploying, comment on the GitHub issue to confirm resolution
- Link the GitHub URL in comments for verification

## Code Quality Rules

### Variable Declaration
- Prefer `const` for variables that don't change
- Use `let` when variable needs reassignment
- **Do NOT use `var`** for modern JavaScript/TypeScript

### Variable Scope
- For loops and similar contexts that require changing variables, use `let` (avoid `const`)
- Context determines where each variable belongs

## Branch & PR Workflow

### Branch Naming
- Use meaningful branch names (e.g., `fix/issue-XXX`, `feat/improvements`)

### Before Opening PRs
1. Rebase on `main` branch first
2. Check for npm/build errors
3. Fix CI test failures before opening
4. Verify the PR has no conflicts

### After PR/Merge
- Clean up branches with that issue ID when ticket is closed
- Check if any npm lock/package.json issues exist
- Verify live site version is current (HTML `<script>` tag)

## Deployment Workflow

1. **Build**
   ```bash
   npm run build
   ```

2. **Commit**
   ```bash
   git add -A
   git commit -m "Fix GH #XXX: Brief description"
   ```

3. **Deploy**
   ```bash
   ./deploy.sh
   ```

4. **Comment on GitHub**
   ```bash
   gh issue comment XXX --body "✅ Resolved - [details]"
   ```

## Task Execution Pattern

### Step 1: Check GitHub Issues
```bash
gh issue list --state open
```

### Step 2: Fetch Specific Issue
```bash
gh issue view ISSUE_ID
gh issue view ISSUE_ID --comments
```

### Step 3: Fix & Test
- Read the issue thoroughly
- Plan the implementation
- Make changes
- Run tests/build

### Step 4: Push & Comment
- Commit and push
- Comment on the issue

## Live Site Verification

### Check Live Site Version
```bash
# Check if HTML has v=18 or need to update to v=19
grep "v=18" public/index.html
# Or update to latest version
# grep -i src=".*index.*js" public/index.html
```

### After Deploy
- Visit the live site to verify changes
- Check console for errors
- Test key functionality

## CI/CD Monitoring

### Check for npm errors
- Run build/tests locally before deploying
- Check CI workflow logs for failures
- Fix any failing tests or linting issues

### Common CI Issues
- Missing `package-lock.json`
- TypeScript type errors
- ESLint failures
- Test failures

## UX Improvements

### Process for UX Issues
1. Review `ux-todo.md` for ideas
2. Comment/validate with user
3. Plan implementation
4. Build, test, deploy
5. Close corresponding issue/PR

### UX Todo File
- Location: `/var/www/pitchperfect.clodhost.com/pitch-perfect-repo/ux-todo.md`
- Used for planning user experience improvements