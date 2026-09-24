#!/usr/bin/env python3
"""Maʻemaʻe lint for the Culture layer. Fails on the three rules the review kit checks, in the two places our
own hands touch: the per-island cultural-layer CSVs (culture/places/*.csv) and the culture code block in
index.html (between the culture-lint:start and culture-lint:end markers).

  1. "Big Island" anywhere.
  2. "ancient" anywhere (never for a living practice; the kit's rule, applied flat).
  3. A straight apostrophe standing in for an ʻokina inside a Hawaiian word (letters from the Hawaiian
     alphabet only, e.g. Kaua'i, Ko'olau). Queen's, don't and the like pass.

Sample rows (any field starting SAMPLE:) and draft rows are skipped in the CSVs, the same rule the app uses
before it shows a row. Exit 1 on any hit.

  python3 checks/culture-lint.py [repo-root]
"""
import csv, glob, os, re, sys

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..'))
HAW = re.compile(r"^[aeiouhklmnpwāēīōū']+$", re.I)
APOS = re.compile(r"[A-Za-zāēīōūĀĒĪŌŪ]+'[A-Za-zāēīōū]+")

def lint(text):
    hits = []
    if re.search(r'big island', text, re.I): hits.append('Big Island')
    if re.search(r'\bancient\b', text, re.I): hits.append('ancient')
    for w in APOS.findall(text):
        if HAW.match(w): hits.append('apostrophe as ʻokina: ' + w)
    return hits

fails = 0
# 1. the CSVs
for f in sorted(glob.glob(os.path.join(ROOT, 'culture', 'places', '*.csv'))):
    with open(f, encoding='utf-8', newline='') as fh:
        rows = list(csv.DictReader(fh))
    for n, row in enumerate(rows, start=2):
        vals = [v or '' for v in row.values()]
        if any(v.strip().upper().startswith('SAMPLE:') for v in vals): continue
        if (row.get('status') or '').strip().lower() in ('', 'draft'): continue
        for k, v in row.items():
            for h in lint(v or ''):
                fails += 1; print('FAIL %s row %d %s: %s' % (os.path.relpath(f, ROOT), n, k, h))
    print('OK   %s: %d rows checked' % (os.path.relpath(f, ROOT), len(rows)))

# 2. the culture code block
idx = os.path.join(ROOT, 'index.html')
s = open(idx, encoding='utf-8').read()
a, b = s.find('/* culture-lint:start */'), s.find('/* culture-lint:end */')
if a < 0 or b < 0:
    fails += 1; print('FAIL index.html: culture-lint markers missing')
else:
    block = s[a:b]
    for i, line in enumerate(block.split('\n'), start=s[:a].count('\n') + 1):
        for h in lint(line):
            fails += 1; print('FAIL index.html L%d: %s' % (i, h))
    print('OK   index.html culture block: %d lines checked' % block.count('\n'))

# 3. the sourced facts (culture/sources/*.json): the same three rules, plus no dash, no $ figure and no
#    review claim, because these strings reach the card verbatim.
EXTRA = re.compile(r'[\u2013\u2014]|\$|verified by|reviewed by a local|signed off', re.I)
import json
def strings(o):
    if isinstance(o, str): yield o
    elif isinstance(o, dict):
        for v in o.values(): yield from strings(v)
    elif isinstance(o, list):
        for v in o: yield from strings(v)
for f in sorted(glob.glob(os.path.join(ROOT, 'culture', 'sources', '*.json'))):
    n = 0
    for t in strings(json.load(open(f, encoding='utf-8'))):
        n += 1
        for h in lint(t) + (['dash, $ or review claim'] if EXTRA.search(t) else []):
            fails += 1; print('FAIL %s: %s in %r' % (os.path.relpath(f, ROOT), h, t[:80]))
    print('OK   %s: %d strings checked' % (os.path.relpath(f, ROOT), n))

print('HOLD, %d hit(s)' % fails if fails else 'PASS, Maʻemaʻe lint clean')
sys.exit(1 if fails else 0)
