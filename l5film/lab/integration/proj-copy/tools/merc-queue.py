"""Render every Merc pass of the film, one job at a time through the heavy helper, resumably.

  setsid nohup python3 tools/merc-queue.py > merc/queue.out 2>&1 &     the whole queue, detached
  python3 tools/merc-queue.py --list                                    the jobs, in order, and which are done

Jobs: every chunk of every chunked pass, and every pass without chunks, longest pass first (trap 9),
within a pass its longest chunks first. A job is done while its WebM and its sidecar
(assets/merc/<out>-merc.json) are newer than its shot file and the bundle, so a queue stopped by a
container restart (trap 11) picks up where it was. Each chunk also dumps its first three and last
three frames (lab/merc/dump/, merc-pass.mjs --dump): those are the frames it shares with the chunks
on either side, which tools/merc-joins.py compares. Each finished job adds a line to
merc/render.log: frames, size, time a frame, total time.

The heavy helper is $HEAVY, or bin/heavy beside the project. Run detached (setsid nohup): a
session's own background commands stop after two hours.
"""
import glob
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
HEAVY = os.environ.get('HEAVY') or os.path.join(os.path.dirname(ROOT), 'bin', 'heavy')
LOG = os.path.join(ROOT, 'merc', 'render.log')


def jobs():
    out = []
    shots = []
    for path in sorted(glob.glob(os.path.join(ROOT, 'merc', 'shots', '*.json'))):
        shot = json.load(open(path))
        shots.append((round(shot['duration'] * shot['fps']), path, shot))
    for frames, path, shot in sorted(shots, key=lambda s: -s[0]):
        if shot.get('chunks'):
            for c in sorted(shot['chunks'], key=lambda c: -(c['to'] - c['from'])):
                a, b = c['from'], c['to']
                dumps = sorted({a, a + 1, a + 2, b - 2, b - 1, b} & set(range(a, b + 1)))
                out.append((path, shot, c['id'], ['--chunk=' + c['id'], '--dump=' + ','.join(map(str, dumps))], b - a + 1))
        else:
            out.append((path, shot, shot['id'], [], frames))
    return out


def done(path, shot, out_id):
    webm = os.path.join(ROOT, 'assets', 'merc', out_id + '-merc.webm')
    side = os.path.join(ROOT, 'assets', 'merc', out_id + '-merc.json')
    bundle = os.path.join(ROOT, 'assets', 'merc-lib', f"merc-{shot['variant']}.js")
    if not (os.path.exists(webm) and os.path.exists(side)):
        return False
    t = min(os.path.getmtime(webm), os.path.getmtime(side))
    return t > os.path.getmtime(path) and t > os.path.getmtime(bundle)


def log(line):
    with open(LOG, 'a') as f:
        f.write(line + '\n')
    print(line, flush=True)


def main():
    todo = jobs()
    if '--list' in sys.argv:
        for path, shot, out_id, extra, n in todo:
            print(f"{'done' if done(path, shot, out_id) else 'todo'}  {out_id:14s} {n:6d} frames")
        return
    log(f"{time.strftime('%Y-%m-%d %H:%M:%S')}  queue: {sum(not done(p, s, o) for p, s, o, _, _ in todo)} of {len(todo)} jobs to render")
    for path, shot, out_id, extra, n in todo:
        if done(path, shot, out_id):
            continue
        cmd = [HEAVY, 'node', os.path.join('tools', 'merc-pass.mjs'), os.path.relpath(path, ROOT), *extra]
        t0 = time.time()
        r = subprocess.run(cmd, cwd=ROOT)
        side = os.path.join(ROOT, 'assets', 'merc', out_id + '-merc.json')
        if r.returncode or not done(path, shot, out_id):
            log(f"{time.strftime('%Y-%m-%d %H:%M:%S')}  {out_id}: FAILED (exit {r.returncode}) after {time.time() - t0:.0f} s")
            continue
        s = json.load(open(side))
        log(f"{time.strftime('%Y-%m-%d %H:%M:%S')}  {out_id:14s} frames {s['from']}-{s['to']} ({s['frames']}) at {s['fps']} fps, "
            f"size {s['size']} ({s['drawn'][0]}x{s['drawn'][1]}), {s['msPerFrame']} ms a frame, {s['renderSeconds']} s "
            f"(pre-roll {s['prerollSeconds']} s, waited {time.time() - t0 - s['renderSeconds']:.0f} s), crescent {s['crescentFixed']}")
    log(f"{time.strftime('%Y-%m-%d %H:%M:%S')}  queue: finished")


if __name__ == '__main__':
    main()
