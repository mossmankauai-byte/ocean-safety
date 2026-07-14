export const meta = {
  name: 'oceansafe-data-finalize',
  description: 'Acts top-up to 26/26 + documented danger channels for Maui & Oahu, read-only research + adversarial verify',
  phases: [
    { title: 'Author', detail: 'read-only research: real acts + documented channels' },
    { title: 'Verify', detail: 'adversarial fact/safety check' },
  ],
}
const REPO = '/Users/nickmossman/Desktop/OceanSafe/maui-build'

const MAUI_BEACH_IDS = 'kaanapali, blackrock_puukekaa, kahekili_airport, kapalua_bay, napili_bay, dt_fleming, honokowai, launiupoko, olowalu, ukumehame, honolua_bay, slaughterhouse_mokuleia, kamaole_i, kamaole_ii, kamaole_iii, charley_young, keawakapu, mokapu_ulua, wailea, polo, maluaka, makena_landing, big_beach_makena, little_beach_puu_olai, kanaha, baldwin, baby_beach_paia, spreckelsville, sugar_cove, tavares, kahului_harbor, hookipa, hana_bay, hamoa, koki, waianapanapa, kaihalulu_red_sand'
const OAHU_BEACH_IDS = 'waimea_bay, ehukai_pipeline, sunset_beach, haleiwa_alii, sharks_cove, laniakea, three_tables, chuns_reef, lanikai, kailua_beach_park, kalama_beach, waimanalo_bay, bellows, kualoa, makapuu, waikiki, ala_moana, kaimana, hanauma_bay, sandy_beach, china_walls, ko_olina_lagoon, pokai_bay, makaha, maili, nanakuli, electric_beach, yokohama_bay'

const MAUI_ACTS = 'Maui Ocean Center | Iao Valley State Monument | Maui Tropical Plantation | Maui Nui Botanical Gardens | Kaanapali Beach (Black Rock) | Napili Bay | Hookipa Beach Park | Maui Pineapple Tour | Surfing Goat Dairy | Alii Kula Lavender | Kula Botanical Garden | Waianapanapa State Park | Garden of Eden Arboretum | Haleakalā National Park (Summit) | Maui Wine at Ulupalakua Ranch | Makawao Town | Bailey House Museum | Wailea Beach Path | Big Beach (Oneloa) Makena | La Perouse Bay | Twin Falls | Keʻanae Arboretum | ʻŌheo Gulch Kīpahulu | Pāʻia Town'
const OAHU_ACTS = 'Diamond Head | Hanauma Bay | Lanikai Beach | Kailua Beach Park | Byodo-In Temple | Waimea Valley | Laniakea Beach | Haleʻiwa Town | Polynesian Cultural Center | Pearl Harbor | Honolulu Zoo | Ko Olina Lagoons | Bishop Museum | ʻIolani Palace | Foster Botanical Garden | Honolulu Museum of Art | Waikīkī Aquarium | Nuʻuanu Pali Lookout | Makapuʻu Point Lighthouse Trail | Lanikai Pillbox | Kualoa Ranch | Hoʻomaluhia Botanical Garden | Dole Plantation | Kaʻena Point | Tantalus Lookout'

const ACTS_ENTRY = { type:'object', required:['id','name','n','r','lat','lon','type','price','hours','duration_min','tip','tags'],
  properties:{ id:{type:'string'},name:{type:'string'},n:{type:'string'},r:{type:'string'},lat:{type:'number'},lon:{type:'number'},type:{type:'string'},price:{type:'string'},hours:{type:'string'},duration_min:{type:'number'},tip:{type:'string'},tags:{type:'array',items:{type:'string'}} } }
const CHANNEL_ENTRY = { type:'object', required:['id','name','beach_id','lat','lon','dir_deg','severity','type','desc','rule','tidal_amplify'],
  properties:{ id:{type:'string'},name:{type:'string'},beach_id:{type:'string',description:'MUST be one of the provided beach ids'},lat:{type:'number'},lon:{type:'number'},dir_deg:{type:'number',description:'compass bearing the channel/current flows toward, 0-360'},severity:{type:'number',description:'0.0-1.0; 1.0 = killer'},type:{type:'string',description:'reef_exit | rip | river_mouth | surge | point_current | shorebreak_rip'},desc:{type:'string'},rule:{type:'string',description:'one-line what-to-do'},tidal_amplify:{type:'boolean'} } }
const authSchema = (e)=>({type:'object',required:['entries'],properties:{entries:{type:'array',items:e}}})
const VERIFY = { type:'object', required:['rulings'], properties:{ rulings:{type:'array',items:{ type:'object', required:['id','name','ruling','real','issues'],
  properties:{ id:{type:'string'},name:{type:'string'},ruling:{type:'string',enum:['accept','reject','fix']},real:{type:'boolean'},beachIdValid:{type:'boolean'},duplicate:{type:'boolean'},issues:{type:'array',items:{type:'string'}},fixedEntry:{type:'object',additionalProperties:true} } } } } }

const STREAMS = [
  { key:'maui-acts-topup', file:'data/maui.js', cat:'acts', entry:ACTS_ENTRY, n:2, kind:'acts',
    regions:'West Maui | South Maui | Central Maui | North Shore | East/Hāna',
    brief:'Add 2 MORE real, currently-open Maui activities to reach Kauaʻi parity. Prefer WEST MAUI (Kāʻanapali/Kapalua area — e.g. Whalers Village, Kapalua/Honolua area sights) since West Maui is thin. AVOID anything in the 2023-fire-damaged Lahaina core unless you can confirm it is OPEN in 2026. Do not duplicate existing acts: '+MAUI_ACTS },
  { key:'oahu-acts-topup', file:'data/oahu.js', cat:'acts', entry:ACTS_ENTRY, n:1, kind:'acts',
    regions:'North Shore | Windward | South Shore | Leeward | Honolulu',
    brief:'Add 1 MORE real, currently-open Oʻahu activity to reach Kauaʻi parity, in a thin region (North Shore or Leeward/Central). Do not duplicate existing acts: '+OAHU_ACTS },
  { key:'maui-channels', file:'data/maui.js', cat:'channels', entry:CHANNEL_ENTRY, n:6, kind:'channels',
    beachIds:MAUI_BEACH_IDS,
    brief:'Document ~6 of Maui\'s most-documented dangerous ocean CHANNELS / rips / reef-exits / point-currents, each tied to one of the beach ids below. Real, well-attested hazards only (e.g. Honolua Bay outflow, Kāʻanapali/Black Rock point current, Hoʻokipa rip, Baldwin/Kanahā currents, Big Beach shorebreak-rip, Slaughterhouse winter rip). Cite the hazard source in desc reasoning.' },
  { key:'oahu-channels', file:'data/oahu.js', cat:'channels', entry:CHANNEL_ENTRY, n:6, kind:'channels',
    beachIds:OAHU_BEACH_IDS,
    brief:'Document ~6 of Oʻahu\'s most-documented dangerous ocean CHANNELS / rips / reef-exits / river-mouths, each tied to one of the beach ids below. Real, well-attested hazards only (e.g. Hanauma "Witches Brew"/Toilet Bowl, Sandy Beach rip, Waimea shorebreak/river mouth, Lanikai→Mokulua wrap current, Ehukai/Pipeline rip, Sharks Cove surge). Cite the hazard source in desc reasoning.' },
]

const CHAN_RULES = [
  'Channel schema fields: id (snake_case), name, beach_id (MUST exactly match one provided id), lat, lon (the channel mouth, on the correct island), dir_deg (bearing the current flows TOWARD, 0-360), severity (0.0-1.0, 1.0=killer), type (reef_exit|rip|river_mouth|surge|point_current|shorebreak_rip), desc (2-3 sentences: where it is, when it activates — tide/swell), rule (one short imperative what-to-do), tidal_amplify (true if falling/low tide worsens it).',
  'severity calibration: 0.5 moderate, 0.7 strong/documented rescues, 0.85+ documented fatalities. Be honest; do not inflate.',
  'Only document REAL, attested hazards (county Ocean Safety, news rescues/drownings, surf/dive references). If you cannot attest it, omit it. Better 4 solid than 6 padded.',
].join('\n')

phase('Author')
const results = await pipeline(STREAMS,
  (s) => agent(
    [
      'You are extending the OceanSafe dataset. READ-ONLY: research and RETURN data; do NOT edit any file.',
      'First read ' + REPO + '/' + s.file + ' to match the exact record shape and tag/region conventions.',
      '',
      s.kind==='channels'
        ? ('TASK: ' + s.brief + '\nValid beach ids (beach_id MUST be one of these): ' + s.beachIds + '\n\n' + CHAN_RULES)
        : ('TASK: ' + s.brief + '\nAllowed region labels: ' + s.regions + '\nEvery entry: real & open in 2026, exact schema, lat/lon on-island, append " [verify coords]" in tip, reuse existing tag vocabulary, id in snake_case.'),
      '',
      'Return exactly ' + s.n + ' entries (or fewer if you cannot attest that many) as the schema.',
    ].join('\n'),
    { label:'author:'+s.key, phase:'Author', agentType:'Explore', schema:authSchema(s.entry), effort:(s.kind==='channels'?'high':'medium') }
  ).then(a=>({s,a})),
  ({s,a}) => a
    ? agent(
        [
          'You are an adversarial '+(s.kind==='channels'?'ocean-safety':'fact')+' auditor for OceanSafe '+s.key+'. REFUTE the proposed entries below; do NOT edit files, just rule.',
          'Read ' + REPO + '/' + s.file + ' to check against the real dataset.',
          s.kind==='channels'
            ? ('For each channel: real=false/reject if the hazard is not a documented real feature; set beachIdValid=false/fix if beach_id is not in this list: '+s.beachIds+'; fix (supply fixedEntry) if severity is inflated, dir_deg/type wrong, coords off-island, or beach_id invalid; accept only if real, correctly tied, sanely severitied. Reject anything fabricated.')
            : ('For each act: reject if not real/open in 2026 or duplicates existing acts ('+(s.file.includes('maui')?MAUI_ACTS:OAHU_ACTS)+'); fix (supply fixedEntry) if region/coords wrong; accept only if real, open, non-duplicate, schema-complete.'),
          '',
          'Proposed JSON:', JSON.stringify(a,null,2),
        ].join('\n'),
        { label:'verify:'+s.key, phase:'Verify', agentType:'Explore', schema:VERIFY, effort:(s.kind==='channels'?'high':'medium') }
      ).then(v=>({key:s.key,file:s.file,cat:s.cat,kind:s.kind,author:a,verify:v}))
    : {key:s.key,file:s.file,cat:s.cat,kind:s.kind,author:null,verify:null}
)
return results.filter(Boolean)
