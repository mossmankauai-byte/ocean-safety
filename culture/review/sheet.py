#!/usr/bin/env python3
"""The cultural review partner's confirm-or-deny sheet for every ahupuaʻa card, and the way their answers reach the app.
  make   writes culture/review/ahupuaa-<island>.csv: one row per ahupuaʻa with every part the card shows, in plain
         words, and five blank verdict columns (name, land, mahele, life, places). The partner writes ok or no in
         each, a correction if they have one, their organisation and the date. Blank means not yet reviewed.
  apply  reads the filled sheets back and writes culture/review/<island>.json, which the app loads. A "no" part
         disappears from the card; the Needs cultural review banner turns to Culturally reviewed only when every
         part is ok, no, or na (nothing to review).
  python3 culture/review/sheet.py make|apply
"""
import csv, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
ISLANDS = ("kauai", "maui", "oahu", "hawaii")
PARTS = ("name", "land", "mahele", "life", "places")
COLS = ["island", "id", "ahupuaa", "moku", "name_meaning", "land", "mahele", "life", "place_names",
        "ok_name", "ok_land", "ok_mahele", "ok_life", "ok_places", "correction", "reviewer_org", "reviewed_on"]
HOLD = {"gov": "Government land", "crown": "Crown land", "kept": "konohiki land"}
def load(path):
    return json.load(open(path)) if os.path.exists(path) else {"ahupuaa": {}}
def make():
    for isl in ISLANDS:
        fc = json.load(open(os.path.join(ROOT, "culture", "ahupuaa", isl + ".geojson")))
        S = load(os.path.join(ROOT, "culture", "sources", isl + ".json"))["ahupuaa"]
        L = load(os.path.join(ROOT, "culture", "life", isl + ".json"))
        rows = []
        for f in sorted(fc["features"], key=lambda f: (f["properties"]["moku"], f["properties"]["ahupuaa"])):
            p = f["properties"]; k = str(p["id"]); r = S.get(k, {}); parts = r.get("s", [])
            mean = "; ".join(f'{x["n"]}: "{x["mean"]}" ({x.get("by", "PEM")})' for x in parts if x.get("mean"))
            land = []
            if r.get("ft"): land.append(f'ground {round(r["ft"][0])} to {round(r["ft"][1])} ft')
            if r.get("rain"): land.append(f'rain {r["rain"][0]} to {r["rain"][1]} in a year')
            if r.get("wai"): land.append("streams " + ", ".join(w["n"] + (" (all year)" if w.get("p") else "") for w in r["wai"]))
            mh = "; ".join(f'{x["n"]}: {HOLD[x["mahele"]["k"]]}' + (f', {x["mahele"]["who"]}' if x["mahele"].get("who") else "")
                           + (f', LCA {x["mahele"]["lca"]}' if x["mahele"].get("lca") else "") for x in parts if x.get("mahele"))
            lr = L["ahupuaa"].get(k)
            life = "; ".join(" / ".join(v for v in L["taxa"][t][:3] if v) for t, n in lr["t"]) if lr else ""
            names = sum(x.get("count", 0) for x in parts)
            rows.append({"island": isl, "id": k, "ahupuaa": p["ahupuaa"], "moku": p["moku"], "name_meaning": mean,
                         "land": "; ".join(land), "mahele": mh, "life": life, "place_names": names or ""})
        out = os.path.join(HERE, f"ahupuaa-{isl}.csv")
        old = {r["id"]: r for r in csv.DictReader(open(out, encoding="utf-8"))} if os.path.exists(out) else {}
        with open(out, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, COLS); w.writeheader()
            for r in rows:   # keep any verdicts already written
                for c in COLS[9:]: r[c] = old.get(r["id"], {}).get(c, "")
                w.writerow(r)
        print(f"{out}: {len(rows)} rows")
def apply():
    for isl in ISLANDS:
        path = os.path.join(HERE, f"ahupuaa-{isl}.csv")
        if not os.path.exists(path): continue
        out = {}
        for r in csv.DictReader(open(path, encoding="utf-8")):
            v = {k: r["ok_" + k].strip().lower() for k in PARTS if r["ok_" + k].strip().lower() in ("ok", "no", "na")}
            if not v: continue
            if r["reviewer_org"].strip(): v["by"] = r["reviewer_org"].strip()
            if r["reviewed_on"].strip(): v["on"] = r["reviewed_on"].strip()
            if r["correction"].strip(): v["note"] = r["correction"].strip()
            out[r["id"]] = v
        with open(os.path.join(HERE, isl + ".json"), "w", encoding="utf-8") as fh:
            json.dump({"v": 1, "ahupuaa": out}, fh, ensure_ascii=False, separators=(",", ":"))
        print(f"{isl}: {len(out)} ahupuaʻa with verdicts")
if __name__ == "__main__":
    {"make": make, "apply": apply}[sys.argv[1]]()
