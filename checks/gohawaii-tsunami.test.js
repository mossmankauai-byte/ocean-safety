#!/usr/bin/env node
/* GoHawaii tsunami way-out map: headless test against a real render.
 *
 * What it proves:
 *   1. A no-ref load never fetches /gh/, even with ?gh_demo=tsunami on the URL.
 *   2. The review demo (?gh_demo=tsunami) takes the screen with "Show the way out"; the button opens
 *      the full-screen map; a picked beach gets its saved walking route; closing returns to the app.
 *   3. On a beach card, the warning carries "Way out from here" and opens that beach's route.
 *   4. A location inside the zone, outside it, and off the island each get their own message; inside,
 *      the visitor is joined to the nearest saved route.
 *   5. From the NWS feed, only a Tsunami Warning gets the map. A Tsunami Advisory keeps its
 *      full-screen card with no map (its action is to leave the water, not the zone).
 *   6. A beach with no saved route still says to go inland and uphill.
 * Writes screenshots to <outdir> for review.
 *
 *   ORIGIN=http://127.0.0.1:4631 node checks/gohawaii-tsunami.test.js <outdir>
 */
'use strict';
const puppeteer = require('/Users/nickmossman/Desktop/OceanSafe/brochure-src/node_modules/puppeteer-core');
const fs = require('fs'), path = require('path');
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:4631';
const OUT = process.argv[2] || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const fails = [];
function check(cond, msg){ if(cond) console.log('  ok   ' + msg); else { console.log('  FAIL ' + msg); fails.push(msg); } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const H = 3600e3, now = Date.now(), iso = (t) => new Date(t).toISOString();
function nwsAlert(o){
  return { id: 'https://api.weather.gov/alerts/' + o.id, properties: Object.assign({
    id: o.id, status: 'Actual', messageType: 'Alert', sent: iso(now - H), effective: iso(now - H), onset: iso(now - H),
    ends: iso(now + 5 * H), expires: iso(now + 5 * H), headline: o.event + ' issued by NWS Honolulu HI', instruction: ''
  }, o) };
}
const fc = (f) => ({ type: 'FeatureCollection', features: f });
const EMPTY = fc([]);

async function page(br, url, opts){
  opts = opts || {};
  const ctx = await br.createBrowserContext();
  const pg = await ctx.newPage();
  await pg.setViewport({ width: opts.w || 390, height: opts.h || 844, deviceScaleFactor: 2 });
  if(opts.geo){
    await ctx.overridePermissions(ORIGIN, ['geolocation']);
    await pg.setGeolocation({ latitude: opts.geo[0], longitude: opts.geo[1], accuracy: 10 });
  }
  const reqs = [];
  await pg.setRequestInterception(true);
  pg.on('request', (r) => {
    const u = r.url(); reqs.push(u);
    if(u.indexOf('api.weather.gov/alerts') >= 0)
      return r.respond({ status: 200, contentType: 'application/geo+json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(opts.nws || EMPTY) });
    if(u.indexOf('/api/hta-feed') >= 0) return r.respond({ status: 200, contentType: 'application/rss+xml', body: '<?xml version="1.0"?><rss version="2.0"><channel><title>HTA</title></channel></rss>' });
    r.continue();
  });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(ORIGIN + url, { waitUntil: 'networkidle2', timeout: 60000 });
  return { ctx, pg, reqs, errs };
}
const tsuText = (pg) => pg.evaluate(() => { const w = document.getElementById('ghTsu'); return w ? w.querySelector('.ght-body').innerText : ''; });
const routeDrawn = (pg) => pg.evaluate(() => document.querySelectorAll('#ghTsuMap path.leaflet-interactive, #ghTsuMap .leaflet-overlay-pane path').length);

(async () => {
  const br = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });

  console.log('1. no ref: nothing loads, even with the demo flag');
  let t = await page(br, '/?island=kauai&gh_demo=tsunami');
  await sleep(2500);
  check(!t.reqs.some(u => /\/gh\//.test(u)), 'no /gh/ request on a no-ref load');
  check(await t.pg.evaluate(() => !document.getElementById('ghaRed') && !document.getElementById('ghTsu') && !window.ghTsuOpen), 'no tsunami UI on a no-ref load');
  check(!t.errs.length, 'no page errors (no ref) ' + t.errs.join(' | '));
  await t.ctx.close();

  console.log('2. Kauaʻi review demo');
  t = await page(br, '/?ref=gohawaii&island=kauai&gh_demo=tsunami');
  await t.pg.waitForSelector('#ghaRed', { timeout: 15000 }).catch(() => {});
  const red = await t.pg.evaluate(() => { const r = document.getElementById('ghaRed'); return r ? { t: document.getElementById('ghaRedT').textContent, way: !!r.querySelector('.gha-way'), txt: r.innerText } : null; });
  check(red && red.t === 'Tsunami Warning', 'the sample Tsunami Warning takes the screen');
  check(red && red.way, 'the red card offers "Show the way out"');
  check(red && /sample tsunami warning for the review build/i.test(red.txt), 'the card says it is a sample');
  await t.pg.screenshot({ path: path.join(OUT, 'tsu-kauai-1-warning-390.png') });
  await t.pg.click('#ghaRed .gha-way');
  await t.pg.waitForFunction(() => { const w = document.getElementById('ghTsu'); return w && /Where are you|evacuation zone|outside/.test(w.innerText); }, { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  check(await t.pg.evaluate(() => !document.getElementById('ghaRed') && !!document.getElementById('ghTsu')), 'the way-out map opens full screen');
  check(/Where are you/.test(await tsuText(t.pg)), 'with no beach and no location it asks where you are');
  check(await t.pg.evaluate(() => document.querySelectorAll('#ghTsu select option').length) === 24, 'the beach list carries all 23 Kauaʻi beaches');
  await t.pg.screenshot({ path: path.join(OUT, 'tsu-kauai-2-where-390.png') });
  await t.pg.select('#ghTsu select', 'poipu'); await sleep(2500);
  let txt = await tsuText(t.pg);
  check(/is in the evacuation zone/.test(txt) && /Nearest way out/.test(txt) && /Out of the zone/.test(txt), 'a picked beach gets its walking route and steps');
  check(/Felt shaking/.test(txt), 'the shaking rule is always on screen');
  check((await routeDrawn(t.pg)) >= 4, 'zones and the route are drawn on the map');
  await t.pg.screenshot({ path: path.join(OUT, 'tsu-kauai-3-poipu-390.png') });
  const longId = await t.pg.evaluate(() => { const R = window.GH_TSU.kauai.routes; return Object.keys(R).filter(k => R[k].d > 2000).sort((a, b) => R[b].d - R[a].d)[0] || ''; });
  if(longId){
    await t.pg.select('#ghTsu select', longId); await sleep(2000);
    check(/long way on foot/.test(await tsuText(t.pg)), 'a route over 2 km suggests driving (' + longId + ')');
    await t.pg.screenshot({ path: path.join(OUT, 'tsu-kauai-4-long-390.png') });
  }
  await t.pg.select('#ghTsu select', 'pakala'); await sleep(1200);
  check(/no saved route/.test(await tsuText(t.pg)) && /inland and uphill/.test(await tsuText(t.pg)), 'a beach with no saved route still says go inland and uphill');
  await t.pg.click('#ghTsu .ght-x'); await sleep(600);
  check(await t.pg.evaluate(() => !document.getElementById('ghTsu')), 'close returns to the app');
  const bar = await t.pg.evaluate(() => (document.getElementById('ghaBar') || {}).textContent || '');
  check(/Tsunami Warning/.test(bar), 'the warning stays in the bar');
  await t.pg.evaluate(() => openSheet('shipwreck')); await sleep(1200);
  const card = await t.pg.evaluate(() => { const b = document.querySelector('#sc .gha-waybtn'); return b ? b.textContent : ''; });
  check(/Way out from here: \d/.test(card), 'the beach card offers "Way out from here" with the distance');
  await t.pg.screenshot({ path: path.join(OUT, 'tsu-kauai-5-beach-card-390.png') });
  await t.pg.click('#sc .gha-waybtn'); await sleep(2500);
  check(/Shipwreck/.test(await tsuText(t.pg)), 'the beach card opens that beach\'s route');
  await t.pg.screenshot({ path: path.join(OUT, 'tsu-kauai-6-shipwreck-390.png') });
  check(!t.errs.length, 'no page errors (demo) ' + t.errs.join(' | '));
  await t.ctx.close();

  console.log('3. location: in the zone, outside it, off the island');
  for(const [name, ll, re] of [['in', [21.8743, -159.4547], /You are in the evacuation zone/], ['out', [21.9066, -159.4658], /outside the mapped zone/], ['away', [21.3069, -157.8583], /not on Kauaʻi/]]){
    t = await page(br, '/?ref=gohawaii&island=kauai&gh_demo=tsunami', { geo: ll });
    await t.pg.waitForSelector('#ghaRed .gha-way', { timeout: 15000 }).catch(() => {});
    await t.pg.click('#ghaRed .gha-way').catch(() => {});
    await t.pg.waitForSelector('#ghTsu .ght-loc', { timeout: 10000 }).catch(() => {});
    await sleep(1500);
    await t.pg.click('#ghTsu .ght-loc').catch(() => {}); await sleep(2500);
    check(re.test(await tsuText(t.pg)), 'location ' + name + ': ' + re);
    if(name === 'in') check(/From where you are/.test(await tsuText(t.pg)) && /Walk to the blue route|Follow the blue route/.test(await tsuText(t.pg)), 'location in: joins the nearest saved route, no network needed');
    await t.pg.screenshot({ path: path.join(OUT, 'tsu-kauai-7-location-' + name + '-390.png') });
    check(!t.errs.length, 'no page errors (location ' + name + ') ' + t.errs.join(' | '));
    await t.ctx.close();
  }

  console.log('4. NWS feed: Warning gets the map, Advisory does not');
  t = await page(br, '/?ref=gohawaii&island=kauai', { nws: fc([nwsAlert({ id: 'w1', event: 'Tsunami Warning', areaDesc: 'Kauai Windward; Kauai Leeward', description: '* WHERE...All coasts of Kauai.' })]) });
  await t.pg.waitForSelector('#ghaRed', { timeout: 15000 }).catch(() => {});
  check(await t.pg.evaluate(() => !!document.querySelector('#ghaRed .gha-way')), 'an NWS Tsunami Warning offers the way-out map');
  await t.ctx.close();
  t = await page(br, '/?ref=gohawaii&island=kauai', { nws: fc([nwsAlert({ id: 'a1', event: 'Tsunami Advisory', areaDesc: 'Kauai Windward; Kauai Leeward', description: '* WHERE...All coasts of Kauai.' })]) });
  await t.pg.waitForSelector('#ghaRed', { timeout: 15000 }).catch(() => {});
  const adv = await t.pg.evaluate(() => { const r = document.getElementById('ghaRed'); return r ? { t: document.getElementById('ghaRedT').textContent, way: !!r.querySelector('.gha-way') } : null; });
  check(adv && adv.t === 'Tsunami Advisory', 'a Tsunami Advisory keeps its full-screen card');
  check(adv && !adv.way, 'a Tsunami Advisory gets no way-out map');
  check(!t.reqs.some(u => /\/gh\/tsunami\//.test(u)), 'an Advisory never loads the zone file');
  await t.ctx.close();

  await br.close();
  console.log(fails.length ? '\n' + fails.length + ' FAIL' : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
