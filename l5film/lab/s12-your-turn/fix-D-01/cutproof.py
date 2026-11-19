# Group D's fix round (D-01): after lab/s11-sing/cutprobe.mjs, for one cut folder: the eight frames round the cut as a
# sheet (frames 11 to 18 at 30 fps; 15 is the first after the cut), and for the plain cut on b38 the pixel change
# across it by region (the care block, the frame and its labels, the ring).
#   python3 cutproof.py <cut folder> [b38]
import sys, numpy as np
from PIL import Image, ImageDraw
d = sys.argv[1]
ims = [Image.open(f'{d}/frame-{k:03d}.png').convert('RGB').resize((480, 270), Image.LANCZOS) for k in range(11, 19)]
sheet = Image.new('RGB', (480 * 4 + 30, 270 * 2 + 10), (0, 0, 0))
for i, im in enumerate(ims):
    sheet.paste(im, ((i % 4) * 490, (i // 4) * 280))
    ImageDraw.Draw(sheet).text(((i % 4) * 490 + 8, (i // 4) * 280 + 6), f'frame {11 + i}' + (' (first after the cut)' if 11 + i == 15 else ''), fill=(255, 255, 255))
sheet.save(f'{d}/sheet.png')
print(f'{d}/sheet.png')
if len(sys.argv) > 2 and sys.argv[2] == 'b38':
    for a, b in [('out', 'in'), ('out60', 'in60')]:
        A = np.asarray(Image.open(f'{d}/{a}.png').convert('RGB'), dtype=np.int16); B = np.asarray(Image.open(f'{d}/{b}.png').convert('RGB'), dtype=np.int16)
        diff = np.abs(A - B).max(axis=2)
        print(a, b, 'pixels changed > 24:', int((diff > 24).sum()), 'largest:', int(diff.max()))
        for name, (x0, y0, x1, y1) in {'care block': (255, 110, 965, 800), 'frame and labels': (995, 200, 1650, 415), 'ring (1320, 572), r 136': (1174, 426, 1466, 718)}.items():
            r = diff[y0:y1, x0:x1]
            print(f'   {name:24s} >24: {int((r > 24).sum()):5d}, largest {int(r.max())}')
