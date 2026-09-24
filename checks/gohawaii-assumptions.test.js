#!/usr/bin/env node
/* GoHawaii Dashboard, "Assumptions to test": headless test against a real render.
 *
 * What it proves (ASSUMPTIONS-LOGIC.md, approved 2026-09-23):
 *   1. The Overview card shows the three strongest assumptions for the island, each with a confidence chip and
 *      a Sample chip, opening "Working assumption:" with an action that opens "Consider".
 *   2. The Report view carries the section at the top, before the summary numbers, with its own toggle; every
 *      line has the statement, Based on, Confirm, Overturn, Owner and Action; the method note appears with the
 *      "How each figure is computed" toggle; the scope "All four islands" renders the island rules per island.
 *   3. The text never carries an outcome word, a likelihood word, a dollar figure, "All islands", or an em dash.
 *   4. Print, CSV, JSON and clipboard exports carry the same lines with their confidence and Sample marks.
 *   5. Every rule fires on the sample set and every rule has a not-enough-data or a no-pattern path, proven by
 *      running the engine on altered figures; the Wilson interval reproduces a published example.
 *   6. Both widths, 1280 and 390: the section and the card render with no horizontal overflow.
 * Writes screenshots to <outdir>.
 *
 *   ORIGIN=http://127.0.0.1:4632 node checks/gohawaii-assumptions.test.js <outdir>
 */
'use strict';
const puppeteer = require('/Users/nickmossman/Desktop/OceanSafe/brochure-src/node_modules/puppeteer-core');
const fs = require('fs'), path = require('path');
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:4632';
const OUT = process.argv[2] || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const fails = [];
function check(cond, msg){ if(cond) console.log('  ok   ' + msg); else { console.log('  FAIL ' + msg); fails.push(msg); } }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const BANNED = /\b(drown\w*|rescue\w*|incident\w*|prevent\w*|saved|safer|likely|probably|unlikely)\b|\$|All islands|[—–]/i;

async function page(br, w, h){
  const ctx = await br.createBrowserContext();
  const pg = await ctx.newPage();
  await pg.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await pg.setRequestInterception(true);
  pg.on('request', (r) => {
    const u = r.url();
    if(u.indexOf('api.weather.gov') >= 0) return r.respond({ status: 200, contentType: 'application/geo+json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"type":"FeatureCollection","features":[]}' });
    if(u.indexOf('/api/hta-feed') >= 0) return r.respond({ status: 200, contentType: 'application/rss+xml', body: '<?xml version="1.0"?><rss version="2.0"><channel><title>HTA</title></channel></rss>' });
    if(u.indexOf('/api/wx') >= 0) return r.respond({ status: 200, contentType: 'application/json', body: '{}' });
    // The app itself (the Overview's phone frame and the hidden island probes) is not under test here; a stub keeps its
    // own Leaflet errors out of this suite.
    if(/[?&]ref=gohawaii/.test(u) && !/\.(js|json|png|css)(\?|$)/.test(u)) return r.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><title>app stub</title>' });
    r.continue();
  });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e && e.stack || e)));
  await pg.goto(ORIGIN + '/gohawaii-dashboard.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1500);
  return { pg, ctx, errs };
}
const sec = (pg) => pg.evaluate(() => {
  const s = document.getElementById('asmSec'); if(!s) return null;
  const rows = Array.from(s.querySelectorAll('.asm')).map((r) => ({
    head: r.querySelector('.asmh .k').textContent, lv: r.querySelector('.lv').textContent, chip: r.querySelector('.chip.sample, .chip.live').textContent,
    s: r.querySelector('.s').textContent, m: Array.from(r.querySelectorAll('.m')).map((x) => x.textContent) }));
  return { text: s.innerText, rows, off: (s.querySelector('.asmoff') || {}).textContent || '', meth: !!s.querySelector('details.meth'), first: s.parentElement.children[2] === s };
});

(async () => {
  const br = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  for(const [w, h] of [[1280, 900], [390, 844]]){
    console.log('\n== width ' + w);
    const t = await page(br, w, h);
    check(!t.errs.length, 'no page errors on load' + (t.errs.length ? ': ' + t.errs[0].split('\n').slice(0, 2).join(' | ') : ''));

    // 1. Overview card
    const card = await t.pg.evaluate(() => ({ sub: document.getElementById('asmSub').textContent, items: Array.from(document.querySelectorAll('#asmTop .asmi')).map((i) => ({ lv: i.querySelector('.lv').textContent, chip: i.querySelector('.chip.sample, .chip.live').textContent, s: i.querySelector('p').textContent, c: i.querySelector('small').textContent })) }));
    check(card.items.length === 3, 'Overview card shows three assumptions');
    check(card.items.every((i) => /^High confidence$/.test(i.lv)), 'the three strongest on Kauaʻi are High (' + card.items.map((i) => i.lv).join(', ') + ')');
    check(card.items.every((i) => i.chip === 'Sample' && /^Working assumption: /.test(i.s) && /^Consider /.test(i.c)), 'each card line: Sample chip, "Working assumption:", "Consider"');
    check(/sample figures/.test(card.sub) && /never findings/.test(card.sub), 'card subtitle names sample figures and never findings');
    await t.pg.evaluate(() => window.scrollTo(0, document.getElementById('asmTop').getBoundingClientRect().top + window.scrollY - 80));
    await t.pg.screenshot({ path: path.join(OUT, 'asm-1-overview-card-' + w + '.png') });

    // 2. Report section
    await t.pg.evaluate(() => document.querySelector('.rail button[data-view="rep"]').click());
    await sleep(800);
    let s = await sec(t.pg);
    check(!!s, 'Report view carries the Assumptions section');
    check(s.first, 'the section sits at the top of the report, before the summary numbers');
    check(s.rows.length === 16, 'Kauaʻi: 16 rules fire on the sample set (' + s.rows.length + ')');
    check(s.rows.every((r) => /^Working assumption: /.test(r.s)), 'every line opens "Working assumption:"');
    check(s.rows.every((r) => /^(High|Moderate|Low) confidence$/.test(r.lv) && r.chip === 'Sample'), 'every line carries a confidence chip and a Sample chip');
    check(s.rows.every((r) => r.m.length >= 3 && /^Based on /.test(r.m[0]) && /^Confirm .*Overturn /.test(r.m[1]) && /^Owner .*Action Consider /.test(r.m[2])), 'every line has Based on, Confirm, Overturn, Owner and a Consider action');
    check(s.rows.every((r) => /County \d|State \d/.test(r.m[0]) && /(counting today|in build|needs)/.test(r.m[0])), 'every Based on line names the dataset with its catalogue rank and status');
    check(!BANNED.test(s.text), 'no outcome word, likelihood word, dollar figure, "All islands" or dash in the section' + (BANNED.test(s.text) ? ' (hit: ' + s.text.match(BANNED)[0] + ')' : ''));
    check(/within 1 point|\d+ to \d+/.test(s.text) && !/\(\s*(\d+) to \1\s*\)/.test(s.text), 'ranges print as a span or "within 1 point", never "(41 to 41)"');
    check(/One area is under ten scans and is not shown/.test(s.text), 'the suppressed retail area reads as under ten');
    check(/too close to call/.test(s.text), 'a lead that fails the pair test reads "too close to call"');
    const lvl = {}; s.rows.forEach((r) => { lvl[r.lv] = (lvl[r.lv] || 0) + 1; });
    check(lvl['High confidence'] >= 3 && lvl['Moderate confidence'] >= 8 && lvl['Low confidence'] >= 1, 'the sample grades across all three levels (' + JSON.stringify(lvl) + ')');
    check(s.rows.filter((r) => /Campaign window/.test(r.head)).every((r) => r.lv === 'Low confidence' && /not recorded/.test(r.s)), 'the campaign line is Low until the confound register is filled');
    check(!s.meth, 'no method note while "How each figure is computed" is off');
    await t.pg.screenshot({ path: path.join(OUT, 'asm-2-report-top-' + w + '.png') });

    // toggles: method note, section off and on
    await t.pg.evaluate(() => { const c = document.getElementById('rpMeth'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
    await sleep(400); s = await sec(t.pg);
    check(s.meth && /How these are graded/.test(s.text) && /Graded (High|Moderate|Low): precision/.test(s.text), 'the method note and the per-line grading show with the computed toggle');
    await t.pg.evaluate(() => { const c = document.getElementById('rpAsm'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
    await sleep(400);
    check(!(await sec(t.pg)), 'the section toggle removes the section');
    const csvOff = await t.pg.evaluate(() => window.GH_ASM.exports.csv());
    check(csvOff.indexOf('Assumptions to test') < 0, 'CSV drops the assumptions when the toggle is off');
    await t.pg.evaluate(() => { const c = document.getElementById('rpAsm'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); const m = document.getElementById('rpMeth'); m.checked = false; m.dispatchEvent(new Event('change', { bubbles: true })); });
    await sleep(400); s = await sec(t.pg);
    check(!!s && s.rows.length === 16, 'the section toggle brings the section back');

    // scope: all four islands
    await t.pg.evaluate(() => document.querySelector('#v-rep .seg button[data-scope="all"]').click());
    await sleep(800); s = await sec(t.pg);
    const isl = ['Kauaʻi', 'Oʻahu', 'Maui', 'Hawaiʻi Island'].map((n) => s.rows.filter((r) => r.head.indexOf('· ' + n) >= 0).length);
    check(s.rows.length >= 8 && isl.every((n) => n >= 8), 'All four islands: at least 8 lines per island (' + isl.join(', ') + ') and ' + s.rows.filter((r) => /All four islands/.test(r.head)).length + ' statewide');
    check(/Not this month:/.test(s.off) && /named beach-to-beach flows/.test(s.off), 'islands without the County flow set read "not enough data" in the not-this-month line');
    check(!BANNED.test(s.text), 'no banned word across all four islands');
    await t.pg.screenshot({ path: path.join(OUT, 'asm-3-report-all-islands-' + w + '.png') });

    // 4. exports
    const ex = await t.pg.evaluate(() => ({ csv: window.GH_ASM.exports.csv(), json: window.GH_ASM.exports.json(), text: window.GH_ASM.exports.text() }));
    const csvRows = ex.csv.split('\n').filter((l) => l.indexOf('Assumptions to test') === 0 || l.indexOf(',Assumptions to test,') > 0);
    check(csvRows.length === s.rows.length && csvRows.every((l) => /(High|Moderate|Low) confidence, sample/.test(l) && /Working assumption:/.test(l) && /confirm:/.test(l)), 'CSV carries every line with its confidence, Sample mark, confirm and overturn (' + csvRows.length + ')');
    const fired = ex.json.assumptions.filter((a) => a.fired);
    check(fired.length === s.rows.length && fired.every((a) => /^(High|Moderate|Low)$/.test(a.confidence) && a.sample === true && /^Working assumption: /.test(a.statement) && a.confirm && a.overturn && a.owner && /^Consider /.test(a.consider) && /^Graded /.test(a.grading)), 'JSON carries every line with confidence, sample, confirm, overturn, owner, consider and grading');
    check(ex.json.assumptions.some((a) => !a.fired && /flows/.test(a.why_not)) && /rated down by four gates/.test(ex.json.assumptions_method), 'JSON records the rules that did not fire and the method');
    const tl = ex.text.split('\n');
    check(/^Assumptions to test \(sample figures\):$/.test(tl[2]) && tl.slice(3, 3 + s.rows.length).every((l) => /^- \[(High|Moderate|Low), sample\] Working assumption: .* Consider .* Owner: /.test(l)), 'text summary lists every line with its level and Sample mark');
    const printed = await t.pg.evaluate(() => { let hit = false; Array.from(document.styleSheets).forEach((ss) => { let rules = []; try { rules = Array.from(ss.cssRules); } catch(e){} rules.forEach((r) => { if(r.media && r.media.mediaText === 'print' && Array.from(r.cssRules).some((x) => /#repDoc/.test(x.selectorText || ''))) hit = true; }); }); return hit && !!document.querySelector('#repDoc #asmSec'); });
    check(printed, 'print shows #repDoc, and the section lives inside it');
    if(w === 1280){
      // Print read-back: a Letter PDF of the Kauaʻi report; page 1 must carry the section's first line, not a blank page.
      await t.pg.evaluate(() => document.querySelector('#v-rep .seg button[data-scope="isl"]').click()); await sleep(600);
      const pdf = path.join(OUT, 'asm-report-kauai-letter.pdf');
      await t.pg.pdf({ path: pdf, format: 'Letter', printBackground: true, margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' } });
      let p1 = '';
      try { p1 = require('child_process').execSync('pdftotext -f 1 -l 1 -layout "' + pdf + '" -', { encoding: 'utf8' }); } catch(e){ p1 = ''; }
      if(p1) check(/Assumptions to test/.test(p1) && /Working assumption:/.test(p1), 'printed page 1 carries the section and its first line (' + (p1.match(/Working assumption:/g) || []).length + ' lines on page 1)');
      else console.log('  skip printed page 1 check (pdftotext not available)');
      await t.pg.evaluate(() => document.querySelector('#v-rep .seg button[data-scope="all"]').click()); await sleep(800);
    }

    // back to one island for the width check
    await t.pg.evaluate(() => document.querySelector('#v-rep .seg button[data-scope="isl"]').click());
    await sleep(600);
    const ov = await t.pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sec: document.getElementById('asmSec').getBoundingClientRect().width, doc: document.getElementById('repDoc').getBoundingClientRect().width }));
    check(ov.sw <= ov.cw + 1 && ov.sec <= ov.doc, 'no horizontal overflow at ' + w + ' (page ' + ov.sw + ' of ' + ov.cw + ', section ' + Math.round(ov.sec) + ' in ' + Math.round(ov.doc) + ')');

    // 5. the engine: every rule fires on the sample set and every rule has a path that does not fire
    if(w === 1280){
      const eng = await t.pg.evaluate(() => {
        const G = window.GH_ASM, R = {}; G.rules.forEach((r) => { R[r.id] = r; });
        const d = (k, o) => Object.assign(G.data(k), o || {});
        const ev = (id, k, o) => G.evaluate(R[id], d(k, o));
        const w = G.wilson(2, 15), out = {};
        out.wilson = [w.lo.toFixed(4), w.hi.toFixed(4)];
        out.about = [G.about(7), G.about(37), G.about(1123), G.about(12345)];
        out.fireAll = G.rules.map((r) => ({ id: r.id, k: ['kauai', 'oahu', 'maui', 'hawaii'].filter((k) => G.evaluate(r, d(k)).fired) }));
        out.R1na = ev('R1', 'oahu').why; out.R1off = ev('R1', 'kauai', { unguarded: 0.10 }).why; out.R1thin = ev('R1', 'kauai', { checks: 20 }).why;
        out.R2off = ev('R2', 'kauai', { beaches: [{ lab: 'A', v: 500, tag: '' }, { lab: 'B', v: 490, tag: '' }] }).why;
        out.R3off = ev('R3', 'kauai', { hazShare: 0.02 }).why; out.R3na = ev('R3', 'kauai', { checks: 200 }).why;
        out.R4na = ev('R4', 'kauai', { checks: 100 }).why; out.R4off = ev('R4', 'kauai', { deflect: { haz: 0.12, calm: 0.09 } }).why;
        out.R5na = ev('R5', 'maui').why; out.R5off = ev('R5', 'kauai', { flows: [['tunnels', 'lydgate', 15]], hazRows: [{ lab: 'Tunnels (Mākua)', v: 4000 }] }).why;
        out.R6off = ev('R6', 'kauai', { cap: { site: 'X', cap: 900, intent: 1000, alt: [['tunnels', 41], ['hanalei', 33]], note: '' } }).why; out.R6na = ev('R6', 'kauai', { cap: { site: 'X', cap: 2, intent: 3, alt: [['tunnels', 41], ['hanalei', 33]], note: '' }, days: 1 }).why;
        out.R7off = ev('R7', 'kauai', { hours: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6] }).why; out.R7na = ev('R7', 'kauai', { checks: 10 }).why;
        out.R8na = ev('R8', 'kauai', { rainDays: 1 }).why; out.R8off = ev('R8', 'kauai', { wx: { labels: ['Beaches'], dry: [50, 9, 17], rain: [48, 4, 33] } }).why;
        out.R9na = ev('R9', 'kauai', { adv: [1, 1, 1, 1] }).why; out.R9off = ev('R9', 'kauai', { reach: [['a', 60], ['b', 58], ['c', 57], ['d', 56]] }).why;
        out.R10na = ev('R10', 'kauai', { scans: 5 }).why; out.R10off = ev('R10', 'kauai', { avoid: 0.05 }).why;
        out.R11off = ev('R11', 'kauai', { reef: [['A', 100], ['B', 95], ['C', 60]] }).why; out.R11na = ev('R11', 'kauai', { checks: 50 }).why;
        out.R12off = ev('R12', 'kauai', { otherLang: [['Korean', 7]] }).why; out.R12na = ev('R12', 'kauai', { sessions: 20 }).why;
        out.R13off = ev('R13', 'kauai', { entry: [['a', 30, 'L'], ['b', 30, 'L'], ['Airport placards', 14, 'L']] }).why; out.R13na = ev('R13', 'kauai', { firstOpens: 12 }).why;
        const c = d('kauai').campaign; out.R14low = ev('R14', 'kauai').level; out.R14mod = ev('R14', 'kauai', { campaign: Object.assign({}, c, { register: 'a storm week and a school break' }) }).level;
        out.R14off = ev('R14', 'kauai', { campaign: Object.assign({}, c, { during: c.before, pcDuring: c.pcBefore }) }).why; out.R14na = ev('R14', 'kauai', { campaign: Object.assign({}, c, { before: 2, during: 2 }) }).why;
        out.R15off = ev('R15', 'kauai', { stateDay: [['kauai', 1000], ['oahu', 1000], ['maui', 900], ['hawaii', 900]] }).why; out.R15na = ev('R15', 'kauai', { stateDay: [['kauai', 0.1], ['oahu', 0.1], ['maui', 0.1], ['hawaii', 0.1]], days: 1 }).why;
        out.R16off = ev('R16', 'kauai', { trails: [['A', 100, ''], ['B', 99, '']] }).why; out.R16na = ev('R16', 'kauai', { trails: [['A', 10, ''], ['B', 9, '']] }).why;
        out.levelsHigh = ev('R3', 'kauai').gates; out.oneLine = ev('R1', 'kauai').level; out.buildCap = ev('R4', 'kauai').level;
        return out;
      });
      check(eng.wilson[0] === '0.0374' && eng.wilson[1] === '0.3788', 'Wilson reproduces the published example x=2 n=15: 0.0374 to 0.3788');
      check(eng.about.join('|') === 'under ten|about 35|about 1,100|about 12,000', 'about(): under ten, nearest 5, two significant figures (' + eng.about.join(', ') + ')');
      check(eng.fireAll.every((r) => r.k.length >= 1) && eng.fireAll.filter((r) => r.k.length === 4).length >= 12, 'every rule fires on at least one island, at least 12 on all four (' + eng.fireAll.map((r) => r.id + ':' + r.k.length).join(' ') + ')');
      const na = ['R1na', 'R1thin', 'R3na', 'R4na', 'R5na', 'R6na', 'R7na', 'R8na', 'R9na', 'R10na', 'R11na', 'R12na', 'R13na', 'R14na', 'R15na', 'R16na'];
      check(na.every((k) => /^needs /.test(eng[k])), 'every rule has a not-enough-data path that says what it needs (' + na.filter((k) => !/^needs /.test(eng[k])).join(', ') + ')');
      const off = ['R1off', 'R2off', 'R3off', 'R4off', 'R5off', 'R6off', 'R7off', 'R8off', 'R9off', 'R10off', 'R11off', 'R12off', 'R13off', 'R14off', 'R15off', 'R16off'];
      check(off.every((k) => eng[k] && !/^needs /.test(eng[k])), 'every rule has a no-pattern path (' + off.filter((k) => !eng[k] || /^needs /.test(eng[k])).join(', ') + ')');
      check(/under ten so far/.test(eng.R10na), 'a scan count under ten reads "under ten", never the number');
      check(eng.R14low === 1 && eng.R14mod === 2, 'campaign: Low with no confound register, Moderate once it is filled');
      check(eng.oneLine === 2 && eng.buildCap === 2, 'gates: one line of evidence caps at Moderate; an in-build dataset caps at Moderate');
      check(/Graded High: precision High, source High, agreement High \(2 lines of evidence\), stability not measured \(sample\)/.test(eng.levelsHigh), 'a two-line, all-counting rule grades High on the sample with stability not measured');
    }
    await t.ctx.close();
  }
  await br.close();
  console.log('\n' + (fails.length ? fails.length + ' FAILED' : 'ALL PASS'));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
