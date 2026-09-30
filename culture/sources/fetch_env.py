#!/usr/bin/env python3
"""Ground, rain and streams for every State ahupuaʻa polygon, written to <cache-dir>/env_<island>.json.
  elev    USGS 3DEP ImageServer computeStatisticsHistograms (min, max, mean metres)
  rain    Hawaiʻi Statewide GIS Climate/MapServer/13, Rainfall Atlas isohyets crossing the polygon
  streams Hawaiʻi Statewide GIS FreshWater/MapServer/1, DAR streams crossing the polygon
Resumable; short timeouts with retries, because a slow call is cheaper to retry than to wait out.
  python3 culture/sources/fetch_env.py <island> [cache-dir]
"""
import json, os, sys, time, urllib.request, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
UA = {"User-Agent": "Mozilla/5.0 (OceanSafe educational research)"}
SG = "https://geodata.hawaii.gov/arcgis/rest/services"
def post(u, params, tries=5):
    data = urllib.parse.urlencode(params).encode(); err = None
    for t in range(tries):
        try: return json.loads(urllib.request.urlopen(urllib.request.Request(u, data=data, headers=UA), timeout=15).read())
        except Exception as e: err = e; time.sleep(1 + t)
    return {"error": str(err)}
def esri(geom):
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    return {"rings": [r for p in polys for r in p], "spatialReference": {"wkid": 4326}}
def distinct(layer, geom, fields):
    d = post(f"{SG}/{layer}/query", {"geometry": json.dumps(esri(geom)), "geometryType": "esriGeometryPolygon", "inSR": 4326, "spatialRel": "esriSpatialRelIntersects", "outFields": fields, "returnDistinctValues": "true", "returnGeometry": "false", "f": "json"})
    return {"error": d['error']} if 'error' in d else [f['attributes'] for f in d.get('features', [])]
def elev(geom):
    d = post("https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/computeStatisticsHistograms", {"geometry": json.dumps(esri(geom)), "geometryType": "esriGeometryPolygon", "pixelSize": json.dumps({"x": 20, "y": 20, "spatialReference": {"wkid": 3857}}), "f": "json"})
    s = (d.get('statistics') or [{}])[0]
    return {"min_m": s.get('min'), "max_m": s.get('max'), "mean_m": s.get('mean')} if s else {"error": d.get('error')}
if __name__ == '__main__':
    isl = sys.argv[1]; D = sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser('~/.cache/oceansafe-culture-sources')
    os.makedirs(D, exist_ok=True); path = os.path.join(D, f'env_{isl}.json')
    fc = json.load(open(os.path.join(ROOT, 'culture', 'ahupuaa', isl + '.geojson')))
    out = json.load(open(path)) if os.path.exists(path) else {}
    for f in fc['features']:
        p = f['properties']; k = str(p['id'])
        if k in out and 'error' not in json.dumps(out[k]): continue
        g = f['geometry']
        out[k] = {"name": p['ahupuaa'], "moku": p['moku'], "elev": elev(g), "rain": distinct("Climate/MapServer/13", g, "contour"), "streams": distinct("FreshWater/MapServer/1", g, "stream_nam,trib_nam,type")}
        json.dump(out, open(path, 'w'), ensure_ascii=False)
    print(isl, 'done', len(out))
