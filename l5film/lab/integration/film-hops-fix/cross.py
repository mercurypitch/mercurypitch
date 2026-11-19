# cross.py: the 30 fps film windows against the 60 fps one at the same film time. The 60 fps render reads the
# pass on the frame it shows before and after the fix (hops-60.txt: err 0 on every frame) and shows the pass
# frame one later than the 30 fps render at the same time, so where Merc's root is cancelled right in both,
# their cx agree to the pose change between neighbouring pass frames.
import sys
def rows(p):
    out = {}
    for l in open(p):
        f = l.split()
        if len(f) > 9 and f[0].isdigit(): out[round(float(f[1]), 3)] = f
    return out
a, b = rows('hops-30.txt'), rows('hops-60.txt')
print(f'{"film t":>8} {"shown 30":>8} {"shown 60":>8} {"cx 60":>7} {"30 before":>9} {"30 after":>8} {"before-60":>9} {"after-60":>8}')
mb = ma = 0
for t in sorted(a):
    if t not in b: continue
    r, s = a[t], b[t]
    c60, cb, ca = float(s[9]), float(r[8]), float(r[9])
    inside = 842 <= int(r[2]) <= 900
    if inside: mb, ma = max(mb, abs(cb - c60)), max(ma, abs(ca - c60))
    print(f'{t:>8.3f} {r[2]:>8} {s[2]:>8} {c60:>7.1f} {cb:>9.1f} {ca:>8.1f} {cb - c60:>9.1f} {ca - c60:>8.1f}')
print(f'max |30 fps - 60 fps| over pass frames 842 to 900: before {mb:.1f} px, after {ma:.1f} px')
