#!/usr/bin/env node
/* GoHawaii advisories: headless test against a real render.
 *
 * The live NWS feed is usually empty, so NWS and HTA responses are served from fixtures through
 * request interception. What it proves:
 *   1. A no-ref load never fetches /gh/ and carries none of the advisory UI.
 *   2. NWS names are mapped from the fixed list: Warning -> red takeover, listed Advisory -> yellow,
 *      an unlisted product -> yellow (never silent), marine products -> info "for boaters",
 *      Test status and Molokaʻi-only alerts dropped, island matching by zone names.
 *   3. A failed NWS fetch never reads as an all-clear.
 *   4. Staff posts: pending red never reaches a visitor; approved red does; ended disappears;
 *      a beach-targeted post rings only that beach and shows only on that beach's card.
 *   5. HTA alert posts show as info for 72 hours, news items never.
 * Writes screenshots to <outdir> for review.
 *
 *   ORIGIN=http://127.0.0.1:4631 node checks/gohawaii-advisories.test.js <outdir>
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
const H = 3600e3, now = Date.now();
const iso = (t) => new Date(t).toISOString();

function nwsAlert(o){
  return { id: 'https://api.weather.gov/alerts/' + o.id, properties: Object.assign({
    id: o.id, status: 'Actual', messageType: 'Alert', sent: iso(now - H), effective: iso(now - H), onset: iso(now - H),
    ends: iso(now + 20 * H), expires: iso(now + 20 * H), headline: o.event + ' issued by NWS Honolulu HI', instruction: ''
  }, o) };
}
const NWS = { type: 'FeatureCollection', title: 'Current watches, warnings, and advisories for Hawaii', features: [
  nwsAlert({ id: 'f1', event: 'High Surf Warning', areaDesc: 'Niihau; Kauai Windward; Kauai Leeward; Oahu North Shore; Maui Windward West',
    description: '* WHAT...Life threatening surf of 25 to 30 feet along north facing shores.\n\n* WHERE...North and west facing shores of Niihau, Kauai, Oahu, and Maui.\n\n* WHEN...Until 6 AM HST Saturday.',
    instruction: 'Stay off exposed beaches and out of the water.' }),
  nwsAlert({ id: 'f2', event: 'Flood Advisory', areaDesc: 'Oahu Koolau; Olomana', description: '* WHERE...Windward Oahu.' }),
  nwsAlert({ id: 'f3', event: 'Small Craft Advisory', areaDesc: 'Kauai Northwest Waters; Pailolo Channel', description: '* WHERE...Kauai Northwest Waters.' }),
  nwsAlert({ id: 'f4', event: 'Lava Flow Statement Unlisted', areaDesc: 'South Big Island; Kona', description: '* WHERE...Kau district.' }),
  nwsAlert({ id: 'f5', event: 'Tsunami Warning', areaDesc: 'Kauai Windward', status: 'Test', description: 'TEST' }),
  nwsAlert({ id: 'f6', event: 'Wind Advisory', areaDesc: 'Molokai Windward; Lanai Makai', description: '* WHERE...Molokai.' }),
  nwsAlert({ id: 'f7', event: 'High Surf Advisory', areaDesc: 'Kauai Leeward', messageType: 'Cancel', description: 'cancelled' })
] };
function rss(items){
  return '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>HTA</title>'
    + items.map(i => '<item><title>' + i.t + '</title><link>' + i.l + '</link><pubDate>' + new Date(i.at).toUTCString() + '</pubDate><description><![CDATA[<p>' + i.d + '</p>]]></description></item>').join('')
    + '</channel></rss>';
}
const HTA = rss([
  { t: 'Kauaʻi Travel Update Fixture', l: 'https://hta.hawaii.gov/alerts/kauai-fixture/', at: now - 5 * H, d: 'Roads on Kauaʻi reopened.' },
  { t: 'Old Maui Update Fixture', l: 'https://hta.hawaii.gov/alerts/maui-old/', at: now - 100 * H, d: 'Maui update.' },
  { t: 'HTA News Fixture', l: 'https://hta.hawaii.gov/news/some-news/', at: now - 2 * H, d: 'Scholars named on Kauaʻi.' }
]);

async function page(br, url, opts){
  opts = opts || {};
  const ctx = await br.createBrowserContext();
  const pg = await ctx.newPage();
  await pg.setViewport({ width: opts.w || 390, height: opts.h || 844, deviceScaleFactor: 2 });
  const reqs = [];
  await pg.setRequestInterception(true);
  pg.on('request', (r) => {
    const u = r.url(); reqs.push(u);
    if(u.indexOf('api.weather.gov/alerts') >= 0){
      if(opts.nwsFail) return r.abort();
      return r.respond({ status: 200, contentType: 'application/geo+json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(opts.nws || NWS) });
    }
    if(u.indexOf('/api/hta-feed') >= 0){
      const send = () => r.respond({ status: 200, contentType: 'application/rss+xml', body: opts.hta || HTA }).catch(() => {});
      return opts.htaDelay ? setTimeout(send, opts.htaDelay) : send();
    }
    r.continue();
  });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e)));
  if(opts.seed) await pg.evaluateOnNewDocument((k, v) => { try { localStorage.setItem(k, v); } catch(e){} }, 'gh_notices_v1', JSON.stringify(opts.seed));
  await pg.goto(ORIGIN + url, { waitUntil: 'networkidle2', timeout: 60000 });
  return { ctx, pg, reqs, errs };
}
function staff(o){ return Object.assign({ id: 's' + Math.random().toString(36).slice(2, 8), kind: 'advisory', src: 'staff', srcName: 'GoHawaii', level: 'yellow', title: 'Staff post',
  body: '', where: '', islands: ['kauai'], beaches: [], link: '', starts: iso(now - H), ends: iso(now + 10 * H), sent: iso(now - H), created: iso(now - H), status: 'live', by: 'Editor' }, o); }

(async () => {
  const br = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });

  console.log('1. no ref: nothing loads');
  let t = await page(br, '/?island=kauai');
  await sleep(2500);
  check(!t.reqs.some(u => /\/gh\//.test(u)), 'no /gh/ request on a no-ref load');
  check(!t.reqs.some(u => /api\.weather\.gov|hta-feed/.test(u)), 'no advisory feed request on a no-ref load');
  check(await t.pg.evaluate(() => !window.GH_ADV && !window._ghAdvBeach && !document.getElementById('ghaHubBtn')), 'no advisory globals or UI on a no-ref load');
  check(!t.errs.length, 'no page errors (no ref) ' + t.errs.join(' | '));
  await t.ctx.close();

  console.log('2. Kauaʻi with NWS + HTA fixtures');
  t = await page(br, '/?ref=gohawaii&island=kauai');
  await t.pg.waitForSelector('#ghaRed', { timeout: 15000 }).catch(() => {});
  const red = await t.pg.evaluate(() => { const r = document.getElementById('ghaRed'); return r ? { t: document.getElementById('ghaRedT').textContent, k: r.querySelector('.gha-kicker').textContent, w: (r.querySelector('.gha-where') || {}).textContent || '' } : null; });
  check(red && red.t === 'High Surf Warning', 'NWS High Surf Warning takes the screen on Kauaʻi');
  check(red && /Warning/.test(red.k) && /National Weather Service/.test(red.k), 'red kicker credits the National Weather Service');
  check(red && /North and west facing shores/.test(red.w), 'red shows the NWS WHERE line verbatim');
  await t.pg.screenshot({ path: path.join(OUT, 'app-kauai-red-390.png') });
  await t.pg.click('#ghaRed .gha-ok'); await sleep(900);
  const afterAck = await t.pg.evaluate(() => ({ red: !!document.getElementById('ghaRed'), bar: (document.getElementById('ghaBar') || {}).textContent || '', pop: (document.querySelector('#ghaPop b') || {}).textContent || '' }));
  check(!afterAck.red, 'red closes on I understand');
  check(/High Surf Warning/.test(afterAck.bar), 'the bar keeps the red advisory at the top');
  await t.pg.evaluate(() => { const p = document.getElementById('ghaPop'); if(p) p.remove(); });
  await t.pg.evaluate(() => ghOpenHub()); await sleep(500);
  const hub = await t.pg.evaluate(() => document.getElementById('sc').innerText);
  check(/Small Craft Advisory/.test(hub) && /for boaters/.test(hub), 'marine product shows as info, marked for boaters');
  check(!/Tsunami Warning/.test(hub), 'a Test-status product never reaches a visitor');
  check(!/Wind Advisory/.test(hub), 'a Molokaʻi/Lānaʻi-only alert is not shown on Kauaʻi');
  check(!/Flood Advisory/.test(hub), 'an Oʻahu-only alert is not shown on Kauaʻi');
  check(!/High Surf Advisory/.test(hub), 'a cancelled product is dropped');
  check(/Kauaʻi Travel Update Fixture/.test(hub), 'HTA alert post from 5 hours ago shows');
  check(!/HTA News Fixture/.test(hub) && !/Old Maui Update Fixture/.test(hub), 'HTA news items and posts past 72 hours do not show');
  check(/Beaches today/i.test(hub), 'hub carries today\'s beach verdicts');
  await t.pg.screenshot({ path: path.join(OUT, 'app-kauai-hub-390.png') });
  check(!t.errs.length, 'no page errors (Kauaʻi) ' + t.errs.join(' | '));
  await t.ctx.close();

  console.log('2b. Oʻahu: a red sorts above a yellow');
  t = await page(br, '/?ref=gohawaii&island=oahu');
  await t.pg.waitForSelector('#ghaRed', { timeout: 15000 }).catch(() => {});
  await t.pg.click('#ghaRed .gha-ok').catch(() => {}); await sleep(900);
  const oa = await t.pg.evaluate(() => ({ bar: (document.getElementById('ghaBar') || {}).textContent || '', cls: (document.getElementById('ghaBar') || {}).className || '', pop: (document.querySelector('#ghaPop b') || {}).textContent || '' }));
  check(/High Surf Warning/.test(oa.bar) && /red/.test(oa.cls), 'the bar leads with the red warning, not the yellow Flood Advisory');
  check(oa.pop === 'Flood Advisory', 'the yellow Flood Advisory pops after the red is acknowledged');
  await t.ctx.close();

  console.log('3. Hawaiʻi Island: unlisted NWS product is yellow, never silent');
  t = await page(br, '/?ref=gohawaii&island=hawaii');
  await t.pg.waitForSelector('#ghaPop', { timeout: 15000 }).catch(() => {});
  const hi = await t.pg.evaluate(() => ({ red: !!document.getElementById('ghaRed'), pop: (document.querySelector('#ghaPop b') || {}).textContent || '', cls: (document.getElementById('ghaPop') || {}).className || '' }));
  check(!hi.red, 'no red on Hawaiʻi Island (the surf warning names no Big Island zone)');
  check(hi.pop === 'Lava Flow Statement Unlisted' && /yellow/.test(hi.cls), 'unlisted NWS product pops as yellow');
  await t.pg.screenshot({ path: path.join(OUT, 'app-hawaii-yellow-390.png') });
  await t.ctx.close();

  console.log('4. NWS unreachable: never an all-clear');
  t = await page(br, '/?ref=gohawaii&island=maui', { nwsFail: true, hta: rss([]) });
  await sleep(3000);
  await t.pg.evaluate(() => ghOpenHub()); await sleep(400);
  const fail = await t.pg.evaluate(() => document.getElementById('sc').innerText);
  check(/could not reach the National Weather Service/i.test(fail), 'hub says the weather service could not be reached');
  check(!/No advisories from|No National Weather Service alerts/i.test(fail), 'no all-clear line when the weather feed failed');
  await t.ctx.close();

  console.log('4b. Dashboard with feeds down: island cards never say "nothing active" for a source that failed');
  t = await page(br, '/gohawaii-dashboard', { w: 1280, h: 900, nwsFail: true, hta: 'not rss' });
  await sleep(3000);
  const dd = await t.pg.evaluate(() => document.getElementById('islCards').innerText);
  check(/Weather feed down/.test(dd), 'Dashboard pill says the weather feed is down');
  check(/National Weather Service could not be reached|Neither the National Weather Service/.test(dd), 'empty island card says the weather service could not be reached');
  check(!/Nothing active from the National Weather Service/.test(dd), 'no island card claims nothing active from a failed feed');
  await t.ctx.close();

  console.log('5. staff posts: approval, targeting, end');
  const pend = staff({ id: 'spend', level: 'red', title: 'Pending red', status: 'pending' });
  const tgt = staff({ id: 'stgt', level: 'yellow', title: 'Hanalei only', beaches: ['hanalei'] });
  const ended = staff({ id: 'send', level: 'yellow', title: 'Ended one', status: 'ended' });
  const expired = staff({ id: 'sexp', level: 'yellow', title: 'Expired one', ends: iso(now - 60e3) });
  const feat = { id: 'sfeat', kind: 'feature', src: 'staff', sub: 'Campaign', title: 'Travel with care this winter', body: 'Watch big surf from the lookouts.', link: 'https://www.gohawaii.com/', islands: ['kauai'], starts: iso(now - H), ends: iso(now + 48 * H), status: 'live', by: 'Editor', created: iso(now) };
  t = await page(br, '/?ref=gohawaii&island=kauai', { nws: { features: [] }, hta: rss([]), seed: { items: [pend, tgt, ended, expired, feat], hta: {}, log: [] } });
  await sleep(3500);
  const s5 = await t.pg.evaluate(() => ({ red: !!document.getElementById('ghaRed'), bar: (document.getElementById('ghaBar') || {}).textContent || '' }));
  check(!s5.red, 'a pending red never reaches a visitor');
  check(/Hanalei only/.test(s5.bar), 'a live yellow shows in the bar');
  await t.pg.evaluate(() => { const p = document.getElementById('ghaPop'); if(p) p.remove(); if(typeof closeSheet === 'function') closeSheet(); document.querySelector('#tabs .tab[data-tab="beaches"]').click(); });
  await sleep(1200);
  const s5b = await t.pg.evaluate(() => {
    const rings = document.querySelectorAll('.gha-ring').length;
    openSheet('hanalei'); const a = (document.querySelector('#sc .gha-card-a') || {}).textContent || '';
    openSheet('anini'); const b = (document.querySelector('#sc .gha-card-a') || {}).textContent || '';
    closeSheet(); ghOpenHub(); const h = document.getElementById('sc').innerText;
    return { rings, a, b, h };
  });
  check(s5b.rings === 1, 'one ring on the map, on the targeted beach');
  check(/Hanalei only/.test(s5b.a) && !/Hanalei only/.test(s5b.b), 'targeted post shows on its beach card only');
  check(!/Ended one/.test(s5b.h) && !/Expired one/.test(s5b.h), 'ended and expired posts are gone');
  check(/Travel with care this winter/.test(s5b.h) && /Featured by GoHawaii/i.test(s5b.h), 'featured campaign sits on the GoHawaii page');
  await t.pg.screenshot({ path: path.join(OUT, 'app-kauai-hub-featured-390.png') });
  check(!t.errs.length, 'no page errors (staff) ' + t.errs.join(' | '));
  await t.ctx.close();

  console.log('5b. a slow HTA feed never holds back a staff red');
  t = await page(br, '/?ref=gohawaii&island=kauai', { nws: { features: [] }, htaDelay: 8000, seed: { items: [staff({ id: 'sred', level: 'red', title: 'Staff red', approvedBy: 'Approver' })], hta: {}, log: [] } });
  const t0 = Date.now();
  const got = await t.pg.waitForSelector('#ghaRed', { timeout: 5000 }).then(() => true).catch(() => false);
  check(got, 'staff red takes the screen while HTA is still loading (' + (Date.now() - t0) + ' ms after load)');
  await t.ctx.close();

  console.log('6. Dashboard renders at both widths');
  for (const w of [390, 1280]) {
    t = await page(br, '/gohawaii-dashboard', { w, h: 900, nws: NWS });
    await sleep(2500);
    const d = await t.pg.evaluate(() => ({ sx: document.documentElement.scrollWidth > window.innerWidth + 1, cards: document.querySelectorAll('.islcard').length, nws: document.getElementById('nwsList').innerText }));
    check(!d.sx, 'Dashboard has no sideways scroll at ' + w + 'px');
    check(d.cards === 4, 'Dashboard shows four island cards at ' + w + 'px');
    check(/High Surf Warning/.test(d.nws) && /New alert type, shown as yellow/.test(d.nws), 'Dashboard lists NWS alerts and flags the unlisted one at ' + w + 'px');
    await t.pg.screenshot({ path: path.join(OUT, 'dashboard-now-' + w + '.png'), fullPage: true });
    await t.pg.evaluate(() => document.querySelector('.rail button[data-view="adv"]').click()); await sleep(400);
    await t.pg.screenshot({ path: path.join(OUT, 'dashboard-advisories-' + w + '.png'), fullPage: true });
    await t.pg.evaluate(() => document.querySelector('.rail button[data-view="feat"]').click()); await sleep(1200);
    await t.pg.screenshot({ path: path.join(OUT, 'dashboard-events-' + w + '.png'), fullPage: true });
    check(!t.errs.length, 'no Dashboard page errors at ' + w + 'px ' + t.errs.join(' | '));
    await t.ctx.close();
  }

  await br.close();
  console.log(fails.length ? '\n' + fails.length + ' FAILED' : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
