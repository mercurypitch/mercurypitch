#!/usr/bin/env python3
"""Measure a render against the motion-designer quality bar.

Standard library only; needs ffmpeg and ffprobe on PATH.

  measure.py render FILM.mp4 --out DIR [--every 0.2] [--low 0.35] [--freeze 0.1] [--noise 16] [--changed 24]
  measure.py dense FILM.mp4 --out DIR --at 2.4,7.0 [--window 1.0] [--fps 20]
  measure.py audio FILM.mp4 --music-only MUSIC.mp4 [--out DIR]
  measure.py color FILM.mp4 --at SECONDS --box X,Y,W,H

render writes into DIR:
  summary.md      probe, holds, low-motion runs, single-frame events, loop seam, loudness
  motion.csv      t, mean and largest luma change against the previous 0.1 s sample (0-255)
  frames.csv      t, mean luma change and share of pixels changed against the previous frame
  events.csv      every single-frame event, not only the strongest listed in summary.md
  loudness.csv    t, momentary (400 ms) and short-term (3 s) loudness every 0.1 s (LUFS)
  frame-0.png     the first frame at full size; it must be a finished composition
  frame-last.png  the last frame at full size: the end card, and one side of the loop seam
  sheet-NN.jpg    contact sheets, one frame every --every seconds, 5x5 each

Every tile on a sheet is a real frame of the film, picked rather than resampled,
and stamped with that frame's own time. (Resampling with ffmpeg's fps filter
stamps the output time instead, which reads up to half a sample early.)

dense writes one sheet per time in --at: --window seconds centred on the time,
at --fps frames a second (every Nth frame of the film; the name says the rate
actually used). Around a transition make both the default sheet (1 s at 20 fps)
and a frame-exact one (--fps <film fps>, --window as long as the transition): a
one-frame defect falls between 20 fps samples.

audio compares the full mix with the music-only render of the same cut. It finds
each effect, estimates the effect's own frequency band, and measures what the
kit checks there: the 50 ms in-band peak and the 150 ms in-band body over the
music, the lift in the ear-sensitive 2-8 kHz band, and the sample-peak lift. It
also reports the 400 ms momentary loudness lift.

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
import math
import os
import re
import subprocess
import sys

NUMBER = r'(-?[0-9.]+(?:e[-+]?[0-9]+)?|-?inf|nan)'
SHEET_STAMP = ("drawtext=text='%{pts\\:hms}':x=8:y=8:fontsize=18:fontcolor=white:"
               "box=1:boxcolor=black@0.6:boxborderw=4")
DENSE_STAMP = ("drawtext=text='%{pts\\:hms}':x=6:y=6:fontsize=16:fontcolor=white:"
               "box=1:boxcolor=black@0.6:boxborderw=3")

SR = 48000
CHUNK = 0.025          # audio is measured in 25 ms chunks: 50 ms windows are two, 150 ms six
OCTAVES = (63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000)
FLOOR = -50.0          # in-band music peak floor in dBFS (the kit's MFLOOR and HFLOOR)
PEAK_FLOOR = -20.0     # local music sample-peak floor in dBFS (the kit's PKFLOOR)


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


def metadata_records(stderr):
    """What each metadata or ametadata filter printed, in graph order: [[(pts_time, {key: value})]]."""
    records = {}
    for m in re.finditer(r'\[Parsed_a?metadata_(\d+) @ [^\]]+\] (.*)', stderr):
        frames = records.setdefault(int(m.group(1)), [])
        text = m.group(2)
        stamp = re.search(r'pts_time:' + NUMBER, text)
        if stamp:
            frames.append((float(stamp.group(1)), {}))
        elif frames and '=' in text:
            key, _, value = text.partition('=')
            try:
                frames[-1][1][key.strip()] = float(value)
            except ValueError:
                continue
    return [records[k] for k in sorted(records)]


def every_nth(fps, step):
    """Pick every Nth frame to sample about every step seconds; returns N and the real step."""
    if not fps:
        return 0, step
    n = max(1, round(step * fps))
    return n, n / fps


def motion_samples(film, fps):
    """(t, mean change, largest change) between successive samples about 0.1 s apart.

    t is the time of the later frame of each pair, read from the frame itself.
    """
    n, _ = every_nth(fps, 0.1)
    pick = f"select='not(mod(n\\,{n}))'" if n else 'fps=10'
    vf = f'{pick},scale=320:-2,format=gray,tblend=all_mode=difference,signalstats,metadata=print'
    err = run(['ffmpeg', '-hide_banner', '-nostats', '-i', film, '-vf', vf,
               '-an', '-f', 'null', '-']).stderr
    frames = (metadata_records(err) or [[]])[0]
    return [(t, v.get('lavfi.signalstats.YAVG', 0.0), v.get('lavfi.signalstats.YMAX', 0.0))
            for t, v in frames]


def runs_where(samples, test, step):
    """Contiguous runs of samples passing test: (start, length, largest change)."""
    found, current = [], []
    for sample in samples + [None]:
        if sample is not None and test(sample):
            current.append(sample)
            continue
        if current:
            # Each sample compares a frame with the one step earlier, where the run starts.
            found.append((current[0][0] - step, len(current) * step,
                          max(s[2] for s in current)))
            current = []
    return found


def frame_changes(film, changed):
    """Per pair of consecutive frames: the mean luma change at 320 px wide, and the share of
    pixels at 960 px wide that change by more than `changed` on the 0-255 scale."""
    graph = ('[0:v]split[a][b];'
             '[a]scale=320:-2,format=gray,tblend=all_mode=difference,signalstats,'
             'metadata=print:key=lavfi.signalstats.YAVG[x];'
             '[b]scale=960:-2,format=gray,tblend=all_mode=difference,'
             f"lut=y='if(gt(val\\,{changed:g})\\,255\\,0)',signalstats,"
             'metadata=print:key=lavfi.signalstats.YAVG[y]')
    err = run(['ffmpeg', '-hide_banner', '-nostats', '-i', film, '-filter_complex', graph,
               '-map', '[x]', '-f', 'null', '-', '-map', '[y]', '-f', 'null', '-']).stderr
    records = metadata_records(err)
    if len(records) < 2:
        return [], []
    mean, share = records[0], records[1]
    return ([v.get('lavfi.signalstats.YAVG', 0.0) for _, v in mean],
            [v.get('lavfi.signalstats.YAVG', 0.0) / 255 for _, v in share])


def single_frame_events(share, mean, fps, floor=0.0003, ratio=3.0):
    """Jumps (one frame changes, nothing after) and pops (one frame differs from both neighbours).

    share[i] is the share of pixels that change from frame i to frame i + 1. A
    jump changes at least `ratio` times as many pixels as the changes either side
    of it; a pop is two such changes in a row. Comparing with the immediate
    neighbours, not a wider median, treats equal snaps equally: a slow move that
    snaps whole pixels gives a run of equal jumps. A cut is a large jump; a
    whole-pixel snap in a slow move is a small one; a pop is a flash, a missing
    element or a glitch that lasts one frame.
    """
    events, n, skip = [], len(share), -1

    def at(i):
        return share[i] if 0 <= i < n else 0.0

    for i in range(n):
        if i == skip:
            continue
        a, b, before, after = share[i], at(i + 1), at(i - 1), at(i + 2)
        if a >= floor and b >= floor and 0.5 <= a / b <= 2 and ratio * max(before, after) <= min(a, b):
            events.append(('pop', (i + 1) / fps, max(mean[i], mean[i + 1]), max(a, b)))
            skip = i + 1
        elif a >= floor and ratio * max(before, b) <= a:
            events.append(('jump', (i + 1) / fps, mean[i], a))
    return events


def loop_seam(film, frames):
    """Mean luma change from the last frame back to the first, on the 320 px scale of frames.csv."""
    graph = (f"[0:v]select='eq(n\\,{frames - 1})',setpts=0,scale=320:-2,format=gray[last];"
             "[1:v]select='eq(n\\,0)',setpts=0,scale=320:-2,format=gray[first];"
             '[last][first]blend=all_mode=difference,signalstats,'
             'metadata=print:key=lavfi.signalstats.YAVG')
    err = run(['ffmpeg', '-hide_banner', '-nostats', '-i', film, '-i', film,
               '-filter_complex', graph, '-an', '-f', 'null', '-'], check=False).stderr
    records = metadata_records(err)
    if not records or not records[0]:
        return None
    return records[0][-1][1].get('lavfi.signalstats.YAVG')


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


def band_filter(low, high):
    """Fourth-order Butterworth high-pass at low and low-pass at high, two biquads each."""
    parts = [f'highpass=f={low:.1f}:t=q:w={q}' for q in (0.5412, 1.3066) if low]
    parts += [f'lowpass=f={high:.1f}:t=q:w={q}' for q in (0.5412, 1.3066) if high]
    return ','.join(parts) or 'anull'


def band_levels(film, bands, start=None, length=None):
    """Mono power and sample peak in each band, every 25 ms: (times, [[power]], [[peak]]).

    Power is the mean square relative to full scale, peak the largest sample. One
    ffmpeg pass splits the audio, filters each band and measures each chunk.
    """
    seek = ['-ss', f'{start:.3f}', '-t', f'{length:.3f}'] if start is not None else []
    graph = (f'[0:a]aresample={SR},aformat=sample_fmts=flt:channel_layouts=mono,'
             f'asplit={len(bands)}' + ''.join(f'[i{k}]' for k in range(len(bands))) + ';')
    graph += ';'.join(
        f'[i{k}]{band_filter(low, high)},asetnsamples=n={int(SR * CHUNK)}:p=0,'
        'astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=RMS_level+Peak_level,'
        f'ametadata=print[o{k}]' for k, (low, high) in enumerate(bands))
    cmd = ['ffmpeg', '-hide_banner', '-nostats', *seek, '-i', film, '-filter_complex', graph]
    for k in range(len(bands)):
        cmd += ['-map', f'[o{k}]', '-f', 'null', '-']
    records = metadata_records(run(cmd).stderr)
    offset = start or 0.0
    times = [offset + t for t, _ in records[0]] if records else []
    power = [[10 ** (v.get('lavfi.astats.Overall.RMS_level', -math.inf) / 10) for _, v in band]
             for band in records]
    peak = [[10 ** (v.get('lavfi.astats.Overall.Peak_level', -math.inf) / 20) for _, v in band]
            for band in records]
    return times, power, peak


def db(value, floor=-120.0):
    return 10 * math.log10(value) if value > 10 ** (floor / 10) else floor


def windows(series, size):
    """Mean of each run of `size` consecutive chunks, by start chunk."""
    return [sum(series[i:i + size]) / size for i in range(max(0, len(series) - size + 1))]


def find_effects(film, music_only):
    """Stretches where the mix carries more than the music in some octave band, 50 ms at a time.

    Returns [(start, end, (low, high))]: each effect with its own band, the octaves
    holding the middle 60 per cent of its energy over the music (the kit takes the
    20th to 80th percentile of the effect's spectrum).
    """
    bands = [(c / math.sqrt(2), min(c * math.sqrt(2), SR / 2 - 500)) for c in OCTAVES]
    times, mix, _ = band_levels(film, bands)
    _, music, _ = band_levels(music_only, bands)
    count = min(len(times), *(len(b) for b in mix + music)) - 1
    floor = 10 ** (-60 / 10)
    present = []
    for i in range(count):
        lift = max(db((mix[b][i] + mix[b][i + 1]) / 2) - db(max((music[b][i] + music[b][i + 1]) / 2, floor))
                   for b in range(len(bands)))
        present.append(lift > 1.5)
    spans, start, gap = [], None, 0
    for i, on in enumerate(present + [False] * 5):
        if on:
            start, gap = (i if start is None else start), 0
        elif start is not None:
            gap += 1
            if gap > 4:     # a 100 ms gap ends an effect
                spans.append((start, i - gap))
                start, gap = None, 0
    effects = []
    for first, last in spans:
        if last - first < 1:
            continue
        excess = [sum(max(mix[b][i] - music[b][i], 0.0) for i in range(first, last + 2))
                  for b in range(len(bands))]
        total = sum(excess)
        if total <= 0:
            continue
        edges, running = [], 0.0
        for target in (0.2, 0.8):
            running, edge = 0.0, bands[-1][1]
            for (low, high), part in zip(bands, excess):
                if running + part >= target * total and part > 0:
                    edge = low * (high / low) ** ((target * total - running) / part)
                    break
                running += part
            edges.append(edge)
        low = max(edges[0], 60.0)
        high = min(max(edges[1], 2 * low), SR / 2 - 500)
        effects.append((times[first], times[last] + 2 * CHUNK, (low, high)))
    return effects


def effect_levels(film, music_only, start, end, band):
    """The kit's per-effect numbers, mix against music, inside the effect's band."""
    lead = 0.05
    seek, length = max(0.0, start - lead), end - start + 2 * lead
    bands = [band, (2000, 8000), (None, None)]
    _, mix, mix_peak = band_levels(film, bands, seek, length)
    _, music, music_peak = band_levels(music_only, bands, seek, length)
    count = min(len(s) for s in mix + music)
    (mix_band, mix_hf, _), (music_band, music_hf, _) = ([s[:count] for s in mix], [s[:count] for s in music])

    def peak(series):
        return max(db(v) for v in windows(series, 2)) if count >= 2 else -120.0

    in_band = peak(mix_band) - max(peak(music_band), FLOOR)
    hf = peak(mix_hf) - max(peak(music_hf), FLOOR)
    body_windows = windows(mix_band, 6) or [sum(mix_band) / max(1, count)]
    loudest = max(range(len(body_windows)), key=body_windows.__getitem__)
    music_body = windows(music_band, 6)[loudest] if count >= 6 else sum(music_band) / max(1, count)
    body = db(body_windows[loudest]) - max(db(music_body), FLOOR)
    sample_peak = 20 * math.log10(max(mix_peak[2][:count] or [1e-9]) + 1e-9)
    music_sample_peak = 20 * math.log10(max(music_peak[2][:count] or [1e-9]) + 1e-9)
    return {
        'in_band': in_band, 'body': body, 'hf': hf,
        'peak': sample_peak - max(music_sample_peak, PEAK_FLOOR),
        'over_silence': peak(music_band) <= FLOOR,
    }


def write_sheets(film, out, picked, stamp, tile, seek=(), extra=()):
    """Tile picked frames, each stamped with its own time.

    Frames are chosen with select and never resampled, so every tile is a real
    frame and the time printed on it is that frame's time. passthrough stops ffmpeg
    repeating whole sheets to fill a constant frame rate. Falls back to unstamped
    tiles when this ffmpeg has no drawtext.
    """
    for sync in (['-fps_mode', 'passthrough'], ['-vsync', 'passthrough']):
        for vf in (f'{picked},{stamp},tile={tile}', f'{picked},tile={tile}'):
            proc = run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *seek, '-i', film,
                        *sync, '-vf', vf, *extra, '-q:v', '3', out], check=False)
            if proc.returncode == 0:
                return 'drawtext' in vf
    raise SystemExit(f'ffmpeg could not write {out}')


def cmd_render(args):
    os.makedirs(args.out, exist_ok=True)
    info = probe(args.film)
    duration = info['duration']
    video, audio = info['video'], info['audio']
    fps = fps_value(video.get('r_frame_rate', '0/1')) if video else 0.0

    run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', args.film,
         '-frames:v', '1', os.path.join(args.out, 'frame-0.png')])
    run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-sseof', '-1', '-i', args.film,
         '-update', '1', os.path.join(args.out, 'frame-last.png')], check=False)
    nth, every = every_nth(fps, args.every)
    picked = (f"select='not(mod(n\\,{nth}))'" if nth else f'fps=1/{args.every}') + ',scale=384:-2'
    stamped = write_sheets(args.film, os.path.join(args.out, 'sheet-%02d.jpg'), picked,
                           SHEET_STAMP, '5x5')

    samples = motion_samples(args.film, fps)
    _, step = every_nth(fps, 0.1)
    with open(os.path.join(args.out, 'motion.csv'), 'w', newline='') as fh:
        writer = csv.writer(fh)
        writer.writerow(['t', 'mean_change', 'largest_change'])
        writer.writerows([(f'{t:.3f}', f'{m:.4f}', f'{p:.0f}') for t, m, p in samples])
    changes, share = frame_changes(args.film, args.changed)
    with open(os.path.join(args.out, 'frames.csv'), 'w', newline='') as fh:
        writer = csv.writer(fh)
        writer.writerow(['t', 'mean_change', 'changed_share'])
        writer.writerows([(f'{(i + 1) / fps:.4f}' if fps else i, f'{c:.5f}', f'{s:.6f}')
                          for i, (c, s) in enumerate(zip(changes, share))])

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

    holds = runs_where(samples, lambda s: s[1] < args.freeze and s[2] < args.noise, step)
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
            lines.append(f'| {start:.2f} s | {length:.1f} s | {note} |')
        lines.append('')

    low = runs_where(samples, lambda s: s[1] < args.low, step)
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
            lines.append(f'| {start:.2f} s | {length:.1f} s | {peak:.0f} | {note} |')
        lines.append('')
    lines += [f'{len(unlisted)} shorter run(s) totalling {sum(r[1] for r in unlisted):.1f} s '
              'are not listed; `motion.csv` has every sample.', '']

    events = single_frame_events(share, changes, fps) if fps and share else []
    with open(os.path.join(args.out, 'events.csv'), 'w', newline='') as fh:
        writer = csv.writer(fh)
        writer.writerow(['t', 'kind', 'mean_change', 'changed_share'])
        writer.writerows([(f'{t:.4f}', kind, f'{size:.3f}', f'{part:.5f}')
                          for kind, t, size, part in events])
    strongest = sorted(sorted(events, key=lambda e: e[3], reverse=True)[:20], key=lambda e: e[1])
    lines += ['## Single-frame events', '',
              'From every frame at the film\'s own rate, by the share of pixels that change '
              f'by more than {args.changed:g} (at 960 px wide) against the changes either side. A '
              'jump changes once and stays: a large one is a cut, a small one is usually a '
              'whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop '
              'differs from both of its neighbours: a flash, a missing element or a one-frame '
              'glitch. Look at each on a frame-exact sheet.', '']
    if strongest:
        lines += ['| Time | Kind | Mean change | Pixels changed |', '| --- | --- | --- | --- |']
        lines += [f'| {t:.3f} s | {kind} | {size:.2f} | {part * 100:.2f}% |'
                  for kind, t, size, part in strongest]
        if len(events) > len(strongest):
            lines.append(f'\n{len(events) - len(strongest)} weaker event(s) are in `events.csv`.')
    else:
        lines.append('None found.')
    lines.append('')

    seam = loop_seam(args.film, len(changes) + 1) if changes else None
    lines += ['## Loop seam', '']
    if seam is None:
        lines.append('Not measured.')
    else:
        ordered = sorted(changes)
        median, p95 = ordered[len(ordered) // 2], ordered[int(len(ordered) * 0.95)]
        biggest = max(range(len(changes)), key=changes.__getitem__)
        verdict = ('rejoins like an ordinary frame' if seam <= max(2 * p95, 0.5)
                   else 'reads as a jump')
        lines += [f'From the last frame back to the first: {seam:.2f} on the scale of '
                  f'`frames.csv`, against a median frame change of {median:.3f}, a 95th '
                  f'percentile of {p95:.2f} and a largest of {changes[biggest]:.2f} at '
                  f'{(biggest + 1) / fps:.3f} s. If the film plays on a loop (feeds, landing '
                  f'pages, README embeds), the seam {verdict}. Compare `frame-last.png` with '
                  '`frame-0.png`; ignore this for a film that never loops.']
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
              '- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.',
              f"- {len(sheets)} contact sheet(s), one frame every {every:g} s"
              f"{', each stamped with its own time' if stamped else ''}: "
              + ', '.join(f'`{s}`' for s in sheets),
              '- Every transition and every single-frame event: `measure.py dense`, at 20 fps '
              'and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).']
    with open(os.path.join(args.out, 'summary.md'), 'w') as fh:
        fh.write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


def cmd_dense(args):
    os.makedirs(args.out, exist_ok=True)
    info = probe(args.film)
    fps = fps_value(info['video'].get('r_frame_rate', '0/1')) if info['video'] else 0.0
    if not fps:
        raise SystemExit('no video stream with a frame rate')
    nth = max(1, round(fps / args.fps))
    rate = fps / nth
    if abs(rate - args.fps) > 0.01:
        print(f'{args.fps:g} fps is not a whole fraction of {fps:g} fps: using every {nth}. '
              f'frame ({rate:g} fps)')
    for raw in args.at.split(','):
        centre = float(raw)
        first = max(0, round((centre - args.window / 2) * fps))
        count = max(1, round(args.window * fps))
        # Seek a quarter frame early so the first frame of the window is frame `first`,
        # then put each frame's own time back before it is stamped.
        seek = max(0.0, (first - 0.25) / fps)
        tiles = -(-count // nth)
        cols = 5
        rows = -(-tiles // cols)
        name = os.path.join(args.out, f'dense-{centre:06.2f}s-{rate:g}fps.jpg')
        picked = (f"setpts=PTS+{seek:.6f}/TB,select='not(mod(n\\,{nth}))',scale=384:-2")
        write_sheets(args.film, name, picked, DENSE_STAMP, f'{cols}x{rows}',
                     seek=['-ss', f'{seek:.6f}', '-t', f'{count / fps:.6f}'],
                     extra=['-frames:v', '1'])
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

    effects = find_effects(args.film, args.music_only)
    measured = [(start, end, band, effect_levels(args.film, args.music_only, start, end, band))
                for start, end, band in effects]
    lines += ['## Effects in their own band', '',
              'Each effect is found where the mix carries more than the music in some octave, '
              '50 ms at a time. Its band holds the middle 60 per cent of its energy over the '
              'music. Inside that band, as the kit measures: the loudest 50 ms of the mix over '
              'the loudest 50 ms of the music (target about +3 to +4 dB; a whoosh +2 to +3 dB), '
              'and the body, the loudest 150 ms of the mix over the music in the same 150 ms. '
              'Then the 50 ms lift in 2-8 kHz (at most about 4 dB) and the sample peak over the '
              'music\'s local peak (at most about 6 dB, 8 for a signature hit). Music peaks are '
              f'floored at {FLOOR:g} dBFS in band and {PEAK_FLOOR:g} dBFS for samples, as in the '
              'kit\'s mixer.', '']
    if measured:
        lines += ['| Time | Band | In-band peak | Body | 2-8 kHz | Sample peak | Note |',
                  '| --- | --- | --- | --- | --- | --- | --- |']
        for start, end, (low, high), level in measured:
            notes = []
            if level['over_silence']:
                notes.append('over silence in its band: judge by ear')
            elif level['in_band'] > 4:
                notes.append('over the +3-4 dB in-band target')
            elif level['in_band'] < 2:
                notes.append('may be masked: under +2 dB in band')
            if level['hf'] > 4:
                notes.append('harsh: 2-8 kHz lift over 4 dB')
            if level['peak'] > 6:
                notes.append('peaks over 6 dB above the music')
            lines.append(f"| {start:.2f}-{end:.2f} s | {low:.0f}-{high:.0f} Hz | "
                         f"{level['in_band']:+.1f} dB | {level['body']:+.1f} dB | "
                         f"{level['hf']:+.1f} dB | {level['peak']:+.1f} dB | {'; '.join(notes)} |")
        covered = sum(end - start for start, end, _, _ in measured)
        if covered > 0.5 * mix_info['duration']:
            lines += ['', 'Effects cover more than half the film. Check that the music-only '
                      'render is the same cut with only the effects hidden.']
    else:
        lines.append('No effect found: either there are none, or none rises 1.5 dB over the '
                     'music in any octave.')
    lines.append('')

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
        with open(os.path.join(args.out, 'effects.csv'), 'w', newline='') as fh:
            writer = csv.writer(fh)
            writer.writerow(['start', 'end', 'band_low_hz', 'band_high_hz', 'in_band_peak_db',
                             'body_db', 'band_2_8khz_db', 'sample_peak_db', 'over_silence'])
            writer.writerows([(f'{s:.3f}', f'{e:.3f}', f'{lo:.0f}', f'{hi:.0f}',
                               f"{v['in_band']:.2f}", f"{v['body']:.2f}", f"{v['hf']:.2f}",
                               f"{v['peak']:.2f}", v['over_silence'])
                              for s, e, (lo, hi), v in measured])

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
    lines += ['## Loudness lift, 400 ms', '',
              'Every 0.1 s, the momentary loudness (400 ms) of the mix minus the music alone, '
              'in full band and in 2-8 kHz, with the music floored at -50 LUFS so a sparse or '
              'silent bed still gives a number. A stretch is listed where the mix is more than '
              '0.5 LU louder than the music. Full band shows what an effect does to the '
              'loudness of the whole film; the 400 ms window smears and delays short effects, so '
              'judge levels by the table above.', '']
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
        lines.append('No stretch lifts the mix by more than 0.5 LU.')
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
    render.add_argument('--changed', type=float, default=24,
                        help='a pixel counts as changed for single-frame events above this (0-255)')
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
