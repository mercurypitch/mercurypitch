import sys
from PIL import Image, ImageDraw, ImageFont
out=sys.argv[1]; files=sys.argv[2:]
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28)
s=Image.new('RGB',(1920,1080))
d=ImageDraw.Draw(s)
for i,f in enumerate(files):
    im=Image.open(f).convert('RGB').resize((960,540))
    x,y=(i%2)*960,(i//2)*540
    s.paste(im,(x,y))
    d.rectangle([x,y,x+150,y+34],fill=(0,0,0)); d.text((x+4,y+2),f.split('full-')[1].replace('.png',''),fill=(255,255,0),font=font)
s.save(out)
