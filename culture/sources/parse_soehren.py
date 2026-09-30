#!/usr/bin/env python3
"""Parse the Soehren catalog pages fetched by fetch_soehren.sh into soehren.json (one record per name).
  python3 culture/sources/parse_soehren.py <cache-dir>
"""
import re,html,json,sys,os
D = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/.cache/oceansafe-culture-sources')
def parse(fn):
    s=open(fn,encoding='utf-8',errors='ignore').read()
    i=s.find('Your search retrieved'); s=s[i:]
    chunks=re.split(r'<br />\s*<br />\s*(?=\d+\)\s*<u>Place Name</u>)',s)
    out=[]
    for c in chunks:
        m=re.match(r'.*?(\d+)\)\s*(<u>Place Name</u>.*)',c,flags=re.S)
        if not m: continue
        body=m.group(2)
        rec={}
        for fm in re.finditer(r'<u>([^<]+)</u>:\s*(.*?)(?=(?:&nbsp;)*\s*<u>|<br />|$)',body,flags=re.S):
            k=html.unescape(fm.group(1)).strip()
            v=re.sub(r'<[^>]+>','',fm.group(2)); v=html.unescape(v).replace('\xa0',' ').strip()
            if k in rec: continue
            rec[k]=v
        out.append(rec)
    return out
allr={}
for k in ['kauai','oahu','maui','hawaii']:
    a=parse(os.path.join(D, f'ahu_{k}.html')); r=parse(os.path.join(D, f'all_{k}.html'))
    allr[k]={'ahu':a,'all':r}
    print(k,len(a),len(r))
json.dump(allr,open(os.path.join(D, 'soehren.json'),'w'),ensure_ascii=False)
