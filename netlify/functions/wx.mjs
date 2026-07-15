// OceanSafe conditions proxy + cache.
// Collapses every visitor's direct open-meteo + NOAA calls into one cached
// server-side fetch per ~1km grid cell (live) or per fixed region set (side),
// so a busy hotel lobby behind one IP can't throttle the upstream free APIs
// and the safety data never goes blank under load.
//
// Endpoints (via /api/wx redirect):
//   /api/wx?k=live&lat=21.98&lon=-159.37&island=kauai  -> { w, s, td, q }  (forecast, marine, tides, USGS discharge)
//   /api/wx?k=side&lats=a,b,c&lons=d,e,f                -> open-meteo multi-point forecast
//
// Hosts are hardcoded; only validated numeric coords are injected (no SSRF). The ?island=
// param only ever indexes the fixed in-code ISLAND_WX map (unknown -> kauai), and USGS gauge
// ids come from that map too — never from user input.
// Netlify durable CDN cache: 10 min fresh, serve-stale up to 1h while revalidating.

const TZ = 'Pacific%2FHonolulu';
const OM = 'https://api.open-meteo.com/v1/forecast';
const MARINE = 'https://marine-api.open-meteo.com/v1/marine';

// Per-island weather config — bbox clamp, sea-level default coord, NOAA tide station, and
// the USGS brown-water gauges keyed by the island's shore taxonomy. Selected by ?island=;
// DEFAULTS to kauai when absent so existing callers / cached URLs never break.
//   usgs:null on an island = no river-discharge leg yet -> q:null -> the client uses the
//   precipitation leg alone for brown water (never a false all-clear, never a false high).
//   Kauaʻi gauges: 16103000 Hanalei + 16108000 Wainiha -> North Shore (dual-gauge max);
//   16060000 SF Wailua -> East Side.
const ISLAND_WX = {
  kauai:  { latMin: 21.7,  latMax: 22.4,  lonMin: -160.1,  lonMax: -159.2,  dLat: 21.9788, dLon: -159.3672, tide: '1611400', usgs: { north: ['16103000', '16108000'], east: ['16060000'] } },
  maui:   { latMin: 20.5,  latMax: 21.05, lonMin: -156.7,  lonMax: -155.98, dLat: 20.89,   dLon: -156.47,   tide: '1615680', usgs: null },
  oahu:   { latMin: 21.2,  latMax: 21.75, lonMin: -158.32, lonMax: -157.55, dLat: 21.28,   dLon: -157.83,   tide: '1612340', usgs: null },
  hawaii: { latMin: 18.85, latMax: 20.30, lonMin: -156.15, lonMax: -154.75, dLat: 19.64,   dLon: -155.99,   tide: '1617433', usgs: null },
};
const tidesUrl = (st) => 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'
  + `?date=today&station=${st}&product=predictions&datum=MLLW&time_zone=lst_ldt&interval=h&units=english&format=json`;
const usgsUrl = (sites) => 'https://waterservices.usgs.gov/nwis/iv/'
  + `?format=json&sites=${sites.join(',')}&parameterCd=00060&period=P2D`;

const LIVE_CUR = 'temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,uv_index';
const LIVE_HRLY = 'precipitation,precipitation_probability';
const LIVE_DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,cloud_cover_mean,weather_code,sunrise,sunset';
// SOUTH-SWELL FIX: forward the sea-state PARTITIONS (swell + wind-wave), not just the
// collapsed total/dominant. The client's eff() needs the head-on swell partition to credit a
// south-facing beach (the dominant total direction is the transverse trade wind-wave in summer).
// Legacy total fields stay FIRST/unchanged; absent partitions are fail-safe on the client.
const MAR_CUR = 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction,wind_wave_height,wind_wave_period,wind_wave_direction';
const MAR_DAILY = 'wave_height_max,wave_direction_dominant,wave_period_max,swell_wave_height_max,swell_wave_period_max,swell_wave_direction_dominant,wind_wave_height_max,wind_wave_period_max,wind_wave_direction_dominant';
const SIDE_CUR = 'temperature_2m,wind_speed_10m,uv_index';
const SIDE_DAILY = 'precipitation_probability_max';

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=120',
  // Netlify edge: fresh 10 min, then serve stale up to 1h while it revalidates in the background.
  'netlify-cdn-cache-control': 'public, durable, s-maxage=600, stale-while-revalidate=3600',
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: HEADERS });

// numeric coord lists only — blocks anything that isn't lat/lon
const coordsOk = (v) => typeof v === 'string' && v.length < 200 && /^-?\d{1,3}(\.\d+)?(,-?\d{1,3}(\.\d+)?)*$/.test(v);

async function getJSON(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { const r = await fetch(url, { signal: ctrl.signal }); return r.ok ? await r.json() : null; }
  catch { return null; }
  finally { clearTimeout(t); }
}

export default async (req) => {
  const url = new URL(req.url);
  const k = url.searchParams.get('k') || 'live';

  if (k === 'side') {
    const lats = url.searchParams.get('lats'), lons = url.searchParams.get('lons');
    if (!coordsOk(lats) || !coordsOk(lons)) return json({ error: 'bad coords' }, 400);
    const u = `${OM}?latitude=${lats}&longitude=${lons}&current=${SIDE_CUR}&daily=${SIDE_DAILY}&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=${TZ}`;
    const data = await getJSON(u);
    if (!data) return json({ error: 'upstream' }, 502);
    return json(data);
  }

  // k === 'live'
  const isl = ISLAND_WX[url.searchParams.get('island')] || ISLAND_WX.kauai;
  let lat = parseFloat(url.searchParams.get('lat'));
  let lon = parseFloat(url.searchParams.get('lon'));
  // default to the island's sea-level coord if missing/off-island; snap to ~1km grid for cache sharing
  if (!Number.isFinite(lat) || lat < isl.latMin || lat > isl.latMax) lat = isl.dLat;
  if (!Number.isFinite(lon) || lon < isl.lonMin || lon > isl.lonMax) lon = isl.dLon;
  lat = +lat.toFixed(2); lon = +lon.toFixed(2);

  const fUrl = `${OM}?latitude=${lat}&longitude=${lon}&current=${LIVE_CUR}&hourly=${LIVE_HRLY}&daily=${LIVE_DAILY}&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=${TZ}`;
  const sUrl = `${MARINE}?latitude=${lat}&longitude=${lon}&current=${MAR_CUR}&daily=${MAR_DAILY}&models=best_match&length_unit=imperial&timezone=${TZ}`;
  // USGS gauges are per-island (or absent). Sites come from the in-code map -> SSRF-safe.
  const sites = isl.usgs ? Object.values(isl.usgs).flat() : null;

  const [w, s, td, usgs] = await Promise.all([
    getJSON(fUrl), getJSON(sUrl), getJSON(tidesUrl(isl.tide)),
    sites ? getJSON(usgsUrl(sites)) : Promise.resolve(null),
  ]);
  if (!w) return json({ error: 'upstream' }, 502); // forecast is required; marine/tides/usgs may be null (app fail-safes)
  // Parse USGS daily-MAX discharge per shore into q (e.g. Kauaʻi { north, east }); null when
  // this island has no gauges or none reported. The client treats a null q (no gauges, USGS
  // down, or an old cached response without q) as "no extra fire" so the precip leg governs
  // alone — never a false all-clear, never a false high.
  const q = parseUsgsQ(usgs, isl.usgs);
  return json({ w, s, td, q });
};

// Parse USGS NWIS iv JSON to per-shore daily-MAX discharge, keyed off the island's gauge map
// (e.g. { north:['16103000','16108000'], east:['16060000'] }). Each shore = max of its gauges'
// daily-max. Returns null when there are no gauges or no gauge yields a finite reading, so the
// client's window._streamQ stays null and streamQOver()/bw() add no fire.
function parseUsgsQ(usgs, gauges) {
  if (!usgs || !gauges || !usgs.value || !Array.isArray(usgs.value.timeSeries)) return null;
  const dailyMax = {};
  for (const ts of usgs.value.timeSeries) {
    const site = ts.sourceInfo && ts.sourceInfo.siteCode && ts.sourceInfo.siteCode[0] && ts.sourceInfo.siteCode[0].value;
    const vals = ts.values && ts.values[0] && ts.values[0].value;
    if (!site || !Array.isArray(vals)) continue;
    let mx = null;
    for (const v of vals) {
      const x = parseFloat(v && v.value);
      if (!Number.isFinite(x) || x < 0 || x === -999999) continue; // skip junk / sentinels
      if (mx === null || x > mx) mx = x;
    }
    if (mx !== null) dailyMax[site] = mx;
  }
  const q = {};
  let any = false;
  for (const shore of Object.keys(gauges)) {
    const vals = (gauges[shore] || []).map((s) => dailyMax[s]).filter((v) => Number.isFinite(v));
    q[shore] = vals.length ? Math.max.apply(null, vals) : null; // dual/multi-gauge max
    if (q[shore] !== null) any = true;
  }
  return any ? q : null;
}
