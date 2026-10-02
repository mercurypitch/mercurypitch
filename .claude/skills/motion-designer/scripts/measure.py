#!/usr/bin/env python3
"""Measure a render against the motion-designer quality bar.

Standard library only; needs ffmpeg and ffprobe on PATH.

  measure.py render FILM.mp4 --out DIR [--every 0.2] [--low 0.35] [--freeze 0.1] [--noise 16]
  measure.py dense FILM.mp4 --out DIR --at 2.4,7.0 [--window 1.0] [--fps 20]
  measure.py audio FILM.mp4 --music-only MUSIC.mp4 [--out DIR]
  measure.py color FILM.mp4 --at SECONDS --box X,Y,W,H

render writes into DIR:
  summary.md    probe, holds, low-motion runs, single-frame events, loudness
  motion.csv    t, mean and largest luma change against the previous 0.1 s sample (0-255)
  frames.csv    t, mean luma change against the previous frame, at the film's frame rate
  loudness.csv  t, momentary (400 ms) and short-term (3 s) loudness every 0.1 s (LUFS)
  frame-0.png   the first frame at full size; it must be a finished composition
  sheet-NN.jpg  timestamped contact sheets, one frame every --every seconds, 5x5 each

dense writes one timestamped sheet per time in --at: --window seconds centred on
the time, at --fps frames a second. Around a transition make both the default
sheet (1 s at 20 fps) and a frame-exact one (--window 0.5 --fps <film fps>): a
one-frame defect falls between 20 fps samples.

audio compares the full mix with the music-only render of the same cut every
0.1 s: how far the effects lift loudness over the music, in full band and in
the ear-sensitive 2-8 kHz band.

color prints the mean colour of a box at a time as #rrggbb, for checking a
rendered background against a brand token.

A hard hold is a sample where nothing visible changes: the mean change is below
--freeze and no pixel changes by more than --noise, which is encoder noise. A
low-motion run only has a small mean change. On a dark stage a thin line being
drawn or a slow push can read low on the mean while plainly moving, so every
run also reports its largest local change. See references/measurement.md.
"""

import argparse
import csv
import json
import os
import re
import subprocess
import sys

NUMBER = r'(-?[0-9.]+(?:e[-+]?[0-9]+)?|-?inf|nan)'


def run(cmd, check=True):
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if check and proc.returncode != 0:
        sys.stderr.write(proc.stderr[-2000:])
        raise SystemExit(f"command failed: {' '.join(cmd[:4])} ...")
    return proc


def probe(film):
    out = run([
        'ffprobe', '-v', 'error', '-show_entries',
        'stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels:format=duration',
        '-of', 'json', film,
    ]).stdout
    data = json.loads(out)
    info = {'video': {}, 'audio': {}, 'duration': 0.0}
    for stream in data.get('streams', []):
        kind = stream.get('codec_type')
        if kind in info and not info[kind]:
            info[kind] = {k: str(v) for k, v in stream.items()}
    try:
        info['duration'] = float(data.get('format', {}).get('duration', 0))
    except (TypeError, ValueError):
        pass
    return info


def fps_value(rate):
    num, _, den = rate.partition('/')
    try:
        return float(num) / float(den or 1)
    except (ValueError, ZeroDivisionError):
        return 0.0


def motion_samples(film):
    """(t, mean change, largest change) between successive 0.1 s samples."""
    vf = 'fps=10,scale=320:-2,format=gray,tblend=all_mode=difference,signalstats,metadata=print'
    err = run(['ffmpeg', '-hide_banner', '-nostats', '-i', film, '-vf', vf,
               '-an', '-f', 'null', '-']).stderr
    means = [float(v) for v in re.findall(r'signalstats\.YAVG=' + NUMBER, err)]
    peaks = [float(v) for v in re.findall(r'signalstats\.YMAX=' + NUMBER, err)]
    # tblend emits one value per pair, so value i compares sample i+1 with sample i.
    return [((i + 1) / 10.0, m, p) for i, (m, p) in enumerate(zip(means, peaks))]


def runs_where(samples, test):
    """Contiguous runs of samples passing test: (start, length, largest change)."""
    found, current = [], []
    for sample in samples + [None]:
        if sample is not None and test(sample):
            current.append(sample)
            continue
        if current:
            found.append((current[0][0], len(current) / 10.0, max(s[2] for s in current)))
            current = []
    return found


def frame_changes(film):
    """Mean luma change between consecutive frames at the film's own rate."""
    vf = ('scale=320:-2,format=gray,tblend=all_mode=difference,signalstats,'
          'metadata=print:key=lavfi.signalstats.YAVG')
    err = run(['ffmpeg', '-hide_banner', '-nostats', '-i', film, '-vf', vf,
               '-an', '-f', 'null', '-']).stderr
    return [float(v) for v in re.findall(r'signalstats\.YAVG=' + NUMBER, err)]


def single_frame_events(changes, fps, limit=20):
    """Jumps (one frame changes, nothing after) and pops (one frame differs from both neighbours).

    changes[i] is the change from frame i to frame i + 1. A cut is a large jump;
    a whole-pixel snap in a slow move is a small one; a pop is a flash, a
    missing element or a glitch that lasts one frame.
    """
    events = []
    n = len(changes)
    for i in range(1, n - 2):
        window = sorted(changes[max(0, i - 15):i] + changes[i + 2:i + 17])
        base = window[len(window) // 2] if window else 0.0
        floor = max(0.25, 8 * base)
        a, b = changes[i], changes[i + 1]
        before, after = changes[i - 1], changes[i + 2]
        if a > floor and b > floor and 0.5 <= a / b <= 2 and max(before, after) < 0.35 * min(a, b):
            events.append(('pop', (i + 1) / fps, max(a, b)))
        elif a > floor and before < 0.35 * a and b < 0.35 * a:
            events.append(('jump', (i + 1) / fps, a))
    strongest = sorted(events, key=lambda e: e[2], reverse=True)[:limit]
    return sorted(strongest, key=lambda e: e[1]), len(events)


def loudness(film):
    err = run(['ffmpeg', '-hide_banner', '-nostats', '-i', film, '-af',
               'ebur128=peak=true', '-f', 'null', '-'], check=False).stderr
    pattern = re.compile(r't:\s*' + NUMBER + r'\s+TARGET:.*?M:\s*' + NUMBER + r'\s+S:\s*' + NUMBER)
    rows = [(float(m.group(1)), m.group(2), m.group(3)) for m in pattern.finditer(err)]

    def last(regex):
        found = re.findall(regex, err)
        return found[-1] if found else None

    summary = {
        'integrated': last(r'I:\s+' + NUMBER + r' LUFS'),
        'range': last(r'LRA:\s+' + NUMBER + r' LU'),
        'true_peak': last(r'Peak:\s+' + NUMBER + r' dBFS'),
    }
    return rows, summary


def momentary(film, band=None):
    """Momentary loudness every 0.1 s, optionally inside a band (low, high) in Hz."""
    chain = 'ebur128'
    if band:
        low, high = band
        chain = (f'highpass=f={low},highpass=f={low},lowpass=f={high},lowpass=f={high},'
                 'ebur128')
    err = run(['ffmpeg', '-hide_banner', '-nostats', '-i', film, '-af', chain,
               '-f', 'null', '-'], check=False).stderr
    pattern = re.compile(r't:\s*' + NUMBER + r'\s+TARGET:.*?M:\s*' + NUMBER)
    out = {}
    for m in pattern.finditer(err):
        try:
            out[round(float(m.group(1)), 1)] = float(m.group(2))
        except ValueError:
            continue
    return out


def draw_sheets(film, out_pattern, vf_core, tile):
    """Timestamped tiles; falls back to untimestamped when drawtext is unavailable."""
    stamp = ("drawtext=text='%{pts\\:hms}':x=8:y=8:fontsize=18:fontcolor=white:"
             "box=1:boxcolor=black@0.6:boxborderw=4")
    for vf in (f'{vf_core},{stamp},tile={tile}', f'{vf_core},tile={tile}'):
        proc = run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', film,
                    '-vf', vf, '-q:v', '3', out_pattern], check=False)
        if proc.returncode == 0:
            return vf.count('drawtext') > 0
    raise SystemExit('ffmpeg could not write contact sheets')


def cmd_render(args):
    os.makedirs(args.out, exist_ok=True)
    info = probe(args.film)
    duration = info['duration']
    video, audio = info['video'], info['audio']
    fps = fps_value(video.get('r_frame_rate', '0/1')) if video else 0.0

    run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', args.film,
         '-frames:v', '1', os.path.join(args.out, 'frame-0.png')])
    stamped = draw_sheets(args.film, os.path.join(args.out, 'sheet-%02d.jpg'),
                          f'fps=1/{args.every},scale=384:-2', '5x5')

    samples = motion_samples(args.film)
    with open(os.path.join(args.out, 'motion.csv'), 'w', newline='') as fh:
        writer = csv.writer(fh)
        writer.writerow(['t', 'mean_change', 'largest_change'])
        writer.writerows([(f'{t:.1f}', f'{m:.4f}', f'{p:.0f}') for t, m, p in samples])
    changes = frame_changes(args.film)
    with open(os.path.join(args.out, 'frames.csv'), 'w', newline='') as fh:
        writer = csv.writer(fh)
        writer.writerow(['t', 'mean_change'])
        writer.writerows([(f'{(i + 1) / fps:.4f}' if fps else i, f'{c:.5f}')
                          for i, c in enumerate(changes)])

    lines = ['# Measurement', '', f'File: `{args.film}`', '',
             '| Property | Value |', '| --- | --- |',
             f'| Duration | {duration:.3f} s |']
    if video:
        lines.append(f"| Picture | {video.get('width')}x{video.get('height')} {fps:.2f} fps "
                     f"{video.get('codec_name', '')} |")
    lines.append(f"| Audio | {audio.get('codec_name')} {audio.get('sample_rate', '')} Hz "
                 f"{audio.get('channels', '')} ch |" if audio else '| Audio | none |')
    lines.append('')

    ending = samples[-1][0] if samples else 0.0
    per30 = 30.0 / duration if duration else 0.0

    holds = runs_where(samples, lambda s: s[1] < args.freeze and s[2] < args.noise)
    final = [h for h in holds if h[0] + h[1] >= ending - 0.05]
    inside = [h for h in holds if h not in final]
    inside_total = sum(h[1] for h in inside)
    longest = max((h[1] for h in inside), default=0.0)
    lines += ['## Holds', '',
              f'A hold is a 0.1 s sample where the mean change is below {args.freeze} and no '
              f'pixel changes by {args.noise:g} or more. Target: at most about 1 s per 30 s in '
              'total and none longer than about 0.5 s; a hold that runs to the end (the final '
              'call to action) is reported separately and exempt.', '',
              f'**Inside the film:** {inside_total:.1f} s ({inside_total * per30:.1f} s per 30 s), '
              f'longest {longest:.1f} s.',
              f"**Final hold:** {final[0][1]:.1f} s." if final else '**Final hold:** none.', '']
    if holds:
        lines += ['| Starts | Length | Note |', '| --- | --- | --- |']
        for start, length, _ in holds:
            note = 'final hold' if (start, length, _) in final else (
                'longer than 0.5 s' if length > 0.5 else '')
            lines.append(f'| {start:.1f} s | {length:.1f} s | {note} |')
        lines.append('')

    low = runs_where(samples, lambda s: s[1] < args.low)
    listed = [r for r in low if r[1] >= 0.3]
    unlisted = [r for r in low if r[1] < 0.3]
    lines += ['## Low motion', '',
              f'Runs where the mean change is below {args.low}. Not an automatic fail: a critic '
              'looks at each one. A large "largest change" means something small is visibly '
              'moving (a thin line drawing, a small object), which the mean hides.', '']
    if listed:
        lines += ['| Starts | Length | Largest change | Note |', '| --- | --- | --- | --- |']
        for start, length, peak in listed:
            note = 'small element moving' if peak >= 48 else (
                'nothing visible moves' if peak < args.noise else '')
            if start + length >= ending - 0.05:
                note = (note + ', ' if note else '') + 'runs to the end'
            lines.append(f'| {start:.1f} s | {length:.1f} s | {peak:.0f} | {note} |')
        lines.append('')
    lines += [f'{len(unlisted)} shorter run(s) totalling {sum(r[1] for r in unlisted):.1f} s '
              'are not listed; `motion.csv` has every sample.', '']

    events, found = single_frame_events(changes, fps) if fps else ([], 0)
    lines += ['## Single-frame events', '',
              'From every frame at the film\'s own rate. A jump changes once and stays: a large '
              'one is a cut, a small one is usually a whole-pixel snap in a slow move. A pop '
              'differs from both of its neighbours: a flash, a missing element or a one-frame '
              'glitch. Look at each on a frame-exact sheet.', '']
    if events:
        lines += ['| Time | Kind | Change |', '| --- | --- | --- |']
        lines += [f'| {t:.3f} s | {kind} | {size:.2f} |' for kind, t, size in events]
        if found > len(events):
            lines.append(f'\n{found - len(events)} weaker event(s) not listed.')
    else:
        lines.append('None found.')
    lines.append('')

    lines += ['## Loudness', '']
    if audio:
        rows, summary = loudness(args.film)
        with open(os.path.join(args.out, 'loudness.csv'), 'w', newline='') as fh:
            writer = csv.writer(fh)
            writer.writerow(['t', 'momentary_lufs', 'short_term_lufs'])
            writer.writerows(rows)
        lines += [f"Integrated {summary['integrated']} LUFS, loudness range "
                  f"{summary['range']} LU, true peak {summary['true_peak']} dBTP.", '',
                  'Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, '
                  'true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and '
                  'short-term loudness a 3 s window, so the first samples read -120.7 by '
                  'definition. Ignore the loudness range on clips shorter than about 10 s. '
                  'Compare effects with the music using `measure.py audio`.', '']
        per_second = []
        for second in range(1, int(duration) + 1):
            nearest = min(rows, key=lambda row: abs(row[0] - second), default=None)
            if nearest is not None and abs(nearest[0] - second) < 0.06:
                per_second.append(f'{second}s {nearest[2]}')
        lines.append('Short-term per second: ' + ', '.join(per_second))
    else:
        lines.append('No audio stream.')
    lines.append('')

    sheets = sorted(f for f in os.listdir(args.out) if f.startswith('sheet-'))
    lines += ['## Look at these', '',
              '- `frame-0.png`: must be a finished composition.',
              f"- {len(sheets)} contact sheet(s), one frame every {args.every} s"
              f"{', timestamped' if stamped else ''}: " + ', '.join(f'`{s}`' for s in sheets),
              '- Every transition and every single-frame event: `measure.py dense`, at 20 fps '
              'and frame-exact.']
    with open(os.path.join(args.out, 'summary.md'), 'w') as fh:
        fh.write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


def cmd_dense(args):
    os.makedirs(args.out, exist_ok=True)
    stamp = ("drawtext=text='%{pts\\:hms}':x=6:y=6:fontsize=16:fontcolor=white:"
             "box=1:boxcolor=black@0.6:boxborderw=3")
    for raw in args.at.split(','):
        centre = float(raw)
        start = max(0.0, centre - args.window / 2)
        name = os.path.join(args.out, f'dense-{centre:06.2f}s-{args.fps:g}fps.jpg')
        frames = max(1, round(args.window * args.fps))
        cols = 5
        rows = -(-frames // cols)
        base = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{start:.3f}',
                '-t', f'{args.window:.3f}', '-i', args.film, '-frames:v', '1', '-q:v', '3']
        core = f'setpts=PTS+{start:.3f}/TB,fps={args.fps},scale=384:-2'
        ok = False
        for vf in (f'{core},{stamp},tile={cols}x{rows}', f'{core},tile={cols}x{rows}'):
            if run(base + ['-vf', vf, name], check=False).returncode == 0:
                ok = True
                break
        if not ok:
            raise SystemExit(f'could not write {name}')
        print(name)


def cmd_audio(args):
    mix_info, music_info = probe(args.film), probe(args.music_only)
    for label, info in (('film', mix_info), ('music-only', music_info)):
        if not info['audio']:
            raise SystemExit(f'the {label} file has no audio stream')
    lines = ['# Effects against music', '',
             f'Mix: `{args.film}`', f'Music only: `{args.music_only}`', '']
    if abs(mix_info['duration'] - music_info['duration']) > 0.1:
        lines += [f"Warning: durations differ ({mix_info['duration']:.2f} s against "
                  f"{music_info['duration']:.2f} s); the two must be renders of the same cut.", '']

    full_mix, full_music = momentary(args.film), momentary(args.music_only)
    band = (2000, 8000)
    hf_mix, hf_music = momentary(args.film, band), momentary(args.music_only, band)
    # Like the kit's mixer, measure against a floor: over sparse or silent music
    # "+N over the music" would otherwise be undefined or infinite.
    floor = -50.0
    rows = []
    for t in sorted(full_mix):
        m, music = full_mix[t], full_music.get(t)
        hm, hmusic = hf_mix.get(t), hf_music.get(t)
        if music is None or hm is None or hmusic is None:
            continue
        if m <= -70 and music <= -70:
            continue
        rows.append((t, m - max(music, floor), hm - max(hmusic, floor), music <= floor))
    if args.out:
        os.makedirs(args.out, exist_ok=True)
        with open(os.path.join(args.out, 'audio.csv'), 'w', newline='') as fh:
            writer = csv.writer(fh)
            writer.writerow(['t', 'full_band_lift_lu', 'band_2_8khz_lift_db', 'over_silence'])
            writer.writerows([(f'{t:.1f}', '' if f is None else f'{f:.2f}',
                               '' if h is None else f'{h:.2f}', s) for t, f, h, s in rows])

    events, current = [], []
    for row in rows + [(None, None, None, False)]:
        if row[1] is not None and row[1] > 0.5:
            current.append(row)
            continue
        if current:
            events.append((current[0][0], current[-1][0],
                           max(r[1] for r in current), max(r[2] for r in current)))
            current = []
    silent = [r[0] for r in rows if r[3]]
    lines += ['Every 0.1 s, the momentary loudness (400 ms) of the mix minus the music alone, '
              'in full band and in 2-8 kHz, with the music floored at -50 LUFS so a sparse or '
              'silent bed still gives a number. An effect event is a stretch where the mix is '
              'more than 0.5 LU louder than the music. Kit targets (`kit/business-motion-film/'
              'references/audio.md`): effects audible but only a few dB over the music in their '
              'own band, and no more than about 4 dB of lift in 2-8 kHz. Momentary windows '
              'average 400 ms, so a short click reads lower here than its 50 ms peak.', '']
    if events:
        lines += ['| From | To | Full-band lift | 2-8 kHz lift | Note |',
                  '| --- | --- | --- | --- | --- |']
        for start, end, full, hf in events:
            notes = []
            if hf > 4:
                notes.append('harsh: 2-8 kHz lift over 4 dB')
            if full > 6:
                notes.append('effect far above the music')
            lines.append(f'| {start:.1f} s | {end:.1f} s | {full:+.1f} LU | {hf:+.1f} dB | '
                         f'{"; ".join(notes)} |')
    else:
        lines.append('No effect lifts the mix by more than 0.5 LU anywhere: either there are '
                     'no effects, or they are inaudible under the music.')
    if silent:
        lines += ['', f'The music is at or below the floor at {len(silent)} sample(s), from '
                  f'{silent[0]:.1f} s: effects there sit over silence, so check them by ear.']
    text = '\n'.join(lines) + '\n'
    if args.out:
        with open(os.path.join(args.out, 'audio.md'), 'w') as fh:
            fh.write(text)
    print(text)


def cmd_color(args):
    x, y, w, h = (int(v) for v in args.box.split(','))
    raw = subprocess.run(
        ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', str(args.at), '-i', args.film,
         '-frames:v', '1', '-vf', f'crop={w}:{h}:{x}:{y},scale=1:1:flags=area',
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        capture_output=True).stdout
    if len(raw) < 3:
        raise SystemExit('could not sample that box')
    print('#{:02x}{:02x}{:02x}'.format(raw[0], raw[1], raw[2]))


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)

    render = sub.add_parser('render', help='full quality-bar measurement of a render')
    render.add_argument('film')
    render.add_argument('--out', required=True)
    render.add_argument('--every', type=float, default=0.2)
    render.add_argument('--low', type=float, default=0.35)
    render.add_argument('--freeze', type=float, default=0.1)
    render.add_argument('--noise', type=float, default=16)
    render.set_defaults(func=cmd_render)

    dense = sub.add_parser('dense', help='dense sheets around transition times')
    dense.add_argument('film')
    dense.add_argument('--out', required=True)
    dense.add_argument('--at', required=True, help='comma-separated times in seconds')
    dense.add_argument('--window', type=float, default=1.0)
    dense.add_argument('--fps', type=float, default=20)
    dense.set_defaults(func=cmd_dense)

    audio = sub.add_parser('audio', help='effects against the music-only render')
    audio.add_argument('film')
    audio.add_argument('--music-only', required=True)
    audio.add_argument('--out')
    audio.set_defaults(func=cmd_audio)

    color = sub.add_parser('color', help='mean colour of a box at a time')
    color.add_argument('film')
    color.add_argument('--at', type=float, required=True)
    color.add_argument('--box', required=True, help='X,Y,W,H in pixels')
    color.set_defaults(func=cmd_color)

    args = parser.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
