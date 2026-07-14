export const meta = {
  name: 'waikiki-ja-rigor-gate',
  description: 'Rigor gate for the Waikiki-Japanese OceanSafe build: accuracy of food/coffee POIs, native-grade review of JA safety strings, and JA chrome completeness — each adversarially verified, then foreman go/no-go.',
  phases: [
    { title: 'Work Orders', detail: 'os-foreman decomposes the 3 tracks + acceptance criteria' },
    { title: 'Execute', detail: 'accuracy / JA-safety / chrome — each red-teamed as it completes' },
    { title: 'Synthesize', detail: 'os-foreman integrates findings + go/no-go sign-off' }
  ]
};

const BASE = '/Users/nickmossman/Desktop/OceanSafe/maui-build';
const OUT = BASE + '/_waikiki-rigor';
const OAHU = BASE + '/data/oahu.js';
const DICT = BASE + '/data/i18n-ja.js';
const APP = BASE + '/waikiki-ja.html';

const COMMON = [
  'STANDING CONSTRAINTS (all consultants):',
  '- Label every number [measured] / [modeled] / [assumption]. Never fabricate a source, rating, or confirmation.',
  '- Do NOT deploy, commit, push, or send anything. Do NOT edit the live English rendering — English must stay byte-identical.',
  '- You may read any file under ' + BASE + ' and write artifacts ONLY under ' + OUT + '.',
  '- Web tools (WebSearch/WebFetch) are available via ToolSearch if you need them — load them before calling.',
  '- This is OceanSafe, a beach-SAFETY product. When in doubt on a safety meaning, err toward a STRONGER, clearer warning, never a softer one.'
].join('\n');

// ---------- Schemas ----------
const WO_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['tracks', 'reconciliations', 'notes'],
  properties: {
    tracks: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['key', 'title', 'mandate', 'acceptance', 'successMetric'],
      properties: {
        key: { type: 'string' }, title: { type: 'string' },
        mandate: { type: 'string' }, acceptance: { type: 'string' },
        successMetric: { type: 'string' }
      } } },
    reconciliations: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' }
  }
};

const A_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['clusterCount', 'items', 'topPicks', 'needsManualVerify', 'method', 'caveats'],
  properties: {
    clusterCount: { type: 'number' },
    items: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['name', 'category', 'claimedRating', 'verifiedRating', 'source', 'coordsStatus', 'status'],
      properties: {
        name: { type: 'string' }, category: { type: 'string' },
        claimedRating: { type: 'string' }, verifiedRating: { type: 'string' },
        source: { type: 'string' }, coordsStatus: { type: 'string' },
        status: { type: 'string', enum: ['VERIFIED', 'PLAUSIBLE-UNVERIFIED', 'SUSPECT', 'NOT-FOUND'] }
      } } },
    topPicks: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['category', 'name', 'why', 'source'],
      properties: { category: { type: 'string' }, name: { type: 'string' }, why: { type: 'string' }, source: { type: 'string' } } } },
    needsManualVerify: { type: 'array', items: { type: 'string' } },
    method: { type: 'string' }, caveats: { type: 'string' }
  }
};

const A_REDTEAM_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['checked', 'fabricationsFound', 'netVerifiedCount', 'verdict'],
  properties: {
    checked: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['name', 'claim', 'holds', 'note'],
      properties: { name: { type: 'string' }, claim: { type: 'string' }, holds: { type: 'boolean' }, note: { type: 'string' } } } },
    fabricationsFound: { type: 'array', items: { type: 'string' } },
    netVerifiedCount: { type: 'number' },
    verdict: { type: 'string' }
  }
};

const B_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['reviewedCount', 'findings', 'criticalSoftenings', 'humanGateShortlist', 'overallRisk'],
  properties: {
    reviewedCount: { type: 'number' },
    findings: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['en', 'ja_current', 'verdict', 'ja_fixed', 'severity'],
      properties: {
        en: { type: 'string' }, ja_current: { type: 'string' },
        verdict: { type: 'string', enum: ['OK', 'SOFTENED', 'WRONG', 'AWKWARD'] },
        ja_fixed: { type: 'string' },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'none'] }
      } } },
    criticalSoftenings: { type: 'array', items: { type: 'string' } },
    humanGateShortlist: { type: 'array', items: { type: 'string' } },
    overallRisk: { type: 'string' }
  }
};

const B_REDTEAM_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['independentFindings', 'agreesWithTrackB', 'residualRisk', 'verdict'],
  properties: {
    independentFindings: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['en', 'ja', 'issue', 'fix', 'severity'],
      properties: { en: { type: 'string' }, ja: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' }, severity: { type: 'string' } } } },
    agreesWithTrackB: { type: 'boolean' },
    residualRisk: { type: 'string' }, verdict: { type: 'string' }
  }
};

const C_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['missingCount', 'pairs', 'mergeSnippetPath', 'notes'],
  properties: {
    missingCount: { type: 'number' },
    pairs: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['en', 'ja'], properties: { en: { type: 'string' }, ja: { type: 'string' } } } },
    mergeSnippetPath: { type: 'string' }, notes: { type: 'string' }
  }
};

const C_REDTEAM_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['nodeCheckOk', 'priceLeak', 'entityIssues', 'ctaCoverage', 'missedStrings', 'verdict'],
  properties: {
    nodeCheckOk: { type: 'boolean' }, priceLeak: { type: 'boolean' },
    entityIssues: { type: 'array', items: { type: 'string' } },
    ctaCoverage: { type: 'string' },
    missedStrings: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string' }
  }
};

const SIGNOFF_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['applyNow', 'safetyGate', 'accuracy', 'goNoGo', 'caveats'],
  properties: {
    applyNow: { type: 'array', items: { type: 'string' } },
    safetyGate: { type: 'object', additionalProperties: false,
      required: ['humanSignoffCleared', 'criticalCount', 'status'],
      properties: { humanSignoffCleared: { type: 'boolean' }, criticalCount: { type: 'number' }, status: { type: 'string' } } },
    accuracy: { type: 'object', additionalProperties: false,
      required: ['topPicksCount', 'needsManualVerify'],
      properties: { topPicksCount: { type: 'number' }, needsManualVerify: { type: 'number' } } },
    goNoGo: { type: 'object', additionalProperties: false,
      required: ['internalDemo', 'guestFacing', 'hotelDemo'],
      properties: { internalDemo: { type: 'string' }, guestFacing: { type: 'string' }, hotelDemo: { type: 'string' } } },
    caveats: { type: 'array', items: { type: 'string' } }
  }
};

// ---------- Phase 1: Work Orders ----------
phase('Work Orders');
const woPrompt = [
  'ROLE: os-foreman of the OceanSafety growth firm. Write the work orders for a 3-track rigor gate on the Waikiki-Japanese build.',
  COMMON, '',
  'THE THREE TRACKS:',
  'A) ACCURACY — verify the ~23 Waikiki-cluster food/coffee/town POIs in ' + OAHU + ' (ratings + coordinates, currently [verify]-flagged) against real sources; produce a curated TOP-spots shortlist. Honest verification status; no fabrication.',
  'B) JA SAFETY (HARD GATE) — native-grade review of EVERY safety-meaning Japanese string in ' + DICT + '. Catch any warning that was SOFTENED vs the English. LLM review does NOT clear the real-human native gate.',
  'C) CHROME COMPLETENESS — find Oahu UI strings rendered in ' + APP + ' but missing from window.I18N.ja; translate (UI register); stage a ready-to-merge snippet. Never translate/convert prices.',
  '',
  'For each track give: mandate, acceptance criteria, and the single success metric. Then list the forced reconciliations (claims that MUST agree across tracks) and any notes. Return the schema.'
].join('\n');
const workOrders = await agent(woPrompt, { agentType: 'os-foreman', label: 'foreman:work-orders', phase: 'Work Orders', schema: WO_SCHEMA, effort: 'medium' });

// ---------- Phase 2: Execute (3 tracks, each do->redteam as a pipeline; barrier before synth) ----------
phase('Execute');

const trackA = (async () => {
  const doPrompt = [
    'ROLE: data-verification analyst (NOT a copywriter; you confirm facts, you do not invent them).',
    COMMON, '',
    'TASK: Verify and curate the Waikiki-cluster local-business POIs.',
    '1. Read ' + OAHU + '. Select the food/coffee/treats/grocery/gallery POIs whose lat is 21.25..21.305 AND lon is -157.86..-157.79 (Waikiki + Ala Moana + Diamond Head/Kaimana fringe). There are ~23.',
    '2. Each POI embeds a claimed rating inside its "tip" (e.g. "Yelp ~4.4 stars [verify rating]") and "[verify coords]". Treat these as UNVERIFIED claims.',
    '3. Use WebSearch/WebFetch to check, per POI: does the business exist at/near Waikiki, what is its actual current rating, and are the coords roughly right. Mark status VERIFIED (cite a real source URL + the rating you found), PLAUSIBLE-UNVERIFIED (exists but rating unconfirmed), SUSPECT (details conflict), or NOT-FOUND. Do NOT mark VERIFIED without a real source you actually retrieved.',
    '4. Build a curated "Waikiki Top Picks" shortlist: only items you grounded as real and well-rated (>=4.0 / 3-star+), grouped by category (coffee, eats, treats, grocery, gifts). This is what the user wants to feature, zoomed into Waikiki.',
    '5. Write a readable artifact to ' + OUT + '/trackA-waikiki-poi-verification.md and return the schema. List every POI you could NOT ground under needsManualVerify.',
    'SUCCESS METRIC: a source-tagged curated Waikiki top-spots list + an honest per-POI verification status, with the count still needing manual verification.'
  ].join('\n');
  const aDo = await agent(doPrompt, { agentType: 'general-purpose', label: 'accuracy:verify-pois', phase: 'Execute', schema: A_SCHEMA, effort: 'high' });
  const rtPrompt = [
    'ROLE: skeptical fact-checker red-teaming an accuracy report.',
    COMMON, '',
    'The accuracy analyst produced this (JSON):', JSON.stringify(aDo), '',
    'TASK: Try to break it. Independently re-check 5-8 of the items marked VERIFIED using WebSearch/WebFetch. Catch: any VERIFIED item whose cited source is fabricated or does not actually state that rating; any rating that does not match the source; any business that does not actually exist near Waikiki. Report which claims hold, list fabrications found, give the NET defensible verified count, and a one-line verdict.',
    'Default to skepticism: if a "source" cannot be retrieved, the claim does NOT hold.'
  ].join('\n');
  const aRt = await agent(rtPrompt, { agentType: 'general-purpose', label: 'accuracy:red-team', phase: 'Execute', schema: A_REDTEAM_SCHEMA, effort: 'high' });
  return { do: aDo, redteam: aRt };
})();

const trackB = (async () => {
  const doPrompt = [
    'ROLE: Japanese-native ocean-safety translation reviewer. Your single obsession: a safety warning must NEVER read weaker in Japanese than in English.',
    COMMON, '',
    'TASK: Native-grade review of every SAFETY-MEANING Japanese string in ' + DICT + ' (window.I18N.ja maps English -> Japanese).',
    '1. Identify the safety-meaning pairs: hazard names (rip current / 離岸流, shore break, jellyfish / box jellyfish, high surf, sharp rocks, strong current), imperatives ("stay out", "do not enter", "not safe", "dangerous", "keep out of the water"), the safe / not-safe verdict words, mortality phrasing ("people have died", "drownings"), and uncertainty/stale-data warnings (e.g. "Using last-known conditions, verify before you enter the water"), plus advisory-level labels.',
    '2. For each EN->JA pair judge: OK / SOFTENED (JA weaker or more tentative than EN — CRITICAL) / WRONG (mistranslation) / AWKWARD (understood but unnatural). Where not OK, give a corrected Japanese that is natural AND carries equal-or-stronger urgency. Keep units (ft/m) consistent.',
    '3. Pick the items that MOST need a REAL human native-speaker sign-off and put them in humanGateShortlist. State plainly in caveats: this is LLM-native-grade review and does NOT itself clear the human hard gate.',
    '4. Write ' + OUT + '/trackB-ja-safety-review.md and return the schema.',
    'SUCCESS METRIC: a corrected safety-string set with severity, plus the human-gate shortlist and an overall residual-risk read.'
  ].join('\n');
  const bDo = await agent(doPrompt, { agentType: 'os-product-trust', label: 'ja-safety:review', phase: 'Execute', schema: B_SCHEMA, effort: 'high' });
  const rtPrompt = [
    'ROLE: adversarial safety auditor. Assume the first reviewer MISSED at least one softened warning.',
    COMMON, '',
    'First reviewer output (JSON):', JSON.stringify(bDo), '',
    'TASK: Independently scan ' + DICT + ' for safety strings where the Japanese is weaker, vaguer, more polite-but-softer, or more conditional than the English — especially the verdict, "stay out"/"do not enter", "people have died", and the stale-data/"verify before you enter" warning. List any the first reviewer missed, with a stronger fix and severity. State whether you agree with Track B overall, the residual risk, and a one-line verdict.'
  ].join('\n');
  const bRt = await agent(rtPrompt, { agentType: 'general-purpose', label: 'ja-safety:red-team', phase: 'Execute', schema: B_REDTEAM_SCHEMA, effort: 'high' });
  return { do: bDo, redteam: bRt };
})();

const trackC = (async () => {
  const doPrompt = [
    'ROLE: i18n completeness engineer.',
    COMMON, '',
    'TASK: Close the Japanese coverage gap on Oahu UI chrome.',
    '1. The app ' + APP + ' renders Oahu in Japanese but some chrome stays English because those strings are missing from window.I18N.ja in ' + DICT + '. Use grep/bash to extract candidate UI strings from ' + APP + ' and diff against existing dict keys.',
    '2. Target at least: region chips (South, Windward, Leeward, North Shore), tab labels (Beaches, Trails, Family, Tours, Town), filter labels (Wildlife, Scenic, Towns, Cultural, Hazards, Playgrounds, All, Family), map region overlays (the "North", "South", "East", "West" pills), "FAMILY NOW" / "NOW", the service-worker "New version available" / "Reload", and any decision-point button/CTA text a guest taps.',
    '3. Translate each to natural Japanese UI register. CRITICAL: keep prices in USD "$" — do NOT translate or convert any price/money string. Do not translate proper nouns/brand names.',
    '4. Produce a ready-to-merge snippet of the exact form: window.I18N.ja=Object.assign(window.I18N.ja||{},{ ... }); Decode HTML entities in keys so they match rendered text. Write it to ' + OUT + '/trackC-chrome-merge.js and a readable report to ' + OUT + '/trackC-chrome-report.md. Run "node --check" on the snippet. Do NOT merge into the live dict.',
    'SUCCESS METRIC: count of newly-covered strings + a node-valid merge snippet that introduces no price translations and no English-rendering risk.'
  ].join('\n');
  const cDo = await agent(doPrompt, { agentType: 'general-purpose', label: 'chrome:extract-translate', phase: 'Execute', schema: C_SCHEMA, effort: 'low' });
  const rtPrompt = [
    'ROLE: i18n QA red-team.',
    COMMON, '',
    'Track C output (JSON):', JSON.stringify(cDo), '',
    'TASK: Validate the staged merge at ' + OUT + '/trackC-chrome-merge.js. Run node --check (report nodeCheckOk). Confirm: no price/$ strings were translated (priceLeak), keys decode HTML entities correctly (entityIssues), the high-value decision-point CTAs are actually covered (ctaCoverage), and list any obviously-still-English UI strings the extractor missed (missedStrings). One-line verdict.'
  ].join('\n');
  const cRt = await agent(rtPrompt, { agentType: 'general-purpose', label: 'chrome:red-team', phase: 'Execute', schema: C_REDTEAM_SCHEMA, effort: 'medium' });
  return { do: cDo, redteam: cRt };
})();

const [A, B, C] = await Promise.all([trackA, trackB, trackC]);

// ---------- Phase 3: Synthesize + foreman sign-off ----------
phase('Synthesize');
const synthPrompt = [
  'ROLE: os-foreman. Integrate all three tracks and issue the go/no-go for the Waikiki-Japanese build.',
  COMMON, '',
  'WORK ORDERS (JSON):', JSON.stringify(workOrders), '',
  'TRACK A accuracy do+redteam (JSON):', JSON.stringify(A), '',
  'TRACK B JA-safety do+redteam (JSON):', JSON.stringify(B), '',
  'TRACK C chrome do+redteam (JSON):', JSON.stringify(C), '',
  'PRODUCE:',
  '1. applyNow: the concrete things safe to apply immediately (e.g. the chrome merge IF its red-team passed node --check with no price leak).',
  '2. safetyGate: humanSignoffCleared (almost certainly FALSE — LLM review does not clear a real-human native gate), the count of critical softenings/wrongs found, and a one-line status.',
  '3. accuracy: how many curated Waikiki top picks are defensibly verified, and how many POIs still need manual verification.',
  '4. goNoGo for three audiences: internalDemo, guestFacing (a real Japanese guest relying on it), hotelDemo (showing a Japanese-speaking hotel GM). Each: GO / NO-GO + one-line reason.',
  '5. caveats: the honest list, including that prices stay USD and the SEO/GEO hreflang+noindex items are not yet done.',
  'Write the full sign-off to ' + OUT + '/SIGNOFF.md and return the schema. Be honest; surface failures.'
].join('\n');
const signoff = await agent(synthPrompt, { agentType: 'os-foreman', label: 'foreman:sign-off', phase: 'Synthesize', schema: SIGNOFF_SCHEMA, effort: 'high' });

return { workOrders, A, B, C, signoff };
