import json, glob, os
rows=[]
for f in sorted(glob.glob('*.json')):
    n=f[:-5]
    try:
        txt=open(f).read(); j=json.loads(txt[txt.index('{'):])
    except Exception as e: rows.append((n,'unreadable',str(e)[:80])); continue
    parts=[]; errs=[]
    for k in ('lint','runtime','layout','contrast'):
        v=j.get(k)
        if isinstance(v,dict):
            parts.append(f"{k} {v.get('errorCount')}/{v.get('warningCount')}")
            for x in v.get('findings',[]):
                if x.get('severity')=='error': errs.append(f"{k}: {x.get('code')} {str(x.get('message'))[:90]} {str(x.get('selector') or x.get('sourceFile') or '')[:60]} t {x.get('time')}")
    rows.append((n, j.get('ok'), '; '.join(parts), errs))
for r in rows:
    print(r[0], r[1], r[2] if len(r)>2 else '')
    for e in (r[3] if len(r)>3 else [])[:5]: print('    ERROR', e)
