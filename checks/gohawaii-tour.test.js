#!/usr/bin/env node
/* GoHawaii Dashboard, the per-tab tour: headless test against a real render.
 *
 * What it proves (DASHBOARD-HELP-PLAN-2026-09-25.md section 1, release captain brief 2026-09-29):
 *   1. Each of the nine views has a tour; every step's target resolves in its view, or the step is skipped.
 *   2. A tab's tour runs on its own the first time the tab opens in a browser, once; Done marks it seen; the Tour
 *      button in the rail replays it; Skip all tours stops every automatic run; ?tour=off stops them for a load.
 *   3. Walking every step: the ring sits on the target, the card stays inside the viewport and never covers the ring,
 *      the card never overlaps the phone rail, no page error, no network request made by the tour.
 *   4. Esc closes, arrow keys move, focus sits in the card, Tab stays in the card.
 *   5. After all nine tours: ghd_log_v1 has gained no rows, the advisory store is unchanged, ghd_role is unchanged,
 *      and ghd_tour_v1 is the only new key.
 *   6. Copy law: no em or en dash, no "visitors" as a count, "All four islands" never "All islands", no money term,
 *      no open-defect trigger, no offer word; every body is under 60 words.
 *   7. Both widths, 1280 and 390.
 * Writes screenshots to <outdir>.
 *
 *   ORIGIN=http://127.0.0.1:4633 node checks/gohawaii-tour.test.js <outdir>
 */
'use strict';
const puppeteer = require('/Users/nickmossman/Desktop/OceanSafe/brochure-src/node_modules/puppeteer-core');
const fs = require('fs'), path = require('path');
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:4633';
const OUT = process.argv[2] || path.join(__dirname, 'out-tour');
fs.mkdirSync(OUT, { recursive: true });
const fails = [];
function check(cond, msg){ if(cond) console.log('  ok   ' + msg); else { console.log('  FAIL ' + msg); fails.push(msg); } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const VIEWS = ['now', 'adv', 'feat', 'promo', 'place', 'use', 'rep', 'prev', 'log'];
// Copy law + the gate's own trigger lists (release captain brief 2026-09-29).
const BANNED = /[—–]|All islands|\b(drown\w*|rescue\w*|incident\w*|likely|probably|unlikely)\b|\$|\b(per month|subscription|subscribe|fee|fees|commission|get started|sign ?up|activate your|goes live instantly|set it and forget it|book now|special offer|discount code|promo code|% off|free night|resort credit|guests used|sessions recorded|dashboard_token|oceansafety\.app)\b/i;
const VISITOR_COUNT = /\b\d[\d,]*\s+visitors\b|\bvisitors (a|per) (day|week|month)\b|\bnumber of visitors\b/i;

async function page(br, w, h, opts){
  opts = opts || {};
  const ctx = await br.createBrowserContext();
  const pg = await ctx.newPage();
  await pg.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  if(opts.seed) await pg.evaluateOnNewDocument((k, v) => { try { localStorage.setItem(k, v); } catch(e){} }, 'ghd_tour_v1', JSON.stringify(opts.seed));
  await pg.setRequestInterception(true);
  const reqs = [];
  pg.on('request', (r) => {
    const u = r.url(); reqs.push(u);
    if(u.indexOf('api.weather.gov') >= 0) return r.respond({ status: 200, contentType: 'application/geo+json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"type":"FeatureCollection","features":[]}' });
    if(u.indexOf('/api/hta-feed') >= 0) return r.respond({ status: 200, contentType: 'application/rss+xml', body: '<?xml version="1.0"?><rss version="2.0"><channel><title>HTA</title></channel></rss>' });
    if(u.indexOf('/api/wx') >= 0) return r.respond({ status: 200, contentType: 'application/json', body: '{}' });
    if(/[?&]ref=gohawaii/.test(u) && !/\.(js|json|png|css)(\?|$)/.test(u)) return r.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><title>app stub</title>' });
    r.continue();
  });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e && e.stack || e)));
  await pg.goto(ORIGIN + '/gohawaii-dashboard.html' + (opts.q || ''), { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(500);
  return { pg, ctx, errs, reqs };
}
const st = (pg) => pg.evaluate(() => window.GH_TOUR.state());
const geom = (pg) => pg.evaluate(() => {
  const hi = document.querySelector('#ghTour .tor-hi').getBoundingClientRect(), card = document.querySelector('#ghTour .tor-card').getBoundingClientRect();
  const rail = document.querySelector('.rail').getBoundingClientRect(), center = document.querySelector('#ghTour .tor-card').classList.contains('center');
  const railFixed = getComputedStyle(document.querySelector('.rail')).position === 'fixed';
  const t = window.GH_TOUR.state().target;
  const el = t && t[0] === '#' ? document.querySelector(t) : null;
  const tr = el ? el.getBoundingClientRect() : null;
  const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return { center, hi: { t: hi.top, l: hi.left, w: hi.width, h: hi.height, b: hi.bottom, r: hi.right }, card: { t: card.top, l: card.left, w: card.width, h: card.height, b: card.bottom, r: card.right },
    vw: innerWidth, vh: innerHeight, overlap: center ? 0 : inter(hi, card), railOverlap: railFixed ? inter(card, rail) : 0,
    ringOnTarget: tr ? (Math.abs(hi.left + 8 - tr.left) < 2 && (hi.top <= tr.top + 1 || (tr.top < 8 && Math.abs(hi.top - 8) < 1))) : null,   // a target taller than the viewport gets a ring clamped to the top edge
    focusIn: document.querySelector('#ghTour .tor-card').contains(document.activeElement) };
});

(async () => {
  const br = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });

  // ---- 1. the table itself: nine tours, every selector resolves in its view (1280) ----
  {
    const t = await page(br, 1280, 900, { seed: { all: 1 } });
    const tbl = await t.pg.evaluate(() => {
      const T = window.GH_TOUR.tours, out = {};
      for (const v of Object.keys(T)) {
        document.querySelector('.rail button[data-view="' + v + '"]').click();
        out[v] = T[v].map((s) => {
          if(s.center) return { ok: true, center: true };
          let el = document.querySelector(s.sel); if(el && s.up) el = el.closest(s.up);
          const r = el && el.getBoundingClientRect();
          return { ok: !!(el && r.width > 2 && r.height > 2), sel: s.sel, up: s.up || '', title: s.title, body: s.body, words: s.body.replace(/<[^>]+>/g, '').split(/\s+/).length };
        });
      }
      document.querySelector('.rail button[data-view="now"]').click();
      return out;
    });
    check(Object.keys(tbl).sort().join(',') === VIEWS.slice().sort().join(','), 'nine tours, one per view (' + Object.keys(tbl).join(', ') + ')');
    for (const v of VIEWS) {
      const miss = tbl[v].filter((s) => !s.ok);
      check(miss.length === 0, v + ': every step target resolves (' + tbl[v].length + ' steps' + (miss.length ? '; missing ' + miss.map((m) => m.sel + (m.up ? ' up ' + m.up : '')).join(', ') : '') + ')');
    }
    const all = [].concat(...VIEWS.map((v) => tbl[v].filter((s) => !s.center)));
    const long = all.filter((s) => s.words > 60);
    check(long.length === 0, 'every step body is under 60 words (longest ' + Math.max(...all.map((s) => s.words)) + ')');
    const text = all.map((s) => s.title + ' ' + s.body).join('\n');
    const hit = text.match(BANNED);
    check(!hit, 'tour copy carries no dash, money term, offer word, open-defect trigger, outcome word or "All islands"' + (hit ? ' (found "' + hit[0] + '")' : ''));
    const vc = text.match(VISITOR_COUNT);
    check(!vc, 'no "visitors" as a count' + (vc ? ' (found "' + vc[0] + '")' : ''));
    check(/all four islands/i.test(text), 'the copy says "all four islands"');
    check(await t.pg.evaluate(() => !!document.getElementById('btnTour') && document.getElementById('btnTour').getAttribute('aria-label') === 'Tour this tab'), 'the rail carries the Tour button with its label');
    check(t.errs.length === 0, 'no page error while resolving the table' + (t.errs.length ? ': ' + t.errs[0].slice(0, 160) : ''));
    await t.ctx.close();
  }

  // ---- 2. first open runs the Overview tour on its own; Done marks it seen; a reload does not rerun it ----
  {
    const t = await page(br, 1280, 900);
    await sleep(1600);
    let s = await st(t.pg);
    check(s.active && s.auto && s.view === 'now' && s.idx === 0 && /Welcome to the GoHawaii Dashboard/.test(s.title), 'Overview: the tour starts on its own on first open, on the welcome card');
    const g0 = await geom(t.pg);
    check(g0.center && g0.focusIn, 'welcome card is centred and holds focus');
    check(await t.pg.evaluate(() => !document.querySelector('#ghTour .tc-skip[data-k="all"]').hidden), 'an automatic run offers Skip all tours');
    await t.pg.screenshot({ path: path.join(OUT, 'tour-now-welcome-1280.png') });
    // walk it with the Next button
    let n = s.n, guard = 0;
    while ((await st(t.pg)).active && guard++ < 20) { await t.pg.click('#ghTour .tc-next'); await sleep(450); }
    check(!(await st(t.pg)).active && guard === n, 'Overview: Done after ' + n + ' steps closes the tour');
    const stored = await t.pg.evaluate(() => JSON.parse(localStorage.getItem('ghd_tour_v1') || '{}'));
    check(stored.seen && stored.seen.now === 1 && !stored.all, 'Done marks only the Overview as seen (' + JSON.stringify(stored) + ')');
    await t.pg.reload({ waitUntil: 'networkidle2' }); await sleep(1800);
    check(!(await st(t.pg)).active, 'a reload does not rerun a seen tour');
    // the Tour button replays it, without Skip all
    await t.pg.click('#btnTour'); await sleep(400);
    s = await st(t.pg);
    check(s.active && !s.auto && s.view === 'now', 'the Tour button replays the current tab\'s tour');
    check(await t.pg.evaluate(() => document.querySelector('#ghTour .tc-skip[data-k="all"]').hidden), 'a replay hides Skip all tours');
    await t.pg.keyboard.press('Escape'); await sleep(300);
    check(!(await st(t.pg)).active, 'Esc closes it');
    // opening a second tab runs that tab's tour once
    await t.pg.click('.rail button[data-view="adv"]'); await sleep(1100);
    s = await st(t.pg);
    check(s.active && s.auto && s.view === 'adv' && s.idx === 0, 'Advisories: opening the tab for the first time starts its tour');
    await t.pg.click('#ghTour .tc-skip[data-k="one"]'); await sleep(300);
    const st2 = await t.pg.evaluate(() => JSON.parse(localStorage.getItem('ghd_tour_v1') || '{}'));
    check(!(await st(t.pg)).active && st2.seen.adv === 1 && st2.seen.now === 1, 'Skip marks that tab seen and keeps the others');
    await t.pg.click('.rail button[data-view="feat"]'); await sleep(1100);
    check((await st(t.pg)).active && (await st(t.pg)).view === 'feat', 'Events: its tour starts on first open');
    await t.pg.click('#ghTour .tc-skip[data-k="all"]'); await sleep(300);
    const st3 = await t.pg.evaluate(() => JSON.parse(localStorage.getItem('ghd_tour_v1') || '{}'));
    check(st3.all === 1 && VIEWS.every((v) => st3.seen[v] === 1), 'Skip all tours marks every tab seen');
    await t.pg.click('.rail button[data-view="promo"]'); await sleep(1100);
    check(!(await st(t.pg)).active, 'after Skip all, a new tab does not start a tour');
    await t.pg.click('#btnTour'); await sleep(400);
    check((await st(t.pg)).active && (await st(t.pg)).view === 'promo', 'the Tour button still replays after Skip all');
    await t.pg.keyboard.press('Escape');
    check(t.errs.length === 0, 'no page error in the run rules' + (t.errs.length ? ': ' + t.errs[0].slice(0, 160) : ''));
    await t.ctx.close();
  }

  // ---- 3. ?tour=off stops the automatic run for that load ----
  {
    const t = await page(br, 1280, 900, { q: '?tour=off' });
    await sleep(1800);
    check(!(await st(t.pg)).active, '?tour=off: no automatic tour');
    await t.pg.click('#btnTour'); await sleep(400);
    check((await st(t.pg)).active, '?tour=off: the Tour button still works');
    await t.ctx.close();
  }

  // ---- 4. walk every step of every tour at both widths: geometry, keys, focus, side effects ----
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    const t = await page(br, w, h, { seed: { all: 1 } });
    for (const v of VIEWS) { await t.pg.click('.rail button[data-view="' + v + '"]'); await sleep(400); }   // the tabs' own first-render writes and fetches happen here, not in the tours
    await t.pg.click('.rail button[data-view="now"]'); await sleep(300);
    const before = await t.pg.evaluate(() => ({ keys: Object.keys(localStorage).sort(), log: localStorage.getItem('ghd_log_v1'), adv: localStorage.getItem(window.GH_ADV.KEY), role: sessionStorage.getItem('ghd_role') }));
    const reqBefore = t.reqs.length;
    let overlaps = 0, outOfView = 0, railHits = 0, offTarget = 0, focusOut = 0, steps = 0, shots = 0;
    for (const v of VIEWS) {
      await t.pg.click('.rail button[data-view="' + v + '"]'); await sleep(v === 'place' || v === 'feat' ? 900 : 500);
      await t.pg.evaluate((v) => window.GH_TOUR.start(v), v); await sleep(450);
      let s = await st(t.pg);
      check(s.active && s.view === v && s.n >= 3, v + ' @' + w + ': tour starts with ' + s.n + ' steps');
      const seenTitles = [];
      let guard = 0;
      while (s.active && guard++ < 20) {
        await sleep(750);                                   // position() fires at 250ms, then a 300ms transition: measure at rest
        const g = await geom(t.pg);
        steps++;
        if(!g.center){
          if(g.overlap > 4) { overlaps++; console.log('    overlap ' + v + ' step ' + (s.idx + 1) + ' ' + s.title + ' ' + Math.round(g.overlap) + 'px2'); }
          if(g.ringOnTarget === false) { offTarget++; console.log('    ring off target ' + v + ' step ' + (s.idx + 1) + ' ' + s.target); }
        }
        if(g.card.l < 0 || g.card.t < 0 || g.card.r > g.vw + 1 || g.card.b > g.vh + 1) { outOfView++; console.log('    card out of view ' + v + ' step ' + (s.idx + 1) + ' ' + JSON.stringify(g.card)); }
        if(g.railOverlap > 0) { railHits++; console.log('    card over the rail ' + v + ' step ' + (s.idx + 1)); }
        if(!g.focusIn) focusOut++;
        seenTitles.push(s.title);
        if(shots < 40 && (s.idx === 1 || (v === 'use' && s.idx === 4) || (v === 'rep' && s.idx === 6))) { await t.pg.screenshot({ path: path.join(OUT, 'tour-' + v + '-step' + (s.idx + 1) + '-' + w + '.png') }); shots++; }
        await t.pg.keyboard.press('ArrowRight');
        await sleep(120);
        s = await st(t.pg);
      }
      check(!s.active && guard <= 20, v + ' @' + w + ': ArrowRight walks every step to Done (' + seenTitles.length + ' shown)');
      // arrow left goes back one; Tab stays in the card
      await t.pg.evaluate((v) => window.GH_TOUR.start(v), v); await sleep(350);
      await t.pg.keyboard.press('ArrowRight'); await sleep(350);
      const i1 = (await st(t.pg)).idx;
      await t.pg.keyboard.press('ArrowLeft'); await sleep(350);
      const i0 = (await st(t.pg)).idx;
      for (let k = 0; k < 6; k++) await t.pg.keyboard.press('Tab');
      const tabIn = await t.pg.evaluate(() => document.querySelector('#ghTour .tor-card').contains(document.activeElement));
      check(i1 === 1 && i0 === 0 && tabIn, v + ' @' + w + ': ArrowLeft goes back, Tab stays in the card');
      await t.pg.keyboard.press('Escape'); await sleep(200);
    }
    check(overlaps === 0, '@' + w + ': the card never covers the ring (' + steps + ' steps checked)');
    check(offTarget === 0, '@' + w + ': the ring sits on the target on every step with an id');
    check(outOfView === 0, '@' + w + ': the card stays inside the viewport on every step');
    check(railHits === 0, '@' + w + ': the card never sits over the phone rail');
    check(focusOut === 0, '@' + w + ': focus is in the card on every step');
    const after = await t.pg.evaluate(() => ({ keys: Object.keys(localStorage).sort(), log: localStorage.getItem('ghd_log_v1'), adv: localStorage.getItem(window.GH_ADV.KEY), role: sessionStorage.getItem('ghd_role') }));
    check(after.log === before.log && after.adv === before.adv && after.role === before.role, '@' + w + ': the tours changed no log row, no advisory, no role');
    const newKeys = after.keys.filter((k) => before.keys.indexOf(k) < 0);
    check(newKeys.every((k) => k === 'ghd_tour_v1'), '@' + w + ': no new storage key beyond ghd_tour_v1 (' + (newKeys.join(', ') || 'none') + ')');
    const tourReqs = t.reqs.slice(reqBefore).filter((u) => !/\/data\/poi-gohawaii-|\/gh\/beaches\.json|ref=gohawaii|tile|api\.weather|hta-feed|\/api\/wx|leaflet|unpkg|jsdelivr|arcgis|gohawaii\.com\/sites\/default\/files/i.test(u));
    check(tourReqs.length === 0, '@' + w + ': the tour made no network request of its own (' + tourReqs.slice(0, 3).join(' ') + ')');
    check(t.errs.length === 0, '@' + w + ': no page error across all nine tours' + (t.errs.length ? ': ' + t.errs[0].slice(0, 200) : ''));
    await t.ctx.close();
  }

  // ---- 5. a hidden target is skipped: the island picker is hidden on the Overview, shown on Visitors ----
  {
    const t = await page(br, 1280, 900, { seed: { all: 1 } });
    const r = await t.pg.evaluate(() => {
      const T = window.GH_TOUR.tours;
      document.querySelector('.rail button[data-view="use"]').click();
      const useHas = T.use.some((s) => s.sel === '#islPick');
      window.GH_TOUR.start('use'); const nUse = window.GH_TOUR.state().n; window.GH_TOUR.end();
      // hide the picker by hand and start again: the step must drop out
      document.getElementById('islPick').hidden = true;
      window.GH_TOUR.start('use'); const nHidden = window.GH_TOUR.state().n; window.GH_TOUR.end();
      document.getElementById('islPick').hidden = false;
      return { useHas, nUse, nHidden };
    });
    check(r.useHas && r.nHidden === r.nUse - 1, 'a step whose target is hidden is skipped (' + r.nUse + ' steps, ' + r.nHidden + ' with the island picker hidden)');
    await t.ctx.close();
  }

  await br.close();
  console.log('\n' + (fails.length ? fails.length + ' FAILED' : 'ALL PASS'));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
