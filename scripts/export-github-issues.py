#!/usr/bin/env python3
"""
Export GitHub issues (open/closed) to JSON files with comments.
Optionally delete issues from GitHub after confirmation.

Usage:
  python3 scripts/export-github-issues.py                    # Export both open and closed
  python3 scripts/export-github-issues.py --state open       # Export only open
  python3 scripts/export-github-issues.py --delete --state open  # Delete open issues (with confirm)
  python3 scripts/export-github-issues.py --repo owner/repo  # Target a specific repo

Requires: gh CLI (https://cli.github.com) — must be authenticated.
"""

import argparse
import json
import os
import subprocess
import sys


def parse_args():
    parser = argparse.ArgumentParser(
        description="Export (and optionally delete) GitHub issues to JSON files"
    )
    parser.add_argument(
        "--repo",
        help="Repository in OWNER/REPO format (auto-detected from git remote if omitted)",
    )
    parser.add_argument(
        "--out",
        default="./issue-backups",
        help="Output directory for JSON files (default: ./issue-backups)",
    )
    parser.add_argument(
        "--state",
        choices=["open", "closed", "all"],
        help="Export only this state (default: both open and closed separately)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=1000,
        help="Max issues to fetch per state (default: 1000)",
    )
    parser.add_argument(
        "--delete",
        action="store_true",
        help="Delete issues from GitHub. ALWAYS exports backup JSON first, then shows issue list, asks for confirmation, and verifies the backup file exists before deleting anything.",
    )
    return parser.parse_args()


def detect_repo():
    """Detect OWNER/REPO from git remote origin URL."""
    try:
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True,
            text=True,
            check=True,
        )
        url = result.stdout.strip()
        for sep in ("github.com/", "github.com:"):
            if sep in url:
                path = url.split(sep, 1)[1].rstrip("/")
                if path.endswith(".git"):
                    path = path[:-4]
                return path
    except subprocess.CalledProcessError:
        pass
    return None


def run_gh(args):
    """Run gh CLI and return parsed JSON. Exits with message on failure."""
    try:
        result = subprocess.run(
            ["gh"] + args,
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error: gh {' '.join(args)} failed:", file=sys.stderr)
        print(e.stderr.strip(), file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print(
            "gh CLI not found. Install from: https://cli.github.com",
            file=sys.stderr,
        )
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON output: {e}", file=sys.stderr)
        sys.exit(1)


def fetch_issues(repo, state, limit):
    """Fetch all issues for a given state, with normalized fields."""
    print(f"Fetching {state} issues for {repo}...")
    issues = run_gh([
        "issue", "list",
        "--state", state,
        "--limit", str(limit),
        "--json", "number,title,body,author,createdAt,closedAt,state,labels,url",
        "--repo", repo,
    ])

    for issue in issues:
        if isinstance(issue.get("author"), dict):
            issue["author"] = issue["author"].get("login", "unknown")
        if isinstance(issue.get("labels"), list):
            issue["labels"] = [l["name"] if isinstance(l, dict) else l for l in issue["labels"]]

    print(f"  Found {len(issues)} {state} issues")
    return issues


def fetch_comments(repo, issue_number):
    """Fetch comments for a specific issue, with normalized fields."""
    result = run_gh([
        "issue", "view", str(issue_number),
        "--comments",
        "--json", "comments",
        "--repo", repo,
    ])
    comments = result.get("comments", [])

    for comment in comments:
        if isinstance(comment.get("author"), dict):
            comment["author"] = comment["author"].get("login", "unknown")
        for key in list(comment.keys()):
            if key not in ("author", "body", "createdAt"):
                del comment[key]

    return comments


def verify_backup(filepath, expected_count):
    """Verify a backup file exists and contains the expected number of issues."""
    if not os.path.exists(filepath):
        print(f"SAFETY CHECK FAILED: Backup file {filepath} does not exist.")
        return False
    try:
        with open(filepath) as f:
            data = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"SAFETY CHECK FAILED: Cannot read backup file: {e}")
        return False
    if not isinstance(data, list) or len(data) != expected_count:
        print(f"SAFETY CHECK FAILED: Backup has {len(data) if isinstance(data, list) else '?'} issues, expected {expected_count}.")
        return False
    return True


def delete_issues(repo, issues, backup_filepath):
    """Delete a list of issues from GitHub after user confirmation.

    Always verifies the backup file exists and contains the expected
    number of issues before proceeding. Prints a summary table first,
    then asks for interactive confirmation. Only proceeds if user
    types 'yes' exactly.
    """
    if not issues:
        print("No issues to delete.")
        return

    # Safety: verify backup exists before even showing confirmation
    if not verify_backup(backup_filepath, len(issues)):
        print("Delete aborted — backup verification failed. Issues were NOT deleted.", file=sys.stderr)
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  DELETE CONFIRMATION — {len(issues)} issue(s) from {repo}")
    print(f"{'='*60}")
    print(f"{'#':<6} {'Title':<40} {'State':<10}")
    print(f"{'-'*6} {'-'*40} {'-'*10}")
    for issue in issues:
        title = issue["title"][:38] + ".." if len(issue["title"]) > 40 else issue["title"]
        print(f"#{issue['number']:<5} {title:<40} {issue['state']:<10}")
    print(f"{'='*60}")

    try:
        answer = input(f"\nType 'yes' to permanently delete these {len(issues)} issues: ")
    except (KeyboardInterrupt, EOFError):
        print("\nAborted.")
        return

    if answer.strip() != "yes":
        print("Aborted — issues were NOT deleted.")
        return

    print(f"\nDeleting {len(issues)} issues...")
    failed = 0
    for i, issue in enumerate(issues):
        num = issue["number"]
        try:
            subprocess.run(
                ["gh", "issue", "delete", str(num), "--repo", repo, "--yes"],
                capture_output=True,
                text=True,
                check=True,
            )
            print(f"  [{i+1}/{len(issues)}] Deleted #{num}")
        except subprocess.CalledProcessError as e:
            print(f"  [{i+1}/{len(issues)}] FAILED to delete #{num}: {e.stderr.strip()}", file=sys.stderr)
            failed += 1

    print(f"Deleted {len(issues) - failed}/{len(issues)} issues.")


def export_issues(repo, state, out_dir, limit, do_delete):
    """Export issues for a given state, enriched with comments."""
    issues = fetch_issues(repo, state, limit)

    # Enrich with comments
    for i, issue in enumerate(issues):
        num = issue["number"]
        print(f"  [{i+1}/{len(issues)}] Fetching comments for issue #{num}...")
        issue["comments"] = fetch_comments(repo, num)

    # Write JSON
    os.makedirs(out_dir, exist_ok=True)
    filename = f"issues-{state}.json"
    filepath = os.path.join(out_dir, filename)
    with open(filepath, "w") as f:
        json.dump(issues, f, indent=2, ensure_ascii=False)

    print(f"  Wrote {len(issues)} issues to {filepath}")

    if do_delete:
        delete_issues(repo, issues, filepath)

    return len(issues)


def main():
    args = parse_args()

    repo = args.repo or detect_repo()
    if not repo:
        print(
            "Could not detect repo. Use --repo OWNER/REPO or run from a git repo.",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Repo:    {repo}")
    print(f"Output:  {args.out}")
    if args.delete:
        print(f"Delete:  YES (will ask for confirmation)")

    if args.state:
        export_issues(repo, args.state, args.out, args.limit, args.delete)
    else:
        total = 0
        for state in ["open", "closed"]:
            total += export_issues(repo, state, args.out, args.limit, args.delete)
        print(f"\nDone. Exported {total} issues total.")

    print(f"JSON files in: {os.path.abspath(args.out)}")


if __name__ == "__main__":
    main()
