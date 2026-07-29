#!/usr/bin/env node
/**
 * generate_island_guides.mjs — render /<island>/guide/<slug>.html pages, the
 * /<island>/guide/ index, and the 3 root pillar pages from
 * scripts/data/guide_content_<island>.json, faithful to the Kauaʻi guide template.
 *
 * Usage: node scripts/generate_island_guides.mjs <maui|oahu>
 * Idempotent; also appends any missing URLs to sitemap-<island>.xml.
 * Kauaʻi pages are never touched.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

const island = process.argv[2];
// slug -> { label, path }. `island` is the ISLANDS.<slug> key used by ?island=; `PATH` is the
// URL directory. They differ for Hawaiʻi Island: the app slug is 'hawaii' but the public tree is
// /big-island/ — /hawaii/ is reserved for a state hub, so it must never be used here.
const ISLAND_META = {
  maui:   { label: 'Maui',           path: 'maui' },
  oahu:   { label: 'Oʻahu',          path: 'oahu' },
  hawaii: { label: 'Hawaiʻi Island', path: 'big-island' },
};
if (!ISLAND_META[island]) { console.error('usage: generate_island_guides.mjs <maui|oahu|hawaii>'); process.exit(1); }
const LABEL = ISLAND_META[island].label;
const PATH  = ISLAND_META[island].path;
const SITE = 'https://oceansafety.app';
const BUILD_DATE = new Date().toISOString().slice(0, 10);
const PAGES = JSON.parse(readFileSync(`scripts/data/guide_content_${island}.json`, 'utf8'));

const esc = (s) => String(s).replace(/&(?![a-z#0-9]+;)/g, '&amp;').replace(/</g, (m, o, str) => '<'); // body carries limited HTML; only escape stray ampersands
const escAttr = (s) => String(s).replace(/&(?![a-z#0-9]+;)/g, '&amp;').replace(/"/g, '&quot;');
const stripTags = (s) => String(s).replace(/<[^>]+>/g, '');
const descOf = (p) => stripTags(p.intro).slice(0, 200).replace(/\s+\S*$/, '');

const SET_NAME = { itinerary: 'Plan your trip', seasonal: 'When to go & weather', wildlife: 'Wildlife & nature', logistics: 'Getting around & practical' };
const SET_ORDER = ['itinerary', 'seasonal', 'wildlife', 'logistics'];

const CSS = readFileSync('scripts/data/guide_template_kauai.html', 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1];

function chrome(title, desc, canonical, crumb, bodyInner, jsonld) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0f4c5c">
<title>${escAttr(title)} | Ocean Safe</title>
<meta name="description" content="${escAttr(desc)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:title" content="${escAttr(title)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/icons/og-image.png">
<meta property="og:site_name" content="Ocean Safe">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/icons/og-image.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<header class="top"><a href="/?island=${island}"><span class="logo">≈</span><span class="brand">Ocean Safe<small>${LABEL} Visitor Guide</small></span></a></header>
<nav class="crumb">${crumb}</nav>
${bodyInner}
<footer><p><strong>Ocean Safe</strong> is a free, no-login ${LABEL} visitor guide. We score ocean conditions from public data and never certify a beach as safe. Always check posted signs and county lifeguards before you get in the water.</p>
<p style="margin-top:8px"><a href="/${PATH}/today/">Beach conditions</a> &middot; <a href="/${PATH}-travel-guide">Travel guide</a> &middot; <a href="/${PATH}/guide/">${LABEL} guides</a> &middot; <a href="/${PATH}/today/dangerous-beaches">Dangerous beaches</a> &middot; <a href="/?island=${island}">App</a></p></footer>
</div>
</body>
</html>
`;
}

function jsonldFor(p, canonical, crumbItems) {
  return { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: p.title, description: descOf(p), url: canonical,
      datePublished: BUILD_DATE, dateModified: BUILD_DATE,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      author: { '@id': SITE + '/#org' }, publisher: { '@id': SITE + '/#org' },
      isPartOf: { '@type': 'WebSite', name: 'Ocean Safe', url: SITE + '/' } },
    { '@type': 'Organization', name: 'Ocean Safe', url: SITE + '/', '@id': SITE + '/#org',
      logo: { '@type': 'ImageObject', url: SITE + '/icons/og-image.png' } },
    { '@type': 'BreadcrumbList', itemListElement: crumbItems.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
  ] };
}

function renderBody(p) {
  const facts = p.keyFacts && p.keyFacts.length ? `<div class="facts"><h2>Quick facts</h2><ul>${p.keyFacts.map(f => `<li>${f}</li>`).join('')}</ul></div>` : '';
  const secs = p.sections.map(s => {
    const body = /<(p|ul|ol)[ >]/.test(s.body) ? s.body : `<p>${s.body}</p>`;
    return `<section class="sec"><h2>${s.h2}</h2>${body}</section>`;
  }).join('');
  const notes = p.cautions && p.cautions.length ? `<div class="notes"><h2>Before you go</h2><ul>${p.cautions.map(c => `<li>${c}</li>`).join('')}</ul></div>` : '';
  const cta = `<a class="cta" href="/?island=${island}">Open the live Ocean Safe map &amp; conditions →<small>Today's ocean conditions for every ${LABEL} beach, free and no signup</small></a>`;
  const chips = (p.internalLinks || []).map(l => `<a class="chip" href="${l.href}">${l.label}</a>`).join('');
  const cross = chips ? `<div class="crosslinks"><div class="lbl">Related guides &amp; conditions</div><div class="chips">${chips}</div></div>` : '';
  const srcs = (p.sources || []).filter(s => /^https?:/.test(s));
  const src = srcs.length ? `<details class="src"><summary>Sources</summary><ul>${srcs.map(u => `<li><a href="${u}" target="_blank" rel="noopener nofollow">${u.replace(/^https?:\/\//, '').slice(0, 70)}</a></li>`).join('')}</ul></details>` : '';
  return `<h1>${p.title}</h1>\n<p class="intro">${p.intro}</p>\n${facts}\n${secs}\n${notes}\n${cta}\n${cross}\n${src}`;
}

mkdirSync(`${PATH}/guide`, { recursive: true });
const urls = [];
for (const p of PAGES) {
  const isPillar = p.set === 'pillar';
  const canonical = isPillar ? `${SITE}/${p.slug}` : `${SITE}/${PATH}/guide/${p.slug}`;
  const crumb = isPillar
    ? `<a href="/?island=${island}">Home</a> &rsaquo; ${stripTags(p.title).split(':')[0]}`
    : `<a href="/?island=${island}">Home</a> &rsaquo; <a href="/${PATH}/guide/">${LABEL} Guides</a> &rsaquo; ${stripTags(p.title).split(':')[0]}`;
  const crumbItems = isPillar
    ? [['Home', SITE + '/'], [stripTags(p.title).split(':')[0], canonical]]
    : [['Home', SITE + '/'], [`${LABEL} Guides`, `${SITE}/${PATH}/guide/`], [stripTags(p.title).split(':')[0], canonical]];
  const html = chrome(p.title, descOf(p), canonical, crumb, renderBody(p), jsonldFor(p, canonical, crumbItems));
  const out = isPillar ? `${p.slug}.html` : `${PATH}/guide/${p.slug}.html`;
  writeFileSync(out, html);
  urls.push(canonical);
  console.log('wrote', out);
}

// guide index
const guides = PAGES.filter(p => p.set !== 'pillar');
const grps = SET_ORDER.map(set => {
  const rows = guides.filter(p => p.set === set).map(p => `<a class="row" href="/${PATH}/guide/${p.slug}"><span class="nm">${p.title}</span><span class="ar">→</span></a>`).join('');
  return rows ? `<div class="grp"><h2>${SET_NAME[set].replace('&', '&amp;')}</h2>${rows}</div>` : '';
}).join('');
const idxTitle = `${LABEL} Travel Guides: Itineraries, Seasons, Wildlife & Logistics`;
const idxDesc = `Plain, honest guides to planning a ${LABEL} trip: itineraries, when to come, wildlife rules, and the practical things nobody tells you. Free, no ads, no signup.`;
const idxCanonical = `${SITE}/${PATH}/guide/`;
const idxBody = `<h1>${LABEL} Travel Guides</h1>\n<p class="intro">${idxDesc}</p>\n<style>.grp{margin:0 0 22px}.grp h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#0f4c5c;margin:0 0 8px}.row{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;margin-bottom:8px;text-decoration:none}.row .nm{font-size:14.5px;font-weight:600;color:#1c1c1c}.row .ar{color:#0f4c5c}</style>\n${grps}\n<a class="cta" href="/?island=${island}">Open the live Ocean Safe map →<small>Today's ocean conditions for every ${LABEL} beach, free</small></a>`;
writeFileSync(`${PATH}/guide/index.html`, chrome(idxTitle, idxDesc, idxCanonical,
  `<a href="/?island=${island}">Home</a> &rsaquo; ${LABEL} Guides`, idxBody,
  jsonldFor({ title: idxTitle, intro: idxDesc, sections: [] }, idxCanonical, [['Home', SITE + '/'], [`${LABEL} Guides`, idxCanonical]])));
urls.push(idxCanonical);
console.log('wrote', `${PATH}/guide/index.html`);

// sitemap append (idempotent)
const smFile = `sitemap-${PATH}.xml`;
if (existsSync(smFile)) {
  let sm = readFileSync(smFile, 'utf8');
  let added = 0;
  for (const u of urls) {
    if (!sm.includes(`<loc>${u}</loc>`)) { sm = sm.replace('</urlset>', `<url><loc>${u}</loc><lastmod>${BUILD_DATE}</lastmod></url>\n</urlset>`); added++; }
  }
  writeFileSync(smFile, sm);
  console.log(`sitemap-${PATH}.xml: +${added} URLs`);
}
console.log(`DONE ${island}: ${PAGES.length} pages + index`);
