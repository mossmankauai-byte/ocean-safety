#!/usr/bin/env node
/**
 * sync_today_pages.mjs — keep the per-beach /<island>/today/<id>.html SEO pages
 * in sync with the canonical beach data (data/<island>.js), so the static pages
 * never drift from the safety data again.
 *
 * Faithful to the original (one-shot) generator's derivation rules, reverse-
 * engineered from the existing pages:
 *   - var B.category   = warning_only ? 'noswim' : (left as-is for non-warning)
 *   - "one thing to know" hazard <p> = warning_only ? data.danger : data.tip
 *   - FAQ Q1 ("Is it safe to swim …") = for a beach that is NEWLY warning_only,
 *     "<Name> is flagged as a hazard beach. " + data.danger  (visible + JSON-LD)
 *
 * Idempotent: re-running with unchanged data is a no-op (byte-identical output).
 * Scope: maui + oahu only. Never touches Kauaʻi/Big Island/Hawaiʻi pages.
 *
 * Usage:  node scripts/sync_today_pages.mjs [--write]   (default: dry-run report)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

const WRITE = process.argv.includes('--write');
const ISLANDS = ['maui', 'oahu'];

function arrText(h, key) {
  const i = h.indexOf(key + ':'); const b = h.indexOf('[', i);
  let d = 0, inS = false, c = '', e = false, end = -1;
  for (let j = b; j < h.length; j++) {
    const ch = h[j];
    if (e) { e = false; continue; }
    if (inS) { if (ch === '\\') e = true; else if (ch === c) inS = false; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inS = true; c = ch; continue; }
    if (ch === '[') d++; else if (ch === ']') { d--; if (d === 0) { end = j; break; } }
  }
  return JSON.parse(h.slice(b, end + 1));
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const jsonStr = (s) => JSON.stringify(String(s)).slice(1, -1); // escape for inside a JSON "..." value

let changed = 0, scanned = 0;
for (const isl of ISLANDS) {
  const beaches = arrText(readFileSync(`data/${isl}.js`, 'utf8'), 'beaches');
  for (const b of beaches) {
    const f = `${isl}/today/${b.id}.html`;
    if (!existsSync(f)) continue;
    scanned++;
    let h = readFileSync(f, 'utf8');
    const orig = h;
    const notes = [];

    const wo = !!b.warning_only;
    const curCat = (h.match(/"category":\s*"([^"]+)"/) || [])[1];
    const newCat = wo ? 'noswim' : curCat;            // only force noswim for warning_only
    const newHazard = wo ? (b.danger || b.tip || '') : (b.tip || '');

    // 1) category in the embedded var B
    if (curCat && newCat && newCat !== curCat) {
      h = h.replace(/("category":\s*")[^"]*(")/, `$1${newCat}$2`);
      notes.push(`category ${curCat}→${newCat}`);
    }
    // 2) "one thing to know" hazard paragraph
    h = h.replace(
      /(<h2 class="sh">The one thing to know<\/h2>\s*<p[^>]*>)([\s\S]*?)(<\/p>)/,
      (m, a, cur, z) => {
        if (cur.trim() === esc(newHazard).trim()) return m;
        notes.push('hazard text');
        return a + esc(newHazard) + z;
      }
    );
    // 3) FAQ Q1 — only regenerate when a beach is NEWLY warning_only (category just flipped to noswim)
    if (wo && curCat !== 'noswim') {
      const name = (h.match(/<title>([^,<]+),/) || [])[1] || b.name;
      const q1 = `${name} is flagged as a hazard beach. ${b.danger || ''}`;
      // visible FAQ
      h = h.replace(
        /(<dt>Is it safe to swim at[^<]*<\/dt><dd>)([\s\S]*?)(<\/dd>)/,
        (m, a, cur, z) => { notes.push('faq q1 (visible)'); return a + esc(q1) + z; }
      );
      // JSON-LD FAQ answer
      h = h.replace(
        /("name": "Is it safe to swim at[^"]*\?", "acceptedAnswer": \{"@type": "Answer", "text": ")([^"]*)(")/,
        (m, a, cur, z) => { notes.push('faq q1 (json-ld)'); return a + jsonStr(q1) + z; }
      );
    }

    if (h !== orig) {
      changed++;
      console.log(`${WRITE ? 'WROTE' : 'WOULD CHANGE'} ${f}: ${notes.join(', ')}`);
      if (WRITE) writeFileSync(f, h);
    }
  }
}
console.log(`\n${scanned} pages scanned, ${changed} ${WRITE ? 'updated' : 'would change'}${WRITE ? '' : ' (dry-run; pass --write to apply)'}`);
