#!/usr/bin/env node
// Build /gh/tsunami/<slug>.js for the GoHawaii build: the state's tsunami evacuation zones for each
// island we cover, and a walking route from every beach in gh/beaches.json to the nearest spot
// outside the zone. The app loads the file only for a public ref, and only while a Tsunami Warning
// is on (or the ?gh_demo=tsunami review link). Routes are worked out here, ahead of time, so the
// map and directions still show when the network jams during an evacuation.
//   node scripts/build-tsunami-routes.mjs            (all four islands, about 5 minutes)
//   node scripts/build-tsunami-routes.mjs kauai      (one island)
// Sources:
//   zones   Hawaii Statewide GIS, Hazards MapServer layer 2 (Tsunami Evacuation Zones) and 12
//           (Extreme Tsunami Evacuation Zones). `island` is UPPERCASE; mixed case returns nothing.
//           Layer 12 is only the extra band past layer 2, not a superset.
//   routes  OpenStreetMap paths through the FOSSGIS walking router (routing.openstreetmap.de).
//           One table call and one route call per beach, a second apart: it is a shared server.
//           Layer 13 (Tsunami Safe Zones) is the land outside both. It is used here only, never shipped:
//           an exit must be on it or in the extreme band, so no route can end on a pier or a point of rock.
// A route ends at the first spot outside the mapped zone. The zone is the minimum distance, so the
// app always says to keep going inland. No route is made for the extreme zone: the NWS feed does
// not say when officials call for it.
import fs from 'node:fs';
const ROOT = new URL('../', import.meta.url);
const OUT = new URL('gh/tsunami/', ROOT);
const UA = { 'User-Agent': 'oceansafety.app tsunami route build (mossmankauai@gmail.com)' };
const GIS = 'https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer';
const OSRM = 'https://routing.openstreetmap.de/routed-foot';
const GIS_ISLAND = { kauai: 'KAUAI', oahu: 'OAHU', maui: 'MAUI', hawaii: 'HAWAII' };
const SIMPLIFY = 0.00008;          // degrees, about 9 m
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastCall = 0;
async function getJson(url) {
  const wait = 1100 - (Date.now() - lastCall); if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { headers: UA }); if (r.ok) return await r.json(); }
    catch (e) {}
    await sleep(3000 * (i + 1));
  }
  throw new Error('fetch failed: ' + url.slice(0, 120));
}

// ---- beaches: gh/beaches.json ids, coordinates from the app's own data ----
const GH = JSON.parse(fs.readFileSync(new URL('gh/beaches.json', ROOT), 'utf8'));
const SRC = { kauai: fs.readFileSync(new URL('index.html', ROOT), 'utf8') };
for (const s of ['maui', 'oahu', 'hawaii']) SRC[s] = fs.readFileSync(new URL(`data/${s}.js`, ROOT), 'utf8');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function coords(slug, id) {
  const m = new RegExp(`["']?id["']?\\s*:\\s*["']${esc(id)}["'][^{}]*?["']?lat["']?\\s*:\\s*(-?[0-9.]+)\\s*,\\s*["']?lon["']?\\s*:\\s*(-?[0-9.]+)`).exec(SRC[slug]);
  if (!m) throw new Error(`no coordinates for ${slug}/${id}`);
  return [+m[2], +m[1]];           // [lon, lat]
}

// ---- geometry ----
const M_LAT = 111320;
function rings(g) { return (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]).flat(); }
function ringBox(r) { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [x, y] of r) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); } return [a, b, c, d]; }
function prep(g) { return rings(g).map(r => ({ r, box: ringBox(r) })); }
function near(R, p, m) {
  const dx = m / (M_LAT * Math.cos(p[1] * Math.PI / 180)), dy = m / M_LAT;
  return R.filter(({ box }) => box[0] <= p[0] + dx && box[1] >= p[0] - dx && box[2] <= p[1] + dy && box[3] >= p[1] - dy);
}
function inside(R, p) {                 // even-odd over every ring, so holes count
  let c = false;
  for (const { r, box } of R) {
    if (p[0] < box[0] || p[0] > box[1] || p[1] < box[2] || p[1] > box[3]) continue;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}
function edgePoint(R, p) {              // nearest point on any ring: [metres, [lon, lat]]
  const kx = M_LAT * Math.cos(p[1] * Math.PI / 180); let best = [1e9, null];
  for (const { r } of R) for (let i = 0; i < r.length - 1; i++) {
    const ax = (r[i][0] - p[0]) * kx, ay = (r[i][1] - p[1]) * M_LAT, bx = (r[i + 1][0] - p[0]) * kx, by = (r[i + 1][1] - p[1]) * M_LAT;
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best[0]) best = [d, [p[0] + (ax + t * dx) / kx, p[1] + (ay + t * dy) / M_LAT]];
  }
  return best;
}
const edgeDist = (R, p) => edgePoint(R, p)[0];
// A beach pin usually sits a little offshore, and the zone is drawn on land, so the pin itself
// tests outside, some of them 500 m to 1 km out, straight off their beach. A pin within SHORE metres
// of the zone is a beach in the zone: its walk starts at the nearest point of the zone, stepped a few
// metres in. A pin farther out gets no route; the app tells that visitor to go inland and uphill.
const SHORE = 1000;
function shoreStart(Z, p) {
  if (inside(Z, p)) return p;
  const R = near(Z, p, SHORE + 50); if (!R.length) return null;
  const [d, q] = edgePoint(R, p); if (!q || d > SHORE) return null;
  const kx = M_LAT * Math.cos(p[1] * Math.PI / 180);
  const ux = (q[0] - p[0]) * kx, uy = (q[1] - p[1]) * M_LAT, L = Math.hypot(ux, uy) || 1;
  for (const m of [8, 20, 40, 80]) {
    const s = [q[0] + ux / L * m / kx, q[1] + uy / L * m / M_LAT];
    if (inside(Z, s)) return s;
  }
  // A thin strip or a corner can sit at an angle to the pin: try every direction from the edge.
  for (const m of [8, 20, 40]) for (let k = 0; k < 16; k++) {
    const a = k * Math.PI / 8, s = [q[0] + Math.cos(a) * m / kx, q[1] + Math.sin(a) * m / M_LAT];
    if (inside(Z, s)) return s;
  }
  return null;
}
function dist(a, b) { return Math.hypot((a[0] - b[0]) * M_LAT * Math.cos(a[1] * Math.PI / 180), (a[1] - b[1]) * M_LAT); }

// Candidate exits: points just outside the zone, nearest first. The router snaps each to a path;
// a snapped point that lands back inside the zone is thrown out.
let LAND = [];                          // safe zone + extreme band for the island being built
const onLand = p => inside(LAND, p);
function candidates(Z, start, radius, step) {
  const R = near(Z, start, radius + 200), out = [], n = Math.ceil(radius / step);
  const kx = M_LAT * Math.cos(start[1] * Math.PI / 180);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const p = [start[0] + i * step / kx, start[1] + j * step / M_LAT];
    if (dist(p, start) > radius || inside(R, p) || !onLand(p)) continue;
    if (edgeDist(R, p) <= step * 1.6) out.push(p);
  }
  return out.sort((a, b) => dist(a, start) - dist(b, start)).slice(0, 90);
}
const f6 = p => p[0].toFixed(6) + ',' + p[1].toFixed(6);
// Each ring of candidates is tried in turn and the shortest route kept. A ring stops the search
// once its best route is reasonably direct for that ring (under 1.5 times its radius); otherwise the
// next, wider ring is tried too. Without this, a beach under a cliff (Polihale) took an 11 km loop
// south and back north to reach high ground a kilometre away.
async function exitRoute(Z, start) {
  let best = null;
  for (const [radius, step] of [[1300, 55], [2600, 110], [5000, 200]]) {
    const C = candidates(Z, start, radius, step); if (!C.length) continue;
    const t = await getJson(`${OSRM}/table/v1/driving/${[start, ...C].map(f6).join(';')}?sources=0&annotations=distance`);
    let pick = null;
    (t.distances?.[0] || []).slice(1).forEach((d, k) => {
      const loc = t.destinations[k + 1].location;
      if (d == null || inside(Z, loc) || !onLand(loc)) return;
      if (!pick || d < pick.d) pick = { d, loc };
    });
    if (pick && (!best || pick.d < best.distance)) {
      const res = await getJson(`${OSRM}/route/v1/driving/${f6(start)};${f6(pick.loc)}?steps=true&geometries=geojson&overview=full`);
      const r = res.routes?.[0];
      if (r && !inside(Z, r.geometry.coordinates.at(-1)) && (!best || r.distance < best.distance)) { r.snap = res.waypoints?.[0]?.distance || 0; best = r; }
    }
    if (best && best.distance <= radius * 1.5) break;
  }
  return best;
}

// Short plain directions: consecutive steps on the same way merge; an unnamed way is "the path".
const fmtM = m => m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`;
function steps(r, snap) {
  const raw = [];
  // The router starts on the nearest mapped path. The walk from the sand to that path is the first step.
  if (snap >= 15) raw.push({ name: 'off the beach', d: snap, mod: '' });
  for (const s of r.legs[0].steps) {
    if (s.maneuver.type === 'arrive') continue;
    const name = (s.name || '').replace(/\bRoad\b/, 'Rd').replace(/\bStreet\b/, 'St').replace(/\bHighway\b/, 'Hwy') || 'the path';
    if (raw.length && raw.at(-1).name === name) { raw.at(-1).d += s.distance; continue; }
    raw.push({ name, d: s.distance, mod: s.maneuver.modifier || '' });
  }
  while (raw.length > 1 && raw.at(-1).d < 25) { const x = raw.pop(); raw.at(-1).d += x.d; }
  return raw.map((s, i) => {
    const turn = /left|right/.test(s.mod) ? s.mod.replace(/^(slight|sharp) /, '') : '';
    const t = s.name === 'off the beach' ? 'Walk inland off the beach' : i === 0 || raw[i - 1].name === 'off the beach' ? `Walk along ${s.name}` : turn ? `Turn ${turn} onto ${s.name}` : `Continue on ${s.name}`;
    return [t, fmtM(s.d)];
  });
}
const r5 = x => Math.round(x * 1e5) / 1e5;
function roundGeom(g) {
  const rr = c => typeof c[0] === 'number' ? [r5(c[0]), r5(c[1])] : c.map(rr);
  return { type: g.type, coordinates: rr(g.coordinates) };
}

async function zone(layer, slug) {
  const u = `${GIS}/${layer}/query?where=${encodeURIComponent(`island='${GIS_ISLAND[slug]}'`)}&outFields=zone_type&returnGeometry=true&outSR=4326&maxAllowableOffset=${SIMPLIFY}&geometryPrecision=5&f=geojson`;
  const fc = await getJson(u);
  const polys = [];
  for (const f of fc.features || []) {
    const g = f.geometry; if (!g) continue;
    if (g.type === 'Polygon') polys.push(g.coordinates); else polys.push(...g.coordinates);
  }
  if (!polys.length) throw new Error(`no layer ${layer} polygons for ${slug}`);
  return roundGeom({ type: 'MultiPolygon', coordinates: polys });
}

const only = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
for (const slug of Object.keys(GH)) {
  if (only && slug !== only) continue;
  const zoneG = await zone(2, slug), extremeG = await zone(12, slug);
  const Z = prep(zoneG);
  LAND = prep(await zone(13, slug)).concat(prep(extremeG));
  const routes = {}; let n = 0, inZ = 0;
  for (const b of GH[slug]) {
    const p = coords(slug, b.id), start = shoreStart(Z, p), isIn = !!start;
    const row = { n: b.name, ll: [r5(p[1]), r5(p[0])], in: isIn };
    if (isIn) {
      inZ++;
      const r = await exitRoute(Z, start);
      if (r) {
        const snap = r.snap || 0;
        row.a = [r5(start[1]), r5(start[0])];                     // where the walk starts, on the shore
        row.d = Math.round(r.distance + snap); row.s = Math.round(r.duration + snap / 1.4);
        row.line = r.geometry.coordinates.map(c => [r5(c[1]), r5(c[0])]);
        row.st = steps(r, snap); n++;
      }
    }
    routes[b.id] = row;
    // A route that ends close to where it started after a long walk is a loop: flag it for a look.
    const loop = row.line && row.d > 1500 && dist([row.line.at(-1)[1], row.line.at(-1)[0]], start) * 4 < row.d ? '  LOOP?' : '';
    process.stdout.write(`${slug} ${b.id}: ${isIn ? (row.d ? row.d + ' m' + loop : 'NO ROUTE') : 'outside zone'}\n`);
  }
  const data = {
    island: slug, built: new Date().toISOString().slice(0, 10),
    src: { zones: 'Hawaii Statewide GIS Program, Tsunami Evacuation Zones and Extreme Tsunami Evacuation Zones', routes: 'OpenStreetMap contributors, FOSSGIS walking router' },
    zone: zoneG, extreme: extremeG, routes
  };
  const body = `// Built by scripts/build-tsunami-routes.mjs on ${data.built}. Do not edit by hand.\n`
    + `// Zones: Hawaii Statewide GIS Program. Routes: OpenStreetMap contributors (ODbL), FOSSGIS walking router.\n`
    + `(window.GH_TSU = window.GH_TSU || {})[${JSON.stringify(slug)}] = ${JSON.stringify(data)};\n`;
  fs.writeFileSync(new URL(`${slug}.js`, OUT), body);
  console.log(`== ${slug}: ${GH[slug].length} beaches, ${inZ} in the zone, ${n} routed, ${Math.round(body.length / 1024)} KB`);
}
