"""DECISIONS 190's re-render: only m-orange's and m-blue's s13, s14 and s15 chunks, with the queue's own
arguments (tools/merc-queue.py jobs()), one at a time through the heavy helper, logged as the queue logs."""
import importlib.util, json, os, subprocess, sys, time
ROOT = sys.argv[1]
spec = importlib.util.spec_from_file_location('mq', os.path.join(ROOT, 'tools', 'merc-queue.py'))
mq = importlib.util.module_from_spec(spec); spec.loader.exec_module(mq)
WANT = ['m-orange-s13', 'm-blue-s13', 'm-orange-s14', 'm-blue-s14', 'm-orange-s15', 'm-blue-s15']
jobs = {o: (p, s, x) for p, s, o, x, n in mq.jobs()}
mq.log(f"{time.strftime('%Y-%m-%d %H:%M:%S')}  DECISIONS 190: rendering only {', '.join(WANT)} (s03 to s12 and m01 unchanged)")
for out_id in WANT:
    path, shot, extra = jobs[out_id]
    t0 = time.time()
    r = subprocess.run([mq.HEAVY, 'node', os.path.join('tools', 'merc-pass.mjs'), os.path.relpath(path, ROOT), *extra], cwd=ROOT)
    side = os.path.join(ROOT, 'assets', 'merc', out_id + '-merc.json')
    if r.returncode or not mq.done(path, shot, out_id):
        mq.log(f"{time.strftime('%Y-%m-%d %H:%M:%S')}  {out_id}: FAILED (exit {r.returncode})"); continue
    s = json.load(open(side))
    mq.log(f"{time.strftime('%Y-%m-%d %H:%M:%S')}  {out_id:14s} frames {s['from']}-{s['to']} ({s['frames']}) at {s['fps']} fps, "
           f"size {s['size']} ({s['drawn'][0]}x{s['drawn'][1]}), {s['msPerFrame']} ms a frame, {s['renderSeconds']} s "
           f"(pre-roll {s['prerollSeconds']} s, waited {time.time() - t0 - s['renderSeconds']:.0f} s), crescent {s['crescentFixed']}")
mq.log(f"{time.strftime('%Y-%m-%d %H:%M:%S')}  DECISIONS 190: finished")
