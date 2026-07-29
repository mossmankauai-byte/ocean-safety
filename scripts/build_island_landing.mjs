#!/usr/bin/env node
/**
 * build_island_landing.mjs — render /<path>/index.html, an island's front door.
 *
 * The hand-written version of this page linked 6 of 28 beach pages, 0 of 15 guides and 0 of 3
 * pillars — every guide the island shipped was orphaned from its own landing page. Generating it
 * from the same sources the rest of the tree uses means the front door cannot fall behind the
 * content again, and it cannot quote a safety line the dataset no longer says.
 *
 * Sources of truth:
 *   data/<slug>.js                          beaches, regions, warning_only, lifeguard, tips
 *   scripts/data/guide_content_<slug>.json  the guides and pillars
 *
 * Chrome, CSS and markup classes are reused verbatim from the existing page — no new styles.
 *
 * Usage: node scripts/build_island_landing.mjs <maui|oahu|hawaii> [--write]
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

const island = process.argv[2];
const WRITE = process.argv.includes('--write');
const META = {
  maui:   { label: 'Maui',           path: 'maui',       short: 'Maui' },
  oahu:   { label: 'Oʻahu',          path: 'oahu',       short: 'Oʻahu' },
  hawaii: { label: 'Hawaiʻi Island', path: 'big-island', short: 'Hawaiʻi Island' },
};
if (!META[island]) { console.error('usage: build_island_landing.mjs <maui|oahu|hawaii> [--write]'); process.exit(1); }
const { label: LABEL, path: PATH } = META[island];
const SITE = 'https://oceansafety.app';
const OUT = `${PATH}/index.html`;

// ── data ──────────────────────────────────────────────────────────────────────
const src = readFileSync(`data/${island}.js`, 'utf8');
const stub = new Proxy({}, { get: () => (() => () => false) });
const w = { ISLANDS: { [island]: {} } };
const data = new Function('window', 'ISLANDS', 'RULES', src + `\nreturn ISLANDS.${island}.data;`)(w, w.ISLANDS, stub);
const beaches = data.beaches;

const gp = `scripts/data/guide_content_${island}.json`;
const pages = existsSync(gp) ? JSON.parse(readFileSync(gp, 'utf8')) : [];
const guides = pages.filter(p => p.set !== 'pillar');
const pillars = pages.filter(p => p.set === 'pillar');

// Region headings must match the ones already on <path>/today/index.html.
const REGION_HEADS = {
  hawaii: [['Kona', 'Kona (West)', 'kona'], ['Kohala', 'Kohala (North)', 'kohala'],
           ['Hilo/Puna', 'Hilo & Puna (East)', 'hilo'], ['Kaʻū', 'Kaʻū (South)', 'kau']],
};
const SET_NAME = { itinerary: 'Plan your trip', seasonal: 'When to go & weather',
                   wildlife: 'Wildlife & ocean life', logistics: 'Getting around & practical' };
const SET_ORDER = ['itinerary', 'seasonal', 'wildlife', 'logistics'];

const esc = (s) => String(s).replace(/&(?![a-z#0-9]+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escA = (s) => esc(s).replace(/"/g, '&quot;');

// ── the six calmest, most reliable swims ──────────────────────────────────────
// Hand-picked per island (a "calmest" list is editorial), but the DESCRIPTION is always the
// beach's own full `tip`. The previous page truncated each tip at its first sentence, which cut
// the caveat off five of six — Kaunaʻoa read "calm and family-friendly in summer" with its
// no-lifeguard winter-shorebreak warning removed. Never summarise a safety field here.
const CALMEST = { hawaii: ['waialea', 'kaunaoa', 'hapuna', 'richardson', 'mauumae', 'spencer'] };
const calm = (CALMEST[island] || []).map(id => beaches.find(b => b.id === id)).filter(Boolean);

const row = (href, name, desc, cls = '') =>
  `<a class="row${cls ? ' ' + cls : ''}" href="${href}"><div class="nm">${esc(name)}</div><div class="d">${esc(desc)}</div></a>`;

const warnCount = beaches.filter(b => b.warning_only).length;
const guardCount = beaches.filter(b => b.lg && b.lg !== 'none').length;

// ── regions ───────────────────────────────────────────────────────────────────
const regionRows = (REGION_HEADS[island] || []).map(([r, head, anchor]) => {
  const inR = beaches.filter(b => b.r === r);
  if (!inR.length) return '';
  const wo = inR.filter(b => b.warning_only).length;
  const lg = inR.filter(b => b.lg && b.lg !== 'none').length;
  const bits = [`${inR.length} beach${inR.length === 1 ? '' : 'es'}`];
  bits.push(wo ? `${wo} to watch from shore` : 'none flagged to watch from shore');
  bits.push(lg ? `${lg} lifeguarded` : 'no lifeguard on this coast');
  return row(`/${PATH}/today/#${anchor}`, head, bits.join(' · '));
}).join('');

// ── guides ────────────────────────────────────────────────────────────────────
const guideBlocks = SET_ORDER.map(set => {
  const inSet = guides.filter(p => p.set === set);
  if (!inSet.length) return '';
  return `<h2 class="sh">${esc(SET_NAME[set])}</h2>` +
    inSet.map(p => row(`/${PATH}/guide/${p.slug}`, p.title, p.targetQuery ? '' : '')
      .replace('<div class="d"></div>', '')).join('');
}).join('');

const pillarRows = pillars.map(p =>
  row(`/${p.slug}`, p.title.split(':')[0], p.title.split(':').slice(1).join(':').trim() || '')
    .replace('<div class="d"></div>', '')).join('');

const desc = `Live surf, wind and lifeguard conditions plus an honest safety read for every major ${LABEL} beach — calmest swims, where not to swim, what's good today.`;

const jsonld = {
  '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', name: `${LABEL} Beach Safety & Live Ocean Conditions`, url: `${SITE}/${PATH}/`,
      description: desc, isPartOf: { '@type': 'WebSite', name: 'Ocean Safe', url: SITE + '/' },
      about: { '@type': 'Place', name: LABEL } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: LABEL, item: `${SITE}/${PATH}/` }] },
  ],
};

// CSS + head are lifted verbatim from the page being replaced, so nothing about the brand moves.
const prev = readFileSync(OUT, 'utf8');
const CSS = prev.match(/<style>([\s\S]*?)<\/style>/)[1];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0f4c5c">
<title>${escA(LABEL)} Beach Safety &amp; Live Ocean Conditions | Ocean Safe</title>
<meta name="description" content="${escA(desc)}">
<link rel="canonical" href="${SITE}/${PATH}/">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta property="og:title" content="${escA(LABEL)} Beach Safety &amp; Live Ocean Conditions | Ocean Safe">
<meta property="og:description" content="${escA(desc)}">
<meta property="og:url" content="${SITE}/${PATH}/">
<meta property="og:image" content="${SITE}/icons/og-image.png">
<meta property="og:site_name" content="Ocean Safe">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>${CSS}</style>
</head>
<body><div class="wrap"><header class="top"><a href="/"><span class="logo">≈</span><span class="brand">Ocean Safe<small>${esc(LABEL)} Beach Safety</small></span></a></header><nav class="crumb"><a href="/">Home</a> &rsaquo; ${esc(LABEL)}</nav><h1>${esc(LABEL)} beach safety, today</h1><p class="intro">A free, no-login guide to ${esc(LABEL)}'s ocean: live conditions and an honest, beach-by-beach safety read for ${beaches.length} beaches — including the ${warnCount} you should watch from shore. ${guardCount} of them have a lifeguard.</p><a class="cta" href="${SITE}/go/${island}">Open the live ${esc(LABEL)} map &amp; beach scores →</a><h2 class="sh">Calmest, most reliable swims</h2>${calm.map(b => row(`/${PATH}/today/${b.id}`, b.name, b.tip || '')).join('')}<h2 class="sh">Know before you go</h2>${row(`/${PATH}/today/dangerous-beaches`, `${LABEL}'s most dangerous beaches`, `The ${warnCount} beaches to watch from shore — and a safer choice nearby.`, 'warn')}${row(`/${PATH}/today/`, `All ${LABEL} beach conditions today`, `Live surf, wind and our score for every beach, by coast.`)}<h2 class="sh">By coast</h2>${regionRows}${guideBlocks}<h2 class="sh">Start here</h2>${pillarRows}<footer><p><strong>Ocean Safe</strong> — free ocean-safety guide. We never certify a beach as safe.</p><p style="margin-top:8px"><a href="/${PATH}/today/">Conditions</a> &middot; <a href="/${PATH}/today/dangerous-beaches">Dangerous beaches</a> &middot; <a href="/${PATH}/guide/">${esc(LABEL)} guides</a> &middot; <a href="/">App</a></p></footer></div></body>
</html>
`;

const changed = html !== prev;
console.log(`  ${OUT}: ${changed ? 'CHANGED' : 'unchanged'}  ${prev.length} -> ${html.length} bytes`);
console.log(`  beaches ${beaches.length} (${warnCount} watch-from-shore, ${guardCount} guarded) · calmest ${calm.length}` +
  ` · regions ${(REGION_HEADS[island] || []).length} · guides ${guides.length} · pillars ${pillars.length}`);
if (WRITE) { writeFileSync(OUT, html); console.log(`  WROTE ${OUT}`); }
else console.log('  dry-run — pass --write to apply');
