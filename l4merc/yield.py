#!/usr/bin/env python3
"""Keep the Merc pass workers below the scene builders.

Chrome raises some of its threads to nice -8, so `nice -n 10` on the queue does not reach the
renderer that does the work. Every 15 s this sets every thread of every process descended from a
queue.sh worker to nice 10 (Chrome runs in its own session, so it walks parent links, not
sessions). It exits when no worker is left. Start it detached beside the workers:
  setsid nohup python3 -I yield.py > logs/yield.log 2>&1 < /dev/null &
"""
import os
import time


def procs():
    """{pid: (ppid, argv)} for every process."""
    out = {}
    for p in os.listdir('/proc'):
        if not p.isdigit():
            continue
        try:
            argv = open(f'/proc/{p}/cmdline', 'rb').read().split(b'\0')
            ppid = int(next(l for l in open(f'/proc/{p}/status') if l.startswith('PPid:')).split()[1])
        except (OSError, StopIteration, ValueError):
            continue
        out[int(p)] = (ppid, argv)
    return out


def main():
    while True:
        ps = procs()
        roots = [p for p, (_, a) in ps.items() if len(a) >= 2 and a[0].endswith(b'bash') and a[1] == b'queue.sh']
        if not roots:
            print('no worker left', time.strftime('%H:%M:%S', time.gmtime()), flush=True)
            return
        kids = {}
        for p, (pp, _) in ps.items():
            kids.setdefault(pp, []).append(p)
        todo, seen = list(roots), set()
        while todo:
            p = todo.pop()
            if p in seen:
                continue
            seen.add(p)
            todo.extend(kids.get(p, []))
        moved = 0
        for p in seen:
            try:
                tids = os.listdir(f'/proc/{p}/task')
            except OSError:
                continue
            for t in tids:
                try:
                    if os.getpriority(os.PRIO_PROCESS, int(t)) < 10:
                        os.setpriority(os.PRIO_PROCESS, int(t), 10)
                        moved += 1
                except OSError:
                    pass
        if moved:
            print(f'{time.strftime("%H:%M:%S", time.gmtime())}: {moved} threads to nice 10', flush=True)
        time.sleep(15)


if __name__ == '__main__':
    main()
