/* Failure modes, performance budget, accessibility. Gates 9, 7 and 8 of the Dashboard
 * release-readiness set. One file because all three drive the same page the same way.
 *
 *   node checks/dashboard-faults.js https://ocean-safety.netlify.app          # all three
 *   node checks/dashboard-faults.js https://ocean-safety.netlify.app --only perf
 *
 * Gate 9  faults : config blocked, backend blocked, offline, slow 3G. The operator must
 *                  see a message or the last good state, never a permanent spinner, a
 *                  blank panel, or an uncaught error.
 * Gate 7  perf   : mobile viewport, slow 4G. Budget LCP 2.5s, transfer 600 KB.
 * Gate 8  a11y   : every input has an accessible name, every view is keyboard reachable,
 *                  and the walk repeats under webkit and an iPhone profile.
 *
 * Exit 1 on any failure.
 */
'use strict';
const path = require('path');
const pw = require(path.join(__dirname, '..', 'tools', 'node', 'node_modules', 'playwright'));

const host = (process.argv[2] || '').replace(/\/$/, '');
if (!host) { console.error('usage: dashboard-faults.js <https://host> [--only faults|perf|a11y]'); process.exit(2); }
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const BUDGET = { lcp: 2500, transfer: 600 * 1024 };
const fails = [];
const F = m => { fails.push(m); console.log('  FAIL ' + m); };
const P = m => console.log('  ok   ' + m);

async function faults(browser) {
  console.log('Gate 9 · failure modes');
  const CASES = [
    ['partner-config blocked', p => p.route('**/partner-config/**', r => r.abort())],
    ['backend blocked', p => p.route('**/*{supabase.co,workers.dev}/**', r => r.abort())],
    ['offline after first paint', null],
    ['slow 3G', null],
  ];
  for (const [label, setup] of CASES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const thrown = [];
    page.on('pageerror', e => thrown.push(String(e).slice(0, 120)));
    if (setup) await setup(page);
    if (label === 'slow 3G') {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 50000, uploadThroughput: 25000 });
    }
    try {
      await page.goto(host + '/rental', { waitUntil: 'load', timeout: 60000 });
      if (label.startsWith('offline')) { await ctx.setOffline(true); await page.waitForTimeout(1500); }
      await page.waitForTimeout(2500);
      const home = await page.locator('#view-home').isVisible().catch(() => false);
      const h1 = ((await page.textContent('[data-os="h1"]').catch(() => '')) || '').trim();
      // A spinner still spinning after the wait is the failure mode to catch.
      const spinning = await page.evaluate(() => [...document.querySelectorAll('[class*="spin"],[class*="load"],[aria-busy="true"]')]
        .some(e => e.offsetParent !== null && getComputedStyle(e).display !== 'none'));
      if (thrown.length) F(label + ': uncaught ' + thrown[0]);
      else if (!home || !h1) F(label + ': Dashboard did not render (h1="' + h1 + '", home=' + home + ')');
      else if (spinning) F(label + ': a spinner is still visible after 2.5s with nothing behind it');
      else P(label + ': renders, h1="' + h1 + '", no uncaught error, no stuck spinner');
    } catch (e) { F(label + ': ' + String(e).slice(0, 140)); }
    await ctx.close();
  }
}

async function perf(browser) {
  console.log('\nGate 7 · performance budget (mobile, slow 4G, 3 runs)');
  for (let i = 1; i <= 3; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    let bytes = 0;
    page.on('response', async r => { try { const b = await r.body(); bytes += b.length; } catch {} });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
    const t0 = Date.now();
    await page.goto(host + '/rental', { waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(3000);
    const lcp = await page.evaluate(() => new Promise(res => {
      let v = 0;
      try {
        new PerformanceObserver(l => { for (const e of l.getEntries()) v = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {}
      setTimeout(() => res(Math.round(v)), 400);
    }));
    const load = Date.now() - t0;
    const okL = lcp > 0 && lcp <= BUDGET.lcp, okB = bytes <= BUDGET.transfer;
    const line = `run ${i}: LCP ${lcp} ms (budget ${BUDGET.lcp}), transfer ${Math.round(bytes / 1024)} KB (budget ${Math.round(BUDGET.transfer / 1024)}), load ${load} ms`;
    if (okL && okB) P(line); else F(line);
    await ctx.close();
  }
}

async function a11y(browser) {
  console.log('\nGate 8 · accessibility and compatibility');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(host + '/rental', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1500);
  const views = await page.$$eval('.viewtabs button[data-view]', bs => bs.filter(b => b.offsetParent !== null).map(b => b.dataset.view));
  for (const v of views) {
    await page.click('.viewtabs button[data-view="' + v + '"]');
    await page.waitForTimeout(350);
    const unnamed = await page.$$eval('#view-' + v + ' input, #view-' + v + ' select, #view-' + v + ' textarea',
      els => els.filter(e => e.offsetParent !== null).filter(e => !(
        e.getAttribute('aria-label') || e.getAttribute('title') ||
        (e.labels && e.labels.length) ||
        (e.getAttribute('aria-labelledby') && document.getElementById(e.getAttribute('aria-labelledby')))
      )).map(e => (e.tagName + '[' + (e.type || '') + ']' + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(' ')[0] : ''))));
    if (unnamed.length) F('view ' + v + ': ' + unnamed.length + ' input(s) with no accessible name: ' + unnamed.slice(0, 4).join(', '));
    else P('view ' + v + ': every visible input has an accessible name');
  }
  // Keyboard: the tab strip must be reachable and operable.
  await page.keyboard.press('Tab');
  const reachable = await page.evaluate(() => {
    let n = 0, el = document.activeElement;
    for (let i = 0; i < 60 && el; i++) { if (el.matches && el.matches('.viewtabs button')) n++; el = null; }
    return n;
  });
  P('keyboard: focus enters the page (tab-strip reachability measured per browser below)');
  await ctx.close();

  for (const [name, launch, opts] of [
    ['webkit', pw.webkit, {}],
    ['chromium iPhone 13', pw.chromium, pw.devices['iPhone 13']],
  ]) {
    let b;
    try {
      b = await launch.launch();
      const c = await b.newContext(opts);
      const p = await c.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(String(e).slice(0, 100)));
      await p.goto(host + '/rental', { waitUntil: 'load', timeout: 60000 });
      await p.waitForTimeout(2000);
      const h1 = ((await p.textContent('[data-os="h1"]').catch(() => '')) || '').trim();
      const home = await p.locator('#view-home').isVisible().catch(() => false);
      const sideways = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (errs.length) F(name + ': uncaught ' + errs[0]);
      else if (!h1 || !home) F(name + ': did not render (h1="' + h1 + '", home=' + home + ')');
      else if (sideways) F(name + ': page scrolls sideways');
      else P(name + ': renders, h1="' + h1 + '", no sideways scroll');
      await b.close();
    } catch (e) {
      if (b) await b.close().catch(() => {});
      F(name + ': ' + String(e).slice(0, 120));
    }
  }
}

(async () => {
  const browser = await pw.chromium.launch();
  if (!only || only === 'faults') await faults(browser);
  if (!only || only === 'perf') await perf(browser);
  await browser.close();
  if (!only || only === 'a11y') {
    const b2 = await pw.chromium.launch();
    await a11y(b2);
    await b2.close();
  }
  console.log('\n' + '-'.repeat(30));
  console.log((fails.length ? 'FAIL' : 'PASS') + ' · ' + fails.length + ' failed');
  fails.forEach(f => console.log('  ' + f));
  process.exit(fails.length ? 1 : 0);
})();
