#!/usr/bin/env python3
"""Is a backup branch's work on main? Read-only.

For each file the branch changed against its merge-base with origin/main:
  exact   : the branch tip's version of the file is a version main has had
            at that path (same blob at some commit on main);
  lines   : else, every meaningful line the branch added is in some version
            of the file main has had (so the work landed, and moved on);
  missing : else, the lines main never had at that path, listed.
A file the branch deleted counts as landed when main has no such file now.
Usage: check.py <branch> [<branch> ...]   (names without origin/)
"""
import re
import subprocess
import sys

REPO = "/home/user/mercurypitch"


def git(*args, check=True):
    r = subprocess.run(["git", "-C", REPO, *args], capture_output=True, text=True, errors="replace")
    if check and r.returncode != 0:
        raise SystemExit(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout


def blobs_on_main(path):
    """Every blob main has had at `path`."""
    out = git("log", "--format=", "--raw", "--no-abbrev", "--full-history", "origin/main", "--", path)
    shas = set()
    for line in out.splitlines():
        if not line.startswith(":"):
            continue
        parts = line.split()
        dst = parts[3]
        if set(dst) != {"0"}:
            shas.add(dst)
    return shas


def meaningful(line):
    s = line.strip()
    # braces, lone keywords and blank lines say nothing about whose work it is
    return s if len(s) >= 12 else None


def loose(line):
    """A line with its citations and numbers taken out: plans re-anchor both when a branch lands."""
    return re.sub(r"\s+", " ", re.sub(r"\d+", "", re.sub(r"`[^`]*`", "", line))).strip()


GENERATED = {"docs/agent/INDEX.md"}


def main(branches):
    for b in branches:
        tip = git("rev-parse", f"origin/{b}").strip()
        mb = git("merge-base", "origin/main", tip).strip()
        status = [l.split("\t") for l in git("diff", "--name-status", "--no-renames", mb, tip).splitlines()]
        exact = lines_ok = loose_ok = generated = 0
        gone_ok = 0
        problems = []
        for st, path in ((s[0], s[-1]) for s in status):
            if path in GENERATED:
                generated += 1
                continue
            if st == "D":
                on_main = subprocess.run(["git", "-C", REPO, "cat-file", "-e", f"origin/main:{path}"], capture_output=True).returncode == 0
                if on_main:
                    problems.append((path, "deleted on the branch, still on main", []))
                else:
                    gone_ok += 1
                continue
            blob = git("rev-parse", f"{tip}:{path}").strip()
            hist = blobs_on_main(path)
            if blob in hist:
                exact += 1
                continue
            added = []
            for l in git("diff", "-U0", "--no-renames", mb, tip, "--", path).splitlines():
                if l.startswith("+") and not l.startswith("+++"):
                    m = meaningful(l[1:])
                    if m:
                        added.append(m)
            corpus = set()
            for h in hist:
                for l in git("cat-file", "-p", h, check=False).splitlines():
                    corpus.add(l.strip())
            miss = [l for l in added if l not in corpus]
            if miss and path.startswith("docs/"):
                loose_corpus = {loose(l) for l in corpus}
                still = [l for l in miss if loose(l) not in loose_corpus]
                if not still:
                    loose_ok += 1
                    continue
                miss = still
            if not miss:
                lines_ok += 1
            else:
                why = "never on main at this path" if not hist else f"{len(miss)} of {len(added)} added lines never on main here"
                problems.append((path, why, miss[:int(__import__("os").environ.get("SHOW", "3"))]))
        n = len(status)
        verdict = "LANDED" if not problems else "CHECK"
        print(f"== {b} {tip[:9]}: {n} files: {exact} exact, {lines_ok} by lines, {loose_ok} docs by lines bar citations and numbers, {gone_ok} deletions landed, {generated} generated, {len(problems)} to check -> {verdict}")
        for path, why, sample in problems:
            print(f"   {path}: {why}")
            for s in sample:
                print(f"       + {s[:110]}")


if __name__ == "__main__":
    main(sys.argv[1:])
