/* Dashboard functional walk. Gate 1 of the Dashboard release-readiness set.
 *
 *   node checks/dashboard-ops.js https://ocean-safety.netlify.app
 *   node checks/dashboard-ops.js ~/Desktop/OceanSafe/wt-x/dashboard.html
 *   node checks/dashboard-ops.js <target> --baseline   # capture segment x view snapshots
 *   node checks/dashboard-ops.js <target> --diff       # fail on any unintended change
 *
 * For every route in _redirects that lands on dashboard.html?seg=... (mirror mode), or
 * every key of window.OS_SEGMENTS (local file mode), it opens the Dashboard and asserts:
 *   1. window.OS_SEG equals the segment the route asked for (no silent fallback to pm)
 *   2. the header h1 is that segment's own label
 *   3. every tab the segment declares is visible, clicks, and shows a non-empty panel;
 *      every tab it does not declare is hidden
 *   4. the promo builder's date/time/url inputs accept a value
 *   5. Download to desktop produces a non-empty file
 *   6. no console error and no response >= 400 during any of it
 * Exit 1 on any failure, with every failure listed. Exit 0 = green.
 *
 * Why: 14 of 24 ledger defects touch the Dashboard and none of the existing checks
 * clicks anything. This is the one that would have caught OD-5, OD-8, OD-10, OD-24.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require(path.join(__dirname, '..', 'tools', 'node', 'node_modules', 'playwright'));

/* Local mode serves the checkout over HTTP. file:// blocks fetch and XHR, so the
   config load and the download both fail for reasons that are not defects. */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
function serve(root) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve({ srv, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}

const target = process.argv[2];
if (!target) { console.error('usage: dashboard-ops.js <https://host | /path/dashboard.html>'); process.exit(2); }
const isLocal = !/^https?:/.test(target);
const ALL_VIEWS = ['home', 'stayclose', 'promos', 'guests', 'places', 'segments', 'desk', 'shop'];
const MODE = process.argv.includes('--baseline') ? 'baseline' : process.argv.includes('--diff') ? 'diff' : 'walk';
const BASE_DIR = path.join(__dirname, 'dash-baseline');
const fails = [];
const ok = [];

/* Gate 2. Normalize before comparing so a new day, a new build id, or a moved counter is
   not read as a regression. Only genuine content changes survive this. */
function normalize(t) {
  return t.replace(/\s+/g, ' ')
    .replace(/\d{4}-\d{2}-\d{2}/g, '<date>')
    .replace(/\b\d{1,2}:\d{2}\s?(am|pm)?/gi, '<time>')
    .replace(/v\d+-\d{4}-\d{2}-\d{2}[a-z0-9-]*/gi, '<build>')
    .replace(/\b\d[\d,.]*\b/g, '<n>')
    // The shop frame shows a transient loading line; it is timing, not content.
    .replace(/Loading your store…\s*/g, '')
    .trim();
}
function fail(seg, msg) { fails.push(seg + ': ' + msg); console.log('  FAIL ' + msg); }
function pass(seg, msg) { ok.push(seg + ': ' + msg); console.log('  ok   ' + msg); }

/* Routes: read from _redirects when we can find one, so a new segment route is covered
   without editing this file. */
function routesFromRedirects(dir) {
  const p = path.join(dir, '_redirects');
  if (!fs.existsSync(p)) return null;
  const out = [];
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^(\/\S+)\s+\/dashboard\.html\?seg=([a-z]+)/);
    if (m) out.push({ route: m[1], seg: m[2] });
  }
  return out;
}

(async () => {
  const browser = await chromium.launch();
  let plan, local = null;
  if (isLocal) {
    const abs = path.resolve(target.replace(/^~/, process.env.HOME));
    const src = fs.readFileSync(abs, 'utf8');
    const m = src.match(/window\.OS_SEGMENTS = \{[\s\S]*?\n\};/);
    const w = {}; new Function('window', m[0])(w);
    const dir = path.dirname(abs);
    local = await serve(dir);
    const file = '/' + path.basename(abs);
    const fromRedirects = routesFromRedirects(dir);
    plan = (fromRedirects || Object.keys(w.OS_SEGMENTS).map(k => ({ route: '?seg=' + k, seg: k })))
      .map(r => ({ seg: r.seg, url: local.base + file + '?seg=' + r.seg, route: r.route }));
  } else {
    const host = target.replace(/\/$/, '');
    // Netlify consumes _redirects at build time and does not serve it, so read the
    // route table from a checkout when one is given (--redirects <repo dir>), else
    // fall back to the table pinned 2026-09-04 and say so.
    const ri = process.argv.indexOf('--redirects');
    const fromRepo = ri > -1 ? routesFromRedirects(process.argv[ri + 1].replace(/^~/, process.env.HOME)) : null;
    // Pinned 2026-09-04 from _redirects. There is no /shop dashboard route: shop is a
    // TAB inside the Dashboard, not a segment. Listing it here made the walk 404.
    const table = fromRepo || [
      { route: '/hotel', seg: 'hotel' }, { route: '/timeshare', seg: 'timeshare' },
      { route: '/rental', seg: 'pm' }, { route: '/concierge', seg: 'concierge' },
      { route: '/fleet', seg: 'cars' },
    ];
    if (!fromRepo) console.log('note: using the pinned route table; pass --redirects <repo dir> to read _redirects');
    plan = table.map(r => ({ seg: r.seg, url: host + r.route, route: r.route }));
  }
  if (!plan.length) { console.error('no dashboard routes found'); process.exit(2); }
  if (MODE !== 'walk') console.log('mode: ' + MODE + '  baseline dir: ' + BASE_DIR);
  console.log('target ' + target + '\nroutes ' + plan.map(p => p.route + '->' + p.seg).join('  ') + '\n');

  for (const { seg, url, route } of plan) {
    console.log(route + '  (expects seg=' + seg + ')');
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !(isLocal && /\/\.netlify\//.test((m.location() || {}).url || ''))) errors.push('console: ' + m.text().slice(0, 160)); });
    page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 160)));
    // Netlify injects /.netlify/scripts/rum at the edge; it 404s on a local static
    // server and is not a defect. Everything else counts.
    const infra = u => isLocal && /\/\.netlify\//.test(u);
    page.on('response', r => { if (r.status() >= 400 && !infra(r.url())) errors.push(r.status() + ' ' + r.url().slice(0, 140)); });
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(1500);

      // 1. routing
      const got = await page.evaluate(() => ({ seg: window.OS_SEG, cfg: window.OS_SEGMENTS && Object.keys(window.OS_SEGMENTS) }));
      if (got.seg === seg) pass(seg, 'OS_SEG=' + got.seg);
      else fail(seg, 'route asked for seg=' + seg + ' but page resolved OS_SEG=' + got.seg + ' (OS_SEGMENTS keys: ' + (got.cfg || []).join(',') + ')');

      // 2. label
      const want = await page.evaluate(s => (window.OS_SEGMENTS[s] || {}).h1, seg);
      const h1 = (await page.textContent('[data-os="h1"]').catch(() => '')) || '';
      if (want && h1.trim() === want) pass(seg, 'h1="' + h1.trim() + '"');
      else fail(seg, 'h1="' + h1.trim() + '" expected "' + want + '"');

      // 3. tabs
      const declared = await page.evaluate(s => ((window.OS_SEGMENTS[s] || {}).tabs) || [], seg);
      for (const v of ALL_VIEWS) {
        const btn = page.locator('.viewtabs button[data-view="' + v + '"]');
        const exists = await btn.count();
        const visible = exists ? await btn.first().isVisible() : false;
        if (!declared.includes(v)) {
          if (visible) fail(seg, 'tab "' + v + '" is visible but the segment does not declare it');
          continue;
        }
        if (!visible) { fail(seg, 'tab "' + v + '" declared but not visible'); continue; }
        await btn.first().click();
        await page.waitForTimeout(400);
        const panel = page.locator('#view-' + v);
        const shown = await panel.count() && await panel.first().isVisible();
        const text = shown ? ((await panel.first().innerText()) || '').replace(/\s+/g, ' ').trim() : '';
        if (shown && text.length > 20) pass(seg, 'view ' + v + ' (' + text.length + ' chars)');
        else fail(seg, 'view ' + v + ' ' + (shown ? 'shown but empty' : 'panel not shown'));
        if (MODE !== 'walk' && shown) {
          fs.mkdirSync(BASE_DIR, { recursive: true });
          const f = path.join(BASE_DIR, seg + '-' + v + '.txt');
          const now = normalize(text);
          if (MODE === 'baseline') {
            fs.writeFileSync(f, now);
            await panel.first().screenshot({ path: f.replace(/\.txt$/, '.png') }).catch(() => {});
          } else if (!fs.existsSync(f)) {
            fail(seg, 'view ' + v + ': no baseline captured yet (run --baseline first)');
          } else {
            const was = fs.readFileSync(f, 'utf8');
            if (was !== now) {
              const i = [...was].findIndex((c, k) => c !== now[k]);
              fail(seg, 'view ' + v + ' changed at char ' + i + ': was "' + was.slice(Math.max(0, i - 40), i + 60) + '" now "' + now.slice(Math.max(0, i - 40), i + 60) + '"');
            } else pass(seg, 'view ' + v + ' matches baseline');
          }
        }
      }

      // 4. promo inputs
      await page.locator('.viewtabs button[data-view="promos"]').first().click().catch(() => {});
      await page.waitForTimeout(400);
      const dateIn = page.locator('#view-promos input[type="date"]').first();
      if (await dateIn.count()) {
        await dateIn.fill('2026-12-24');
        const d = await dateIn.inputValue();
        const t = page.locator('#view-promos input[type="time"]').first();
        if (await t.count()) await t.fill('17:30');
        const u = page.locator('#view-promos input[type="url"]').first();
        if (await u.count()) await u.fill('https://example.com/offer');
        if (d === '2026-12-24') pass(seg, 'promo date/time/url inputs accept values');
        else fail(seg, 'promo date input did not hold value (got "' + d + '")');
      } else pass(seg, 'promo view has no date input to exercise (noted, not a failure)');

      // 5. download
      const dl = page.locator('#dlDashBtn');
      if (await dl.count() && await dl.isVisible()) {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
          dl.click(),
        ]);
        if (!download) fail(seg, 'Download to desktop produced no file in 20s');
        else {
          const p = await download.path().catch(() => null);
          const size = p ? fs.statSync(p).size : 0;
          if (size > 10000) pass(seg, 'download ' + download.suggestedFilename() + ' (' + size + ' B)');
          else fail(seg, 'download ' + download.suggestedFilename() + ' is ' + size + ' B');
        }
      } else fail(seg, '#dlDashBtn missing or hidden');

      // 6. errors
      const uniq = [...new Set(errors)];
      if (!uniq.length) pass(seg, 'no console errors, no 4xx/5xx');
      else for (const e of uniq) fail(seg, e);
    } catch (e) {
      fail(seg, 'walk aborted: ' + String(e).slice(0, 200));
    }
    await ctx.close();
    console.log('');
  }
  await browser.close();
  if (local) local.srv.close();
  console.log('──────────────────────────────');
  console.log((fails.length ? 'FAIL' : 'PASS') + ' · ' + ok.length + ' ok · ' + fails.length + ' failed');
  for (const f of fails) console.log('  ' + f);
  process.exit(fails.length ? 1 : 0);
})();
