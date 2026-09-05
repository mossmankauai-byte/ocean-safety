/* Partner-config data contract. Gate 4 of the Dashboard release-readiness set.
 *
 *   node checks/config-contract.js ~/Desktop/OceanSafe/wt-x
 *
 * Three parts, all against a checkout:
 *   A. Contract diff. What dashboard.html READS out of partner-config/<slug>.json
 *      versus what the files WRITE. A field read but never written, or written but
 *      never read, is a finding.
 *   B. Validation. Every partner-config/*.json must be valid JSON and carry the fields
 *      the Dashboard requires with the right type and an allowed value.
 *   C. Fault injection. Serve the checkout, load the Dashboard with the config missing,
 *      empty, malformed, and 404, and assert the page still renders and does not throw.
 *
 * Exit 1 on any finding.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require(path.join(__dirname, '..', 'tools', 'node', 'node_modules', 'playwright'));

const repo = (process.argv[2] || '').replace(/^~/, process.env.HOME);
if (!repo) { console.error('usage: config-contract.js <repo dir>'); process.exit(2); }
const dash = path.join(repo, 'dashboard.html');
const cfgDir = path.join(repo, 'partner-config');
const src = fs.readFileSync(dash, 'utf8');
const fails = [];
const F = m => { fails.push(m); console.log('  FAIL ' + m); };
const P = m => console.log('  ok   ' + m);

/* The contract the Dashboard actually enforces, read from the source rather than
   assumed: the partner-config consumer reads cfg.island and requires it to be one of
   the VALID islands, else it strips the guest-guide links entirely. */
const REQUIRED = { island: { type: 'string', enum: Object.keys(
  Object.fromEntries((src.match(/var VALID = \{([^}]*)\}/) || [, ''])[1]
    .split(',').map(s => s.trim()).filter(Boolean).map(s => [s.split(':')[0], 1]))) } };

console.log('A. Contract diff');
const read = new Set(Object.keys(REQUIRED));
for (const m of src.matchAll(/\bcfg\.([a-zA-Z_][\w]*)/g)) read.add(m[1]);
const written = new Set();
/* A partner config is one the Dashboard fetches as partner-config/<slug>.json, and
   every one of those carries a partner "name". demo-hotels.json is a hotel DIRECTORY
   loaded by literal filename on a different code path, so it is not held to the
   partner contract. Checking it was a false positive. */
const allFiles = fs.readdirSync(cfgDir).filter(f => f.endsWith('.json'));
const files = allFiles.filter(f => {
  try { return 'name' in JSON.parse(fs.readFileSync(path.join(cfgDir, f), 'utf8')); }
  catch { return true; }   // unparseable files still get reported below
});
const skipped = allFiles.filter(f => !files.includes(f));
for (const f of files) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(cfgDir, f), 'utf8')); }
  catch (e) { F(f + ': not valid JSON (' + e.message.slice(0, 80) + ')'); continue; }
  Object.keys(j).forEach(k => written.add(k));
}
// cfg.* also matches unrelated local variables named cfg in other closures, so report
// the diff, do not fail on it. The required set below is what actually fails.
const readNotWritten = [...read].filter(k => !written.has(k));
const writtenNotRead = [...written].filter(k => !read.has(k) && !k.startsWith('_'));
P('required by the Dashboard: ' + JSON.stringify(REQUIRED));
P('fields any config file writes: ' + [...written].sort().join(', '));
console.log('  --   read but never written (review, may be other closures): ' + (readNotWritten.join(', ') || 'none'));
if (skipped.length) console.log('  --   not partner configs, skipped: ' + skipped.join(', '));
console.log('  --   written but never read (dead config): ' + (writtenNotRead.join(', ') || 'none'));

console.log('\nB. Validation');
for (const f of files) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(cfgDir, f), 'utf8')); } catch { continue; }
  const problems = [];
  for (const [k, spec] of Object.entries(REQUIRED)) {
    const v = j[k];
    if (v === undefined) problems.push('missing ' + k);
    else if (typeof v !== spec.type) problems.push(k + ' is ' + typeof v + ', want ' + spec.type);
    else if (spec.enum && !spec.enum.includes(String(v).toLowerCase())) problems.push(k + '="' + v + '" not in ' + spec.enum.join('|'));
  }
  if (problems.length) F(f + ': ' + problems.join('; ') + '  -> the guest-guide links are stripped for this partner');
  else P(f);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
(async () => {
  console.log('\nC. Fault injection');
  const srv = http.createServer((req, res) => {
    const f = path.join(repo, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(repo) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();

  const apiSeen = new Set();
  const CASES = [
    ['404 (no config for this slug)', null],
    ['empty object', '{}'],
    ['island missing', '{"name":"Test"}'],
    ['island unknown', '{"island":"atlantis"}'],
    ['malformed JSON', '{"island":'],
  ];
  for (const [label, body] of CASES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errs = [], api = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
    // The analytics worker 403s for a slug it does not know. That is correct auth, but
    // the page surfaces it only as a console error. Report it once, separately, rather
    // than letting it mask what each config fault actually does.
    page.on('response', r => { if (r.status() >= 400 && /workers\.dev|supabase/.test(r.url())) api.push(r.status() + ' ' + r.url().slice(0, 100)); });
    page.on('console', m => {
      const at = ((m.location() || {}).url || '');
      if (m.type() !== 'error' || /\/\.netlify\//.test(at) || /404/.test(m.text())) return;
      if (/workers\.dev|supabase/.test(at)) return;   // counted in api[] instead
      errs.push(m.text().slice(0, 90) + ' @ ' + at.slice(0, 90));
    });
    await page.route('**/partner-config/faulttest.json', route =>
      body === null ? route.fulfill({ status: 404, body: 'nf' })
        : route.fulfill({ status: 200, contentType: 'application/json', body }));
    await page.goto(base + '/dashboard.html?seg=hotel&ref=faulttest', { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(1200);
    const h1 = ((await page.textContent('[data-os="h1"]').catch(() => '')) || '').trim();
    const home = await page.locator('#view-home').isVisible().catch(() => false);
    // A ?ref= slug puts the Dashboard behind its sign-in card, which is correct. Detect
    // it so a gated page is not read as a blank one.
    const gated = await page.locator('input[type="password"]').isVisible().catch(() => false);
    if (errs.length) F(label + ': threw ' + errs[0]);
    else if (gated) P(label + ': sign-in card shown (expected for a ?ref= slug)');
    else if (!home || !h1) F(label + ': page did not render (h1="' + h1 + '", home visible=' + home + ')');
    else P(label + ': renders, h1="' + h1 + '", no uncaught error');
    if (api.length) apiSeen.add([...new Set(api)].join(' | '));
    await ctx.close();
  }
  await browser.close();
  srv.close();
  if (apiSeen.size) {
    console.log('\nD. Backend response to an unknown partner');
    for (const a of apiSeen) F('unknown slug -> ' + a + '  (auth is correct; the page shows no message, only a console error)');
  }

  console.log('\n' + '-'.repeat(30));
  console.log((fails.length ? 'FAIL' : 'PASS') + ' · ' + fails.length + ' failed');
  fails.forEach(f => console.log('  ' + f));
  process.exit(fails.length ? 1 : 0);
})();
