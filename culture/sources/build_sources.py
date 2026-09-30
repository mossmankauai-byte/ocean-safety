#!/usr/bin/env python3
"""Build culture/sources/<island>.json: the sourced facts behind each ahupuaʻa card.

Every value here is copied or counted from a named public source. Nothing is written by OceanSafe.
  S  Lloyd J. Soehren, Catalog of Hawaiʻi Place Names (UH Mānoa Library). Per ahupuaʻa: the name's
     meaning as the catalog quotes it from Pukui, Elbert and Mookini, Place Names of Hawaii (PEM) or the
     Pukui and Elbert Hawaiian Dictionary (PE); who held the land at the 1848 Māhele (Māhele Book, Land
     Commission Awards); and the place names recorded inside it, with the kind of feature and the record
     that preserves the name. Heiau, burials, caves, shrines and sacred stones are never listed.
  E  USGS 3D Elevation Program: lowest and highest ground in the State polygon.
  R  Rainfall Atlas of Hawaiʻi (Giambelluca et al. 2013) isohyets, via the Hawaiʻi Statewide GIS Program.
  W  DLNR Division of Aquatic Resources streams layer, via the Hawaiʻi Statewide GIS Program.

Inputs are fetched once, politely, and cached outside the repo:
  bash culture/sources/fetch_soehren.sh <cache>        (12 requests, 5 s apart)
  python3 culture/sources/parse_soehren.py <cache>     (writes <cache>/soehren.json)
  python3 culture/sources/fetch_env.py <island> <cache> (per island, resumable)
Then: python3 culture/sources/build_sources.py --soehren <cache>/soehren.json --env <cache>
Rerun all four after the State ahupuaʻa layer changes (it was last updated by SHPD in July 2026).
"""
import json, re, sys, unicodedata, collections, argparse, os, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
ISLANDS = ['kauai', 'oahu', 'maui', 'hawaii']
ISLAND_NAME = {'kauai': 'Kauaʻi', 'oahu': 'Oʻahu', 'maui': 'Maui', 'hawaii': 'Hawaiʻi'}

def fold(s):
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r"[ʻ'‘’`\s\-\.\*\?\(\)]", '', s).lower()

def district(isl_field):
    m = re.search(r'\((.+)\)', isl_field or '')
    return fold(m.group(1)) if m else ''

def base_names(name):
    """State names can carry numbers, compass words or several ahupuaʻa at once ("Kaiwiki, Maumau")."""
    out = []
    for part in [p.strip() for p in name.split(',') if p.strip()]:
        p = re.sub(r'^(North|South|East|West|Upper|Lower)\s+', '', part)
        p = re.sub(r'\s*\((?:a|b|c)\)$', '', p)
        p = re.sub(r'\s+\d+(?:\s*-\s*\d+)?$', '', p)
        out.append((part, p))
    return out

# ── the name's meaning ────────────────────────────────────────────────────────────────────────────
DASH = re.compile('[‒–—―]')
def lexicology(lx):
    """'pāʻā. PEM: dry, rocky.' -> ('pāʻā', 'PEM', 'dry, rocky'). Soehren's own [bracket notes] are dropped."""
    lx = (lx or '').strip()
    m = re.match(r'^(?P<spell>[^.]+?)\.\s*(?:(?P<src>PEM|PE)\s*:\s*(?P<gloss>.*))?$', lx)
    if not m: return None, None, None
    spell, src, gloss = m.group('spell').strip(), m.group('src'), (m.group('gloss') or '').strip()
    gloss = re.split(r'\.["”]?\s+\[', gloss, maxsplit=1)[0]          # Soehren's own note after the gloss
    gloss = re.split(r'\.\s+[^.]{1,40}?\.\s+PEM?:', gloss, maxsplit=1)[0]   # the next reading's headword and source
    gloss = re.split(r'\s+PEM?:\s', gloss, maxsplit=1)[0]                        # a second source on the same line
    gloss = re.split(r'(?<=[a-z\)\]])\.\s+(?=[A-Z])', gloss, maxsplit=1)[0]   # Soehren's own sentence after the gloss
    if re.search(r'\.\.\.|…', gloss): return spell, None, None                 # the catalog cut this quote short
    gloss = gloss.strip().rstrip('.').strip().strip('"“”').strip().rstrip('.')
    if not gloss or re.search(r'not translated|meaning unknown|uncertain|\?', gloss, re.I): gloss, src = None, (src if gloss else None)
    # A quote is never edited, so one that breaks a rule is left out: a dash or $, a Maʻemaʻe word, a
    # story or a note naming someone (moʻolelo is the review partner's), or the catalog's own notes run in.
    if gloss and (DASH.search(gloss) or len(gloss) > 110 or '$' in gloss or re.search(r'\bancient\b|big island', gloss, re.I)
                  or MEANING_NEVER.search(gloss)
                  or re.search(r'ravish|victim|sacrific|\bkill|slain|legend|said to|story|goddess|\bgods?\b|demigod|chief|battle|\bdied\b|death|ghost|spirit', gloss, re.I)
                  or re.search(r'q\.v\.|\bCf\.|\bSee\b|Misspel|\.\.\.|…|["“”]|writes|offers no', gloss)): gloss = None
    return spell, (src if gloss else None), gloss

def respell(ascii_name, spell):
    """Put the catalog's Pukui-Elbert spelling (ʻokina, kahakō) onto the record's ASCII name, keeping the
    record's capitals and any English tail ("Bay", "Reservoir"). Returns the ASCII name if they disagree."""
    if not spell: return ascii_name
    lex = spell.replace('-', '')
    out, i, j = [], 0, 0
    A, L = ascii_name, lex
    while i < len(A) and j < len(L):
        a, l = A[i], L[j]
        if l == 'ʻ': out.append('ʻ'); j += 1; continue
        if a == ' ' and l == ' ': out.append(' '); i += 1; j += 1; continue
        if a == ' ': out.append(' '); i += 1; continue
        if l == ' ': j += 1; continue
        lb = unicodedata.normalize('NFD', l)[0]
        if lb.lower() != a.lower(): return ascii_name
        ch = l.upper() if a.isupper() else l
        out.append(unicodedata.normalize('NFC', ch)); i += 1; j += 1
    while j < len(L) and L[j] in ' ʻ': j += 1
    if j < len(L): return ascii_name
    res = ''.join(out) + A[i:]
    return res if fold(res) == fold(ascii_name) else ascii_name

# A meaning that breaks any of these is left out, never edited. checks/culture-lint.py holds the same rules.
#   a parenthetical note (where Place Names of Hawaii puts context and stories), numbered dictionary senses,
#   a second sentence (the next reading run in), and anatomy or excretion, held for the review partner.
MEANING_NEVER = re.compile(r'\(|(^|\s)\d+\.\s|\.\s|\bPEM?:|penis|vagina|vulva|genital|testic|scrot|clitor|excrement|feces|faeces|dung|urin|buttock|anus\b|copulat|sexual|intercourse|pubic|menstru|corpse|bones|burial|grave', re.I)

# ── the 1848 Māhele ───────────────────────────────────────────────────────────────────────────────
NAME = r"[A-Z][A-Za-zāēīōūʻ\.\s]*?"
MAH = r"(?:,?\s*at the M[aā]hele)?"
def mahele(comments):
    """Only a clean, single-disposition first sentence becomes a line. Split lands, exceptions and
    later transfers stay in the catalog, one tap away."""
    c = re.sub(r'\bLCAw\.', 'LCAw', (comments or '').strip())
    first = re.split(r'(?<=[a-z0-9\)])\.\s', c + ' ', maxsplit=1)[0].strip().rstrip('.')
    if re.fullmatch(rf"Claimed by the Crown{MAH}", first): return {'k': 'crown'}
    if re.search(r'1/2|except|Ahp|\bbut\b|;|claimed|surrender|relinquish|omitted', first, re.I): return None
    first = re.sub(r'^The ahupuaa was returned by', 'Returned by', first)
    kul = re.search(r',\s*excluding (\d+) kuleana$', first)
    if kul: first = first[:kul.start()]
    m = re.fullmatch(rf"Returned by (?P<who>{NAME}(?: and {NAME})*){MAH},\s*retained by (?:aupuni|the Gov(?:ernment|\.)?|Government){MAH}", first)
    if m: return {'k': 'gov', 'who': m.group('who').strip()}
    m = re.fullmatch(rf"Returned by (?P<who>{NAME}(?: and {NAME})*){MAH},\s*retained by (?:the )?Crown{MAH}", first)
    if m: return {'k': 'crown', 'who': m.group('who').strip()}
    m = re.fullmatch(rf"Retained by (?P<who>{NAME}){MAH}(?:,\s*LCAw\.?\s*(?P<lca>[0-9][0-9A-Za-z\-]*)(?::\d+)?(?:\s*\(no RP\))?)?{MAH}(?:,\s*[\d\.]+ acres(?: in \w+ apana)?)?", first)
    if m and not re.search(r'aupuni|crown|gov', m.group('who'), re.I):
        o = {'k': 'kept', 'who': m.group('who').strip()}
        if m.group('lca'): o['lca'] = m.group('lca')
        if kul: o['kul'] = int(kul.group(1))
        return o
    return None

# ── the names inside ──────────────────────────────────────────────────────────────────────────────
NEVER = re.compile(r'heiau|luakini|burial|bones|ilina|kupapau|cemetery|grave|tomb|cave|\bana\b|shrine|altar|\bahu\b|kuula|puuhonua|wahi pana|stone|rock|pohaku|\blua\b|\biwi\b|\bpit\b|\bunu\b', re.I)
NEVER_RAW = re.compile(r'koʻa|kūʻula', re.I)   # koʻa folded is koa, the tree, so it is matched with its ʻokina
def plain(s):
    s = unicodedata.normalize('NFD', s or '')
    return ''.join(ch for ch in s if not unicodedata.combining(ch)).replace('ʻ', '').replace("'", '')
def never(feature):
    return bool(NEVER_RAW.search(feature or '') or NEVER.search(plain(feature)))
GROUPS = [
    ('ili',   'ʻili, land sections',   re.compile(r"^ʻili\b|ʻili kū|ʻili kūpono", re.I)),
    ('hill',  'hills and ridges',      re.compile(r'puʻu|hill|cone|ridge|pali|knoll|mountain|āhua|crater|vent|kualapa|peak', re.I)),
    ('water', 'streams, springs and ponds', re.compile(r'stream|spring|pūnāwai|waterfall|wailele|fishpond|fish pond|loko|kahawai|river|marsh|swamp|pool|pond', re.I)),
    ('coast', 'shore and sea',         re.compile(r'point|\blae\b|bay|cove|beach|islet|reef|surf|landing|inlet|channel|harbor', re.I)),
    ('home',  'villages and house sites', re.compile(r'village|kauhale|kūlana|town|pā ?hale|kahua hale', re.I)),
    ('farm',  'farm lands',            re.compile(r"loʻi|\bkula\b|kōʻele|mahina ?ʻai|kīhāpai|kihapai|loko kalo|moʻo kalo|ʻaina kalo", re.I)),
    ('valley','valleys and gulches',   re.compile(r'valley|gulch|awāwa|awawa', re.I)),
]
def group_of(feature):
    if never(feature): return None
    for key, _, rx in GROUPS:
        if rx.search(feature or ''): return key
    return None

def feature_label(feature):
    for t in re.split(r',\s*', feature or ''):
        t = t.strip().rstrip('?')
        if t and t not in ('bp', 'ts', 'place') and not never(t): return t
    return ''

def record_kind(src):
    s = src or ''
    if re.search(r'Land Commission|Indices of Awards|Mahele Book|Māhele Book', s): return 'award'
    if re.search(r'Boundary Commission|Boundary Certificate', s): return 'boundary'
    if re.search(r'Registered Map|Government Survey', s): return 'survey'
    if re.search(r'Royal Patent', s): return 'grant'
    if re.search(r'Geological Survey|USGS', s): return 'usgs'
    if re.search(r'Macdonald|Geologic', s): return 'geology'
    return 'other'

STREAM_TAIL = {'R': 'River', 'Gl': 'Gulch', 'Str': 'Stream'}
def stream_name(nm):
    """DAR writes 'Wailua R', 'Kailua Gl'. Expand those; drop codes (PMRF1) and labels that are not a
    stream's name (Va, Rg, Pt, Res, Beach, Spring)."""
    nm = (nm or '').strip()
    if not nm or re.search(r'\d', nm): return None, None
    parts = nm.split(' ')
    if len(parts) > 1 and parts[-1] in ('Va', 'Rg', 'Pt', 'Res', 'Beach', 'Spring', 'Ditch', 'Canal'): return None, None
    tail = STREAM_TAIL.get(parts[-1]) if len(parts) > 1 else None
    base = ' '.join(parts[:-1]) if tail else nm
    return base, tail

def soehren_url(name):
    return 'https://manoa.hawaii.edu/hawaiiancollection/soehren/process.php?terms1=' + urllib.parse.quote_plus(plain(name)) + '&boolean1=1'

def build(soe, envdir):
    report = {}
    for isl in ISLANDS:
        fc = json.load(open(os.path.join(ROOT, 'culture', 'ahupuaa', isl + '.geojson')))
        env = {}
        p = os.path.join(envdir, 'env_' + isl + '.json')
        if os.path.exists(p): env = json.load(open(p))
        ahu = soe[isl]['ahu']; allr = soe[isl]['all']
        by = collections.defaultdict(list)
        for r in ahu: by[fold(r['Place Name'])].append(r)
        byname = collections.defaultdict(list)
        for r in allr: byname[fold(r['Place Name'])].append(r)
        inside = collections.defaultdict(list)
        for r in allr: inside[(fold(r.get('Ahupuaʻa')), district(r.get('Island')))].append(r)
        # respell lookup for stream names: every catalog record on the island that carries a spelling
        spell_of = {}
        for r in allr:
            sp, _, _ = lexicology(r.get('Lexicology'))
            if sp: spell_of.setdefault(fold(re.sub(r'\s+(Stream|Gulch|Reservoir|Res|River)$', '', r['Place Name'])), (r['Place Name'], sp))
        bycat = collections.defaultdict(list)
        for r in allr:
            c = (r.get('Cat. No.') or '').strip()
            if re.match(r'^\d+\.\d+\.', c): bycat['.'.join(c.split('.')[:2])].append(r)
        # which catalog district prefix (first number) goes with which State moku, from the unique matches
        pre = collections.defaultdict(collections.Counter)
        for f in fc['features']:
            pr = f['properties']
            for shown, base in base_names(pr.get('ahupuaa') or ''):
                c = by.get(fold(base), [])
                if len(c) == 1 and c[0].get('Cat. No.'): pre[fold(pr['moku'])][c[0]['Cat. No.'].split('.')[0]] += 1
        out, stats = {}, collections.Counter()
        for f in fc['features']:
            pr = f['properties']; aid = str(pr['id']); mk = fold(pr['moku'])
            if not pr.get('ahupuaa') or pr['ahupuaa'] in ('N/A',) or re.match(r'^Grant\s', pr['ahupuaa']): stats['skipped'] += 1; continue
            dk = mk if isl == 'hawaii' else ''
            parts = []
            for shown, base in base_names(pr['ahupuaa']):
                k = fold(base)
                c = [r for r in by.get(k, []) if (isl != 'hawaii' or district(r['Island']) == mk) and '*' not in r['Place Name']]
                if len(c) > 1:
                    c = [r for r in c if pre[mk].get((r.get('Cat. No.') or '').split('.')[0])] or c
                rec = c[0] if len(c) == 1 else None
                cat = '.'.join((rec.get('Cat. No.') or '').split('.')[:2]) if rec else ''
                if cat and bycat.get(cat):
                    names = [r for r in bycat[cat] if r is not rec and 'ahupuaʻa' not in (r.get('Feature') or '')]
                else:
                    names = [r for r in inside.get((k, dk), []) if 'ahupuaʻa' not in (r.get('Feature') or '')]
                if not rec:
                    alt = [r for r in byname.get(k, []) if (isl != 'hawaii' or district(r['Island']) == mk) and lexicology(r.get('Lexicology'))[2]]
                    glosses = {lexicology(r.get('Lexicology'))[2] for r in alt}
                    if alt and len(glosses) == 1:
                        rec = dict(alt[0]); rec['_nameonly'] = True
                        if re.search(r'ʻokana|district', alt[0].get('Feature') or '') and re.search(r'called an ahupuaa today', alt[0].get('Comments') or ''):
                            rec['_okana'] = True
                if not rec and not names: continue
                part = {'n': shown, 'q': soehren_url(rec['Place Name'] if rec else base)}
                if rec:
                    sp, src, gloss = lexicology(rec.get('Lexicology'))
                    if gloss: part['mean'] = gloss; part['by'] = src
                    if rec.get('_okana'):
                        m = re.search(r'contains (\w+) "lands"', rec.get('Comments') or '')
                        part['okana'] = m.group(1) if m else True
                        mh = mahele(rec.get('Comments'))
                        if mh: part['mahele'] = mh
                    if not rec.get('_nameonly'):
                        mh = mahele(rec.get('Comments'))
                        if mh: part['mahele'] = mh
                        part['kind'] = 'ahupuaʻa'
                shown_names, counts = [], collections.Counter()
                for r in names:
                    if '*' in (r.get('Place Name') or ''): continue   # the catalog stars a variant spelling of a name it also lists
                    g = group_of(r.get('Feature'))
                    counts['all'] += 1
                    if not g: continue
                    counts[g] += 1
                    sp, src, gloss = lexicology(r.get('Lexicology'))
                    item = {'n': respell(r['Place Name'], sp), 'g': g, 'f': feature_label(r.get('Feature')), 'r': record_kind(r.get('Source'))}
                    if gloss: item['mean'] = gloss; item['by'] = src
                    shown_names.append(item)
                # the list shown: ʻili first, then the landscape, meanings first within each group, capped
                order = ['ili', 'hill', 'water', 'coast', 'home', 'valley', 'farm']
                cap = {'ili': 4, 'hill': 3, 'water': 3, 'coast': 3, 'home': 2, 'valley': 2, 'farm': 2}
                seen, pick = set(), []
                for g in order:
                    grp = [x for x in shown_names if x['g'] == g and fold(x['n']) not in seen]
                    grp.sort(key=lambda x: (0 if x.get('mean') else 1, x['n']))
                    for x in grp[:cap[g]]: pick.append(x); seen.add(fold(x['n']))
                pick = pick[:10]
                if counts['all']: part['count'] = counts['all']
                if pick: part['places'] = pick
                parts.append(part)
                stats['part'] += 1
                if part.get('mean'): stats['meaning'] += 1
                if part.get('mahele'): stats['mahele'] += 1
                if pick: stats['places'] += 1
            row = {}
            if parts: row['s'] = parts
            e = env.get(aid) or {}
            el = e.get('elev') or {}
            if isinstance(el, dict) and el.get('max_m') is not None:
                row['ft'] = [max(0, round(el['min_m'] * 3.28084 / 10) * 10), round(el['max_m'] * 3.28084 / 10) * 10]
            rain = e.get('rain')
            if isinstance(rain, list) and rain:
                cs = sorted({int(round(x['contour'])) for x in rain if x.get('contour') is not None})
                if cs: row['rain'] = [cs[0], cs[-1]]
            st = e.get('streams')
            if isinstance(st, list) and st:
                seen, lst = set(), []
                for x in st:
                    raw = (x.get('stream_nam') or '').strip()
                    if re.search(r'Reservoir|unnamed', raw, re.I): continue
                    base, tail = stream_name(raw)
                    if not base: continue
                    k = fold(base)
                    if k in seen: continue
                    seen.add(k)
                    hit = spell_of.get(k)
                    shown = respell(base, hit[1]) if hit else base
                    per = any((y.get('type') or '').upper() == 'PERENNIAL' and fold(stream_name(y.get('stream_nam'))[0] or '') == k for y in st)
                    lst.append({'n': shown + (' ' + tail if tail else ''), 'p': 1 if per else 0})
                if lst: row['wai'] = lst[:6]
            if row: out[aid] = row
            if row.get('ft'): stats['elev'] += 1
            if row.get('rain'): stats['rain'] += 1
            if row.get('wai'): stats['streams'] += 1
            stats['ahupuaa'] += 1
        with open(os.path.join(HERE, isl + '.json'), 'w', encoding='utf-8') as fh:
            json.dump({'v': 1, 'island': ISLAND_NAME[isl], 'ahupuaa': out}, fh, ensure_ascii=False, separators=(',', ':'))
        report[isl] = dict(stats)
    return report

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--soehren', required=True); ap.add_argument('--env', required=True)
    a = ap.parse_args()
    rep = build(json.load(open(a.soehren)), a.env)
    for k, v in rep.items(): print(k, v)
