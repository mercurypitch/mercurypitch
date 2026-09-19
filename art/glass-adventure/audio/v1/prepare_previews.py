"""Create level-matched MP3 auditions while retaining byte-identical WAV masters."""
from pathlib import Path
import concurrent.futures, hashlib, json, re, subprocess
HERE=Path(__file__).resolve().parent
manifest=json.loads((HERE/'intake.json').read_text())
(HERE/'previews').mkdir(exist_ok=True)
def prepare(row):
 source=HERE/row['master'];dest=HERE/row['preview'];partial=dest.with_name(dest.stem+'.partial.mp3')
 if hashlib.sha256(source.read_bytes()).hexdigest()!=row['sha256']:raise ValueError('Master archive changed')
 target=-28 if row['id'].startswith('A') else -20
 gain=min(target-float(row['loudness']['input_i']),-2-float(row['loudness']['input_tp']))
 subprocess.run(['ffmpeg','-v','error','-nostdin','-y','-i',str(source),'-map','0:a:0','-map_metadata','-1','-af',f'volume={gain:.4f}dB','-codec:a','libmp3lame','-q:a','2','-ar','48000',str(partial)],check=True,timeout=90)
 result=subprocess.run(['ffmpeg','-hide_banner','-nostdin','-i',str(partial),'-af','loudnorm=I=-20:TP=-2:LRA=9:print_format=json','-f','null','-'],capture_output=True,text=True,check=True,timeout=90)
 measured=json.loads(re.findall(r'\{\s*"input_i".*?\}',result.stderr,re.S)[-1])
 if float(measured['input_tp'])>-1.8:raise ValueError('Unexpected encoded preview peak')
 partial.replace(dest)
 row['audition']={'gainDb':round(gain,4),'targetLufs':target,'measuredLufs':float(measured['input_i']),'truePeakDbTP':float(measured['input_tp']),'codec':'MP3 VBR q2, stereo48kHz','bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'loopPrepared':False,'gameIntegrated':False}
 return row
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:manifest['tracks']=list(pool.map(prepare,manifest['tracks']))
manifest['previewsBytes']=sum(row['audition']['bytes'] for row in manifest['tracks'])
(HERE/'intake.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'previews':len(manifest['tracks']),'bytes':manifest['previewsBytes'],'allMastersUntouched':True}),flush=True)
