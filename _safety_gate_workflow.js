export const meta = {
  name: 'oceansafe-safety-gate',
  description: 'Audit + adversarially verify the stress-test flags for Maui + Oahu, return apply-ready edits',
  phases: [
    { title: 'Audit', detail: 'os-product-trust proposes data edits per flagged beach' },
    { title: 'Verify', detail: 'adversarial skeptic refutes over-warning / unsupported edits' },
  ],
}

const REPO = '/Users/nickmossman/Desktop/OceanSafe/maui-build'

const COMMON = [
  'You are refining the OceanSafe beach-safety dataset. This is a life-safety product; a false "safe" can kill and a false "dangerous" erodes trust (people ignore all warnings).',
  '',
  'Read these files yourself before proposing anything:',
  '  - ' + REPO + '/STRESS-TEST-4YR.md  (the flag list + the WHY for each flag)',
  '  - the island data file named below (find each beach by its name, read its FULL current record: danger, tip, lg, lg_hours, kid, warning_only, facing, sb, source_notes)',
  '',
  'For EACH beach in your bucket decide one verdict:',
  '  - "edit"      = the current record genuinely needs a change',
  '  - "no-change" = the current record ALREADY handles the flag adequately (many already have a danger string / snorkel messaging — if so, say so and do NOT pad it)',
  '',
  'Rules by flag nature:',
  '  - Type A (under-warned, real swell exposure): add a seasonal/conditional warning, or drop kid:true, or set warning_only:true with a hand-written danger string. Only escalate if the open-water exposure is real (not a protected lagoon cell).',
  '  - Type B (calm-but-fatal): ADD or sharpen snorkel / medical / rip / current messaging in danger/tip. Do NOT set warning_only:true or remove kid:true on a genuinely calm guarded beach — over-warning is a failure.',
  '  - Grid/facing artifact (lagoon or harbor cell snapped to an exposed offshore point, OR facing inconsistent with dominant historical swell): the LABEL may be fine; CORRECT the facing value (give old + proposed degrees + why) and/or note the morph so exposure scoring is right. Do not add a scary warning to a genuinely sheltered lagoon.',
  '',
  'Verify every lifeguard claim and danger claim against real sources: county Ocean Safety (mauicounty.gov / honolulu.gov Ocean Safety), oceansafety.hawaii.gov lifeguarded-beach list, and documented drownings/rescues (KHON2, Hawaii News Now, Star-Advertiser, Maui News). Cite what you actually checked. If you cannot verify, lower confidence and say so.',
  '',
  'Every proposed record stays tagged with NEEDS-HUMAN-VERIFY in source_notes (do not remove it). Be surgical: propose only field-level edits, never rewrite the whole record. Quote the EXACT current substring you would replace so the foreman can apply it precisely.',
].join('\n')

const AUDIT_SCHEMA = {
  type: 'object',
  required: ['beaches'],
  properties: {
    beaches: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'flagType', 'verdict', 'currentSummary', 'proposedEdits', 'citations', 'confidence'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          flagType: { type: 'string', enum: ['A', 'B', 'REVIEW', 'artifact'] },
          verdict: { type: 'string', enum: ['edit', 'no-change'] },
          currentSummary: { type: 'string', description: 'what the record already says about safety (1-2 sentences)' },
          proposedEdits: {
            type: 'array',
            items: {
              type: 'object',
              required: ['field', 'action', 'currentValue', 'newValue', 'reason'],
              properties: {
                field: { type: 'string', description: 'e.g. danger, tip, facing, kid, warning_only, source_notes' },
                action: { type: 'string', enum: ['add', 'replace', 'remove'] },
                currentValue: { type: 'string', description: 'EXACT current substring/value, or empty if adding a new field' },
                newValue: { type: 'string' },
                reason: { type: 'string' },
              },
            },
          },
          citations: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['rulings'],
  properties: {
    rulings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'ruling', 'overWarningRisk', 'reason'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          ruling: { type: 'string', enum: ['accept', 'reject', 'modify'] },
          overWarningRisk: { type: 'boolean', description: 'true if the proposed edit risks over-warning a genuinely calm/guarded beach' },
          factualIssue: { type: 'boolean', description: 'true if a lg/danger/facing claim is unsupported or contradicted by sources' },
          revisedEdits: {
            type: 'array',
            description: 'only if ruling=modify: the corrected field-level edits the foreman should apply instead',
            items: {
              type: 'object',
              required: ['field', 'action', 'currentValue', 'newValue', 'reason'],
              properties: {
                field: { type: 'string' },
                action: { type: 'string', enum: ['add', 'replace', 'remove'] },
                currentValue: { type: 'string' },
                newValue: { type: 'string' },
                reason: { type: 'string' },
              },
            },
          },
          reason: { type: 'string' },
        },
      },
    },
  },
}

const BUCKETS = [
  {
    key: 'maui-underwarned',
    file: 'data/maui.js',
    island: 'Maui',
    brief: [
      'BUCKET: Maui under-warned + facing/grid artifacts. Data file: ' + REPO + '/data/maui.js',
      'Beaches (name | id | flag nature from the stress test):',
      '  - Baby Beach (Pāʻia) | baby_beach_paia | Type A BUT likely lagoon-cell artifact: 54 danger-days/yr came from the grid snapping to the exposed offshore NE point; the actual keiki area is a reef-protected lagoon. Check facing/morph; only warn the open main beach, keep the lagoon framed as the safe zone.',
      '  - Sugar Cove | sugar_cove | Type A genuine: maxExposed 4.5m, NE swell hammers it ~52 danger-days/yr. Likely a real under-warning.',
      '  - Kanahā Beach Park | (find id) | Type B flagged calm (0.7m, domSwell S vs facing 15 inconsistent) = harbor-grid artifact masking real drownings (3+ 2017-2021). Fix facing/bearing AND ensure rip/current messaging exists.',
      '  - Spreckelsville Beach | (find id) | Type B same harbor-grid artifact (0.7m, S vs facing inconsistent) masking a 2017 drowning + shorebreak/rip. Fix facing AND messaging.',
    ].join('\n'),
  },
  {
    key: 'maui-messaging',
    file: 'data/maui.js',
    island: 'Maui',
    brief: [
      'BUCKET: Maui calm-but-fatal messaging + REVIEW items. Data file: ' + REPO + '/data/maui.js',
      'Many of these ALREADY have danger strings — confirm adequacy first; only edit if a specific hazard is missing.',
      '  - Kāʻanapali Beach | kaanapali | Type B: among HI deadliest snorkel areas, Black Rock point currents. (Record already has snorkel danger — verify it is sharp enough.)',
      '  - Kapalua Bay | (find) | Type B: drowning + mass-rescue when SW/W swell wraps in.',
      '  - Nāpili Bay | (find) | Type B: mass rescues + near-drowning medevac in wrapping SW/W swell.',
      '  - D.T. Fleming Beach Park | dt_fleming | Type B: drowning + notorious winter shorebreak; HAS lifeguards — keep guarded but sharpen shorebreak warning.',
      '  - Kamaʻole Beach Park III | (find) | Type B: snorkeling-drowning deaths; calm surf — snorkel messaging.',
      '  - Kamaʻole Beach Park I | (find) | REVIEW: snorkel-hazard messaging glance (adjacent to Kam III deaths).',
      '  - Kamaʻole Beach Park II | (find) | REVIEW: same snorkel-hazard glance.',
      '  - Charley Young Beach | (find) | REVIEW: no lifeguard, contiguous with the Kamaʻole snorkel-death strip — snorkel messaging glance.',
      '  - Kahului Harbor Beaches (Hoʻaloha / Kanahā Pond) | (find) | REVIEW: warning_only=true but maxExposed only 0.7m, 0 danger-days — possibly OVER-cautious + bearing inconsistent. Consider whether the warning is justified or should be softened/clarified.',
      '  - Hāna Bay | (find) | REVIEW: 19 danger-days/yr (just under FLAG); guarded; worth a conditional-surf note.',
    ].join('\n'),
  },
  {
    key: 'oahu-underwarned',
    file: 'data/oahu.js',
    island: 'Oʻahu',
    brief: [
      'BUCKET: Oʻahu Type-A under-warned (the real gaps). Data file: ' + REPO + '/data/oahu.js',
      '  - Haleʻiwa Aliʻi Beach Park | (find) | Type A: kid=true but 44 danger-days/yr + maxExposed 5.3m. Protected south corner is calm but open-coast point gets hammered in winter — add a winter/north-swell conditional warning, likely keep a calm-corner caveat rather than full warning_only.',
      '  - Kalama Beach | (find) | Type A: kid=true but 39 danger-days/yr + adjacent documented drowning. Add conditional warning.',
      '  - Kualoa Regional Park | (find) | Type A: kid=true but 62 danger-days/yr + maxExposed 4.3m — by far the most exposed Windward beach. Family-safe label sharply contradicted; strong candidate for dropping kid:true or warning_only with a "calm only in light trades" caveat.',
    ].join('\n'),
  },
  {
    key: 'oahu-messaging',
    file: 'data/oahu.js',
    island: 'Oʻahu',
    brief: [
      'BUCKET: Oʻahu calm-but-fatal messaging (Type B). Data file: ' + REPO + '/data/oahu.js',
      'Mostly add snorkel/medical/rip/current messaging WITHOUT reclassifying calm guarded beaches.',
      '  - Kailua Beach Park | (find) | Type B: 2025 drowning; guarded famous family beach — add a rip/offshore-wind caveat, keep family framing.',
      '  - Waimānalo Bay Beach Park | (find) | Type B: 2026 drowning death.',
      '  - Bellows Field Beach Park | (find) | Type B: drowning + known rip currents.',
      '  - Waikīkī Beach | (find) | Type B: deaths are medical/in-water incapacitation, not shorebreak — add a "never swim alone / medical-incapacitation offshore" note, do NOT make it scary.',
      '  - Ala Moana Beach Park | (find) | Type B: a 14yo CHILD drowned + adult deaths; hazard is deep dredged channels, not surf. Add channel/drop-off warning; this is the strongest contradiction so be specific.',
      '  - Kaimana Beach (Sans Souci) | (find) | Type B: snorkel/dive incapacitation offshore near the windsock channel.',
      '  - Ko Olina Lagoons | (find) | Type B: fatal still-water/medical drownings in UNGUARDED lagoons — add "lagoons are unguarded, calm water still drowns" messaging.',
      '  - Pōkaʻī Bay Beach Park | (find) | Type B: a CHILD drowning documented in a sheltered bay — add a supervise-children note, surf classification stays.',
    ].join('\n'),
  },
]

phase('Audit')
const results = await pipeline(
  BUCKETS,
  (b) => agent(
    [COMMON, '', b.brief, '',
     'Return the audit for ALL beaches in this bucket as the schema. For beaches whose current record is already adequate, verdict="no-change" with a one-line currentSummary and empty proposedEdits.'
    ].join('\n'),
    { label: 'audit:' + b.key, phase: 'Audit', agentType: 'os-product-trust', schema: AUDIT_SCHEMA, effort: 'high' }
  ).then((audit) => ({ bucket: b, audit })),
  ({ bucket, audit }) => audit
    ? agent(
        [
          'You are an adversarial ocean-safety auditor. Another consultant proposed the edits below to the OceanSafe ' + bucket.island + ' dataset. Your job is to REFUTE, not rubber-stamp.',
          'Read ' + REPO + '/' + bucket.file + ' and ' + REPO + '/STRESS-TEST-4YR.md to check claims against the real record.',
          '',
          'For each beach rule accept / reject / modify:',
          '  - REJECT if the edit over-warns a genuinely calm guarded beach (Type-B should add messaging, NOT set warning_only / strip kid:true), OR if a lg/danger/facing claim is unsupported by a real source, OR if it pads a record that was already adequate.',
          '  - MODIFY (and supply revisedEdits) if the intent is right but the wording over-warns, the facing degrees are wrong, or a citation is weak.',
          '  - ACCEPT only if the edit is correct, sourced, and proportionate.',
          'Independently sanity-check every facing-degree correction against the beach orientation. Flag overWarningRisk and factualIssue booleans honestly.',
          '',
          'Proposed audit JSON:',
          JSON.stringify(audit, null, 2),
        ].join('\n'),
        { label: 'verify:' + bucket.key, phase: 'Verify', agentType: 'general-purpose', schema: VERIFY_SCHEMA, effort: 'high' }
      ).then((verify) => ({ key: bucket.key, island: bucket.island, file: bucket.file, audit, verify }))
    : { key: bucket.key, island: bucket.island, file: bucket.file, audit: null, verify: null }
)

return results.filter(Boolean)
