#!/usr/bin/env python3
"""culture/life/<island>.json: the plants and animals found only in Hawaiʻi that people have seen inside each
State ahupuaʻa polygon, from the iNaturalist cache written by fetch_life.py.
  A sighting counts when its point falls inside the polygon and its stated accuracy is 1 km or better (or unstated).
  Per ahupuaʻa: o sightings, k species, t the most-seen species per group as [taxon index, sightings].
  Taxa: [Hawaiian name or "", English name or "", scientific name, group]. Groups: P plants, B birds, F fish,
  S snails and shells, I insects and spiders, O everything else.
Names are iNaturalist's; the Hawaiian ones are community entries with the ʻokina normalised, for the review partner.
  python3 culture/sources/build_life.py [cache-dir]
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
GROUP = {"Plantae": "P", "Aves": "B", "Actinopterygii": "F", "Mollusca": "S", "Insecta": "I", "Arachnida": "I"}
PER_GROUP = 4
V = "aeiouāēīōūAEIOUĀĒĪŌŪ"
def okina(s):
    if not s: return ""
    s = re.sub(r"[`'‘’ʼ]", "ʻ", s.strip())
    i = 1 if s.startswith("ʻ") else 0
    return s[:i] + s[i:i + 1].upper() + s[i + 1:]
def en_name(s):
    """English names keep their apostrophes except where one stands for an ʻokina (Kaua'i, pa'iniu)."""
    s = (s or "").strip()
    s = re.sub(rf"(^|(?<=[\s{V}]))[`'‘’ʼ](?=[{V}])", "ʻ", s)
    i = 1 if s.startswith("ʻ") else 0
    return s[:i] + s[i:i + 1].upper() + s[i + 1:]
def inside(x, y, ring):
    c = False; j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]; xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
        j = i
    return c
def in_poly(x, y, poly):
    return inside(x, y, poly[0]) and not any(inside(x, y, h) for h in poly[1:])
def build(isl, D):
    L = json.load(open(os.path.join(D, f"life_{isl}.json")))
    fc = json.load(open(os.path.join(ROOT, "culture", "ahupuaa", isl + ".geojson")))
    shapes = []
    for f in fc["features"]:
        g = f["geometry"]; polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        xs = [p[0] for poly in polys for p in poly[0]]; ys = [p[1] for poly in polys for p in poly[0]]
        shapes.append((str(f["properties"]["id"]), polys, min(xs), max(xs), min(ys), max(ys)))
    # one display name per species: a subspecies or variety counts toward its species line
    taxa, index, key_of = [], {}, {}
    for tid, t in L["taxa"].items():
        sci = " ".join(t["sci"].split()[:2]) if t.get("rank") in ("subspecies", "variety", "form") else t["sci"]
        haw, en = okina(t.get("haw")), en_name(t.get("en"))
        if haw and haw.lower() == okina(en).lower(): haw = ""   # no Hawaiian entry: iNaturalist fell back to English
        k = sci
        if k not in index:
            index[k] = len(taxa); taxa.append([haw, en, sci, GROUP.get(t.get("group"), "O")])
        elif haw and not taxa[index[k]][0]: taxa[index[k]][0] = haw
        key_of[int(tid)] = index[k]
    counts = {}
    for oid, la, lo, acc, tid in L["obs"]:
        if acc is not None and acc > 1000: continue
        if tid not in key_of: continue
        for sid, polys, x0, x1, y0, y1 in shapes:
            if x0 <= lo <= x1 and y0 <= la <= y1 and any(in_poly(lo, la, p) for p in polys):
                c = counts.setdefault(sid, {}); c[key_of[tid]] = c.get(key_of[tid], 0) + 1; break
    out, used = {}, set()
    for sid, c in counts.items():
        top, per = [], {}
        for ti, n in sorted(c.items(), key=lambda kv: (-kv[1], taxa[kv[0]][2])):
            g = taxa[ti][3]
            if not (taxa[ti][0] or taxa[ti][1]): continue   # a Latin name alone tells a visitor nothing
            if per.get(g, 0) < PER_GROUP: per[g] = per.get(g, 0) + 1; top.append([ti, n]); used.add(ti)
        out[sid] = {"o": sum(c.values()), "k": len(c), "t": top}
    # renumber so the file only carries taxa a card can show
    remap = {ti: i for i, ti in enumerate(sorted(used))}
    for r in out.values(): r["t"] = [[remap[ti], n] for ti, n in r["t"]]
    doc = {"v": 1, "src": "iNaturalist research-grade observations of taxa endemic to Hawaiʻi, open locations only",
           "fetched": L.get("fetched") or __import__("time").strftime("%Y-%m-%d", __import__("time").localtime(os.path.getmtime(os.path.join(D, f"life_{isl}.json")))), "taxa": [taxa[ti] for ti in sorted(used)], "ahupuaa": dict(sorted(out.items(), key=lambda kv: int(kv[0])))}
    os.makedirs(os.path.join(ROOT, "culture", "life"), exist_ok=True)
    with open(os.path.join(ROOT, "culture", "life", isl + ".json"), "w") as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{isl}: {len(out)}/{len(shapes)} ahupuaʻa with sightings, {len(doc['taxa'])} taxa shown, {sum(r['o'] for r in out.values())} sightings placed of {len(L['obs'])}")
if __name__ == "__main__":
    D = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/.cache/oceansafe-culture-sources")
    for isl in ("kauai", "maui", "oahu", "hawaii"):
        if os.path.exists(os.path.join(D, f"life_{isl}.json")): build(isl, D)
