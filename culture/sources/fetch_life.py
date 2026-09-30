#!/usr/bin/env python3
"""Plants and animals found only in Hawaiʻi, as seen inside each island, written to <cache-dir>/life_<island>.json.
  obs    iNaturalist v2 observations: research grade, endemic to Hawaiʻi, open geoprivacy for both the
         observation and the taxon. Rare species iNaturalist hides the location of are left out entirely,
         so the card can never place one. Kept: id, lat, lon, positional accuracy (m), taxon id.
  taxa   the Hawaiian name (locale haw), the English name, the scientific name and the iconic group.
Resumable by observation id; one request a second, per iNaturalist's API guidance.
  python3 culture/sources/fetch_life.py <island> [cache-dir]
"""
import json, os, sys, time, urllib.request
UA = {"User-Agent": "OceanSafe educational research (mossmankauai@gmail.com)"}
PLACE = {"kauai": 53615, "maui": 51507, "oahu": 6693, "hawaii": 53614}
API = "https://api.inaturalist.org"
def get(u, tries=5):
    err = None
    for t in range(tries):
        try:
            r = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read()); time.sleep(1); return r
        except Exception as e: err = e; time.sleep(3 + 3 * t)
    raise SystemExit(f"failed {u}: {err}")
if __name__ == '__main__':
    isl = sys.argv[1]; D = sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser('~/.cache/oceansafe-culture-sources')
    os.makedirs(D, exist_ok=True); path = os.path.join(D, f'life_{isl}.json')
    out = json.load(open(path)) if os.path.exists(path) else {"obs": [], "taxa": {}}
    last = max([o[0] for o in out["obs"]] or [0])
    q = (f"{API}/v2/observations?place_id={PLACE[isl]}&endemic=true&quality_grade=research&geoprivacy=open&taxon_geoprivacy=open"
         "&per_page=200&order_by=id&order=asc&fields=id,location,positional_accuracy,taxon.id")
    while True:
        rs = get(q + f"&id_above={last}")["results"]
        if not rs: break
        for r in rs:
            if r.get("location") and r.get("taxon"):
                la, lo = map(float, r["location"].split(","))
                out["obs"].append([r["id"], round(la, 5), round(lo, 5), r.get("positional_accuracy"), r["taxon"]["id"]])
        last = rs[-1]["id"]; json.dump(out, open(path, "w"), ensure_ascii=False)
    need = sorted({o[4] for o in out["obs"]} - set(map(int, out["taxa"])))
    for i in range(0, len(need), 30):
        ids = ",".join(map(str, need[i:i + 30]))
        haw = {t["id"]: t for t in get(f"{API}/v1/taxa/{ids}?locale=haw")["results"]}
        for t in get(f"{API}/v1/taxa/{ids}?locale=en")["results"]:
            h = haw.get(t["id"], {})
            out["taxa"][str(t["id"])] = {"sci": t["name"], "rank": t.get("rank"), "en": t.get("preferred_common_name"),
                                         "haw": h.get("preferred_common_name"), "group": t.get("iconic_taxon_name")}
        json.dump(out, open(path, "w"), ensure_ascii=False)
    print(isl, "done", len(out["obs"]), "obs", len(out["taxa"]), "taxa")
