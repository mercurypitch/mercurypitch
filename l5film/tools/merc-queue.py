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

For the final run and for a lab (without these, nothing changes):
  --order=final     the final run's order: first the shortest chunk of each kind as a check that costs
                    minutes (a leap with a talk and a pause, the end card's size and hop, Merc's hops),
                    then scene by scene, Merc's chunk and Tavi's together, so each scene is whole and
                    can be looked at, tagged and joined to the one before while the rest renders
  --plan            the jobs in that order with their frames and the time each should take (the times
                    a frame measured alone on this machine, by drawn size: MS_PER_FRAME), and the total
  --shots=<dir>     the shot files, instead of merc/shots/
  --out=<dir>       the chunks and their sidecars, instead of assets/merc/ (the dumps in <dir>/dump/)
  --log=<file>      the render log, instead of merc/render.log
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
_opt = lambda name, default: next((a[len(name) + 3:] for a in sys.argv[1:] if a.startswith(f'--{name}=')), default)
SHOTS_DIR = os.path.abspath(_opt('shots', os.path.join(ROOT, 'merc', 'shots')))
OUT_ARG = _opt('out', None)
OUT_DIR = os.path.abspath(OUT_ARG) if OUT_ARG else os.path.join(ROOT, 'assets', 'merc')
LOG = os.path.abspath(_opt('log', os.path.join(ROOT, 'merc', 'render.log')))
ORDER = _opt('order', 'longest')
# Milliseconds a frame by drawn square, one render at a time on this machine's four cores, the encode
# in (lab/passes-proto/logs/, 20 November, two rounds: 225 px 189 to 243, the same at 30 and at 60 fps;
# 300 px 333 to 393; 315 px is 300's by its area, and the first queue's 365 to 494): what --plan
# multiplies the frames by.
MS_PER_FRAME = {225: 215, 300: 370, 315: 410}


def jobs():
    out = []
    shots = []
    for path in sorted(glob.glob(os.path.join(SHOTS_DIR, '*.json'))):
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
    if OUT_ARG:
        out = [(p, s, o, extra + ['--out=' + OUT_DIR], n) for p, s, o, extra, n in out]
    if ORDER == 'final':
        out = final_order(out)
    return out


def film_time(job):
    """(the film time a job's first frame shows, Tavi after Merc): scene order, the pair together."""
    path, shot, out_id, extra, n = job
    c = next((c for c in shot.get('chunks', []) if c['id'] == out_id), None)
    return (round(shot['filmStart'] + (c['from'] if c else 0) / shot['fps']) , shot['variant'] != 'blue')


def final_order(todo):
    """The final run's order (see the docstring): the checks first, then scene by scene."""
    by_id = {j[2]: j for j in todo}
    scene = lambda j: next((c['scene'] for c in j[1].get('chunks', []) if c['id'] == j[2]), 's01-cold-open')
    first = []
    # a leap, a talk and a pause; the end card's size and its hop; Merc's hops (the root's x)
    talk = [j for j in todo if j[1]['variant'] == 'blue' and j[1].get('chunks') and any(c['state'] == 'celebrate' for c in j[1]['cues'][:1])]
    if talk:
        first.append(min((j for j in talk if scene(j) == min(scene(x) for x in talk)), key=lambda j: j[4]))
    first += [j for j in todo if scene(j).startswith('s15')]
    hops = [c['t'] for j in todo for c in j[1]['cues'] if c['state'] == 'hop'][:1]
    for j in todo:
        c = next((c for c in j[1].get('chunks', []) if c['id'] == j[2]), None)
        if hops and c and j[1]['variant'] == 'blue' and c['from'] <= hops[0] * j[1]['fps'] <= c['to'] and j not in first:
            first.append(j)
    rest = sorted((j for j in todo if j not in first), key=film_time)
    return first + rest


def done(path, shot, out_id):
    webm = os.path.join(OUT_DIR, out_id + '-merc.webm')
    side = os.path.join(OUT_DIR, out_id + '-merc.json')
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
    if '--plan' in sys.argv:
        total_n = total_s = 0
        print('| # | Chunk | Scene | Frames | Drawn | Estimate |')
        print('| - | ----- | ----- | ------ | ----- | -------- |')
        for k, (path, shot, out_id, extra, n) in enumerate(todo, 1):
            c = next((c for c in shot.get('chunks', []) if c['id'] == out_id), None)
            drawn = round((c['size'] if c else shot['size']) * 0.75)
            sec = n * MS_PER_FRAME.get(drawn, 215 * (drawn / 225) ** 2) / 1000
            total_n, total_s = total_n + n, total_s + sec
            print(f"| {k} | {out_id} | {c['scene'] if c else 's01-cold-open'} | {n} at {shot['fps']} fps | {drawn} px | {sec / 60:.1f} min |")
        print(f'{len(todo)} jobs, {total_n} frames, {total_s / 3600:.2f} hours of rendering alone on the machine')
        return
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
        side = os.path.join(OUT_DIR, out_id + '-merc.json')
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
