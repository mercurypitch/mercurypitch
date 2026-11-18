#!/usr/bin/env python3
# GIT_SEQUENCE_EDITOR for an autosquash rebase: drop the commits named in
# SEQ_DROP, and after the last fixup of each commit named in SEQ_MSG
# ("sha=file,sha=file") amend that commit's message from the file.
import os, sys
todo = sys.argv[1]
drop = [s for s in os.environ.get('SEQ_DROP', '').split(',') if s]
msgs = dict(kv.split('=', 1) for kv in os.environ.get('SEQ_MSG', '').split(',') if kv)
def same(a, b): return a.startswith(b) or b.startswith(a)
lines = open(todo).read().splitlines()
out, current = [], None
def flush():
    if current is not None:
        out.append('exec git commit --amend -q --no-verify -F ' + msgs[current])
for ln in lines:
    parts = ln.split()
    if len(parts) >= 2 and parts[0] in ('pick', 'p', 'fixup', 'f', 'squash', 's'):
        h = parts[1]
        if parts[0] in ('pick', 'p'):
            flush(); current = None
            if any(same(h, d) for d in drop):
                out.append('drop ' + ' '.join(parts[1:])); continue
            for k in msgs:
                if same(h, k): current = k
        out.append(ln); continue
    if ln.strip() and not ln.startswith('#'):
        flush(); current = None
    out.append(ln)
flush()
open(todo, 'w').write('\n'.join(out) + '\n')
