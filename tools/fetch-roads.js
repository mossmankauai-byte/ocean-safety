// Overpass -> trimmed GeoJSON of the island's named road network, clipped to the ahupuaʻa union.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const WT = process.env.HOME + '/Desktop/OceanSafe/wt-culture';
const ISLANDS = {
  kauai:  [21.777819, -159.915072, 22.327009, -159.184384],
  oahu:   [21.169354, -158.371494, 21.795169, -157.553816],
  maui:   [20.436550, -156.768580, 21.134063, -155.893390],
  hawaii: [18.766178, -156.220653, 20.436262, -154.643036]
};
const MAJOR = /^(motorway|trunk|primary)/;
const KEEP  = /^(motorway|trunk|primary)$/;   // the through routes; secondary and below are noise at island zoom

const pip = (pt, ring) => { // even-odd, [lon,lat] ring
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inIsland = (pt, polys) => polys.some((rings) => pip(pt, rings[0]) && !rings.slice(1).some((h) => pip(pt, h)));

// Douglas-Peucker in degrees; 0.0002 deg is about 20 m, finer than the plate can show.
const dp = (pts, tol) => {
  if (pts.length < 3) return pts;
  let mx = 0, mi = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d > mx) { mx = d; mi = i; }
  }
  if (mx <= tol) return [pts[0], pts[pts.length - 1]];
  return dp(pts.slice(0, mi + 1), tol).slice(0, -1).concat(dp(pts.slice(mi), tol));
};

(async () => {
  for (const [slug, bb] of Object.entries(ISLANDS)) {
    const q = `[out:json][timeout:180];way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|tertiary)$"](${bb.join(',')});out geom;`;
    const raw = path.join(__dirname, slug + '-raw.json');
    const HOSTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
    for (let a = 0; !fs.existsSync(raw) && a < 8; a++) {
      const host = HOSTS[a % HOSTS.length];
      try {
        execFileSync('curl', ['-s', '--max-time', '300', '-A', 'OceanSafe/1.0 (oceansafety.app)',
          '--data-urlencode', 'data=' + q, host, '-o', raw + '.try']);
        const t = fs.readFileSync(raw + '.try', 'utf8');
        if (t.trimStart().startsWith('{')) { fs.renameSync(raw + '.try', raw); break; }
        console.log(`  ${slug} attempt ${a + 1} on ${host.split('/')[2]}: ${(t.match(/Error<\/strong>: ([^<]+)/) || [, 'not JSON'])[1].trim().slice(0, 70)}`);
      } catch (e) { console.log(`  ${slug} attempt ${a + 1}: ${e.message.slice(0, 60)}`); }
      execFileSync('sleep', ['12']);
    }
    if (!fs.existsSync(raw)) { console.log(`${slug}: SKIPPED, Overpass never answered`); continue; }
    const os = JSON.parse(fs.readFileSync(raw, 'utf8'));
    const land = JSON.parse(fs.readFileSync(path.join(WT, 'culture/ahupuaa', slug + '.geojson'), 'utf8'));
    const polys = [];
    for (const f of land.features) {
      const g = f.geometry;
      if (g.type === 'Polygon') polys.push(g.coordinates);
      else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => polys.push(p));
    }
    const feats = [], raws = [];
    for (const w of os.elements) {
      if (!w.geometry || w.geometry.length < 2) continue;
      const pts = w.geometry.map((p) => [p.lon, p.lat]);
      const mid = pts[Math.floor(pts.length / 2)];
      if (!KEEP.test(w.tags.highway)) continue;
      if (!inIsland(mid, polys) && !inIsland(pts[0], polys)) continue;   // off this island, drop it
      raws.push([MAJOR.test(w.tags.highway) ? 1 : 2, pts]);
    }
    // OSM splits a highway at every tag change, so a single route arrives as dozens of stubs. Stitched
    // end to end BEFORE simplifying, they become continuous ink; simplified first they become dust.
    for (const cls of [1, 2]) {
      const segs = raws.filter((r) => r[0] === cls).map((r) => r[1]);
      const key = (p) => p[0].toFixed(7) + ',' + p[1].toFixed(7);
      const ends = new Map();
      segs.forEach((sg, i) => { for (const e of [key(sg[0]), key(sg[sg.length - 1])]) {
        if (!ends.has(e)) ends.set(e, []); ends.get(e).push(i); } });
      const used = new Set();
      for (let i = 0; i < segs.length; i++) {
        if (used.has(i)) continue;
        used.add(i);
        let chain = segs[i].slice();
        for (let dir = 0; dir < 2; dir++) {
          for (;;) {
            const tail = key(chain[chain.length - 1]);
            const nxt = (ends.get(tail) || []).find((j) => !used.has(j));
            if (nxt == null) break;
            used.add(nxt);
            const sg = segs[nxt];
            chain = chain.concat(key(sg[0]) === tail ? sg.slice(1) : sg.slice(0, -1).reverse());
          }
          chain.reverse();   // then run the other way from the original start
        }
        const sm = dp(chain, 0.00012).map((p) => [+p[0].toFixed(5), +p[1].toFixed(5)]);
        if (sm.length >= 2) feats.push([cls, sm]);
      }
    }
    // Two features per island, not two thousand: one MultiLineString per weight. The per-feature JSON
    // wrapper was most of the file, and the renderer wants one stroke style per class anyway.
    const out = { type: 'FeatureCollection', features: [1, 2].map(function(c){
      return { type: 'Feature', properties: { c: c },
               geometry: { type: 'MultiLineString', coordinates: feats.filter(function(f){ return f[0] === c; }).map(function(f){ return f[1]; }) } };
    }).filter(function(f){ return f.geometry.coordinates.length; }) };
    const dir = path.join(WT, 'culture/roads');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, slug + '.geojson');
    fs.writeFileSync(file, JSON.stringify(out));
    const kb = (fs.statSync(file).size / 1024).toFixed(0);
    console.log(`${slug}: ${os.elements.length} ways in bbox -> ${raws.length} kept, stitched into ${feats.length} routes, ${kb} KB`);
  }
})();
