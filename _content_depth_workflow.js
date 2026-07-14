export const meta = {
  name: 'oceansafe-content-depth',
  description: 'Fill the real content gaps (Maui+Oahu activities, Maui eats) to Kauai parity with real, verified places',
  phases: [
    { title: 'Author', detail: 'research real, currently-operating places in the exact schema' },
    { title: 'Verify', detail: 'adversarially confirm real/operating, non-duplicate, schema-complete' },
  ],
}

const REPO = '/Users/nickmossman/Desktop/OceanSafe/maui-build'

const COMMON = [
  'You are extending the OceanSafe app dataset with REAL local places a visitor would actually use. Every entry must be a real, currently-operating business or attraction — NO invented, closed, or "probably exists" places. If you are not confident a place is real and open in 2026, do not include it.',
  '',
  'Hard rules:',
  '  - Return entries in the EXACT schema given below. Match field names and value styles to the examples.',
  '  - Do NOT duplicate any name in the EXCLUSION LIST. Same place under a slightly different name is still a duplicate.',
  '  - Use ONLY the region labels listed (the app filters by them — a novel label breaks filtering).',
  '  - Distribute new entries across regions to fill the THIN ones noted, not all in one place.',
  '  - lat/lon: give the best approximate coordinates you can and append " [verify coords]" inside the tip (the human reviewer confirms). Coordinates must be on the correct island.',
  '  - tags: reuse the tag vocabulary visible in existing entries (e.g. acts: indoor, wildlife, rain_ok, ada, stroller, restrooms, toddler, little_kid, school_age, teen, parking_easy, hike, scenic, cultural, free; foods: seafood, local_grindz, fine_dining, casual, oceanfront, breakfast, vegetarian, reservations_required, food_truck, plate_lunch). Do not invent new tag keys.',
  '  - tip: 1-3 sentences, concrete and useful; include a rating signal if you know it (e.g. "Yelp ~4.5") and end with [verify coords]. Honest, no marketing fluff.',
  '  - id: lowercase_snake_case, unique, derived from the name.',
  '  - "n" = a short display nickname.',
  'Read ' + REPO + '/{file} first to see the exact existing record shape and tag usage before writing.',
].join('\n')

const ACTS_ENTRY = {
  type: 'object',
  required: ['id','name','n','r','lat','lon','type','price','hours','duration_min','tip','tags'],
  properties: {
    id:{type:'string'}, name:{type:'string'}, n:{type:'string'}, r:{type:'string'},
    lat:{type:'number'}, lon:{type:'number'}, type:{type:'string', description:'e.g. wildlife, garden, cultural, hike, scenic, tour, museum, farm'},
    price:{type:'string', description:'e.g. "Free", "$25 adults", "$$"'},
    hours:{type:'string'}, duration_min:{type:'number'}, tip:{type:'string'},
    tags:{type:'array', items:{type:'string'}},
  },
}
const FOODS_ENTRY = {
  type: 'object',
  required: ['id','name','n','r','lat','lon','type','price','hours','tip','tags'],
  properties: {
    id:{type:'string'}, name:{type:'string'}, n:{type:'string'}, r:{type:'string'},
    lat:{type:'number'}, lon:{type:'number'}, type:{type:'string', description:'e.g. "local plate lunch", "fine seafood", "cafe", "food truck", "shave ice"'},
    price:{type:'string', description:'$ to $$$$'}, hours:{type:'string'}, tip:{type:'string'},
    tags:{type:'array', items:{type:'string'}},
    phone:{type:'string'}, website:{type:'string'}, reservations:{type:'boolean'},
  },
}
const authSchema = (entry)=>({ type:'object', required:['entries'], properties:{ entries:{type:'array', items:entry} } })
const VERIFY_SCHEMA = {
  type:'object', required:['rulings'],
  properties:{ rulings:{ type:'array', items:{
    type:'object', required:['id','name','ruling','real','duplicate','issues'],
    properties:{
      id:{type:'string'}, name:{type:'string'},
      ruling:{type:'string', enum:['accept','reject','fix']},
      real:{type:'boolean', description:'is this a real, currently-operating place'},
      duplicate:{type:'boolean'},
      issues:{type:'array', items:{type:'string'}},
      fixedEntry:{type:'object', description:'only if ruling=fix: the corrected full record to apply instead', additionalProperties:true},
    },
  } } },
}

const STREAMS = [
  {
    key:'maui-acts', file:'data/maui.js', cat:'acts', entry:ACTS_ENTRY, target:13,
    regions:'West Maui | South Maui | Central Maui | North Shore | East/Hāna | Upcountry (use "Upcountry" only if it already appears in the file; otherwise map Kula/Makawao to "Central Maui")',
    thin:'Thin coverage: Upcountry/Kula-Makawao, West Maui (Lahaina town sights), South Maui (Wailea/Makena), Central (Wailuku/Kahului). North Shore is already well covered — add few there.',
    exclude:'Maui Ocean Center | Iao Valley State Monument | Maui Tropical Plantation | Maui Nui Botanical Gardens | Kaanapali Beach (Black Rock) | Napili Bay | Hookipa Beach Park | Maui Pineapple Tour | Surfing Goat Dairy | Alii Kula Lavender | Kula Botanical Garden | Waianapanapa State Park | Garden of Eden Arboretum',
    hint:'Real candidates to consider (verify each is open in 2026): Haleakalā National Park summit/sunrise, Lahaina Banyan Tree & Front St (note post-2023-fire status honestly), Maui Lavender? no, Makawao town, Hāliʻimaile, Maui Wine (Ulupalakua), Twin Falls (Road to Hāna), Keʻanae Peninsula/Arboretum, Big Beach Makena, Wailea Coastal Walk, ʻŌheo Gulch (Kīpahulu), Bailey House Museum (Wailuku), Lahaina Jodo Mission, Maui Brewing tour, La Perouse Bay, Molokini snorkel cruise (could be a tour). Distribute and verify.',
  },
  {
    key:'oahu-acts', file:'data/oahu.js', cat:'acts', entry:ACTS_ENTRY, target:14,
    regions:'North Shore | Windward | South Shore | Leeward | Honolulu',
    thin:'Thin coverage everywhere except a few flagships. Add across: Honolulu (museums, palace, gardens, lookouts), Windward (ranch, pali, gardens, pillbox), North Shore (plantation, beaches, towns), Leeward/Central (Kaʻena, Wahiawā).',
    exclude:'Diamond Head State Monument | Hanauma Bay Nature Preserve | Lanikai Beach | Kailua Beach Park | Byodo-In Temple | Waimea Valley | Laniakea Beach (Turtle Beach) | Haleʻiwa Town | Polynesian Cultural Center | Pearl Harbor National Memorial | Honolulu Zoo | Ko Olina Lagoons',
    hint:'Real candidates (verify open 2026): Bishop Museum, ʻIolani Palace, Foster Botanical Garden, Honolulu Museum of Art, Nuʻuanu Pali Lookout, Lyon Arboretum / Mānoa Falls, Makapuʻu Lighthouse Trail, Lanikai Pillbox (Kaʻiwa Ridge), Kualoa Ranch, Hoʻomaluhia Botanical Garden, Dole Plantation, Kaʻena Point, Waimea Bay, Kapiʻolani Park / Waikīkī Aquarium, USS Missouri, Tantalus/Puʻu ʻUalakaʻa lookout. Distribute and verify.',
  },
  {
    key:'maui-foods', file:'data/maui.js', cat:'foods', entry:FOODS_ENTRY, target:8,
    regions:'West Maui | South Maui | Central Maui | North Shore | East/Hāna',
    thin:'Add across regions, especially Central Maui (Kahului/Wailuku local spots) and West Maui (Lahaina/Kāʻanapali), which are under-represented. Mix price points — include casual local plate-lunch/food spots, not only upscale.',
    exclude:"Mama's Fish House | Paia Fish Market | Tin Roof Maui | Star Noodle | Leoda's Kitchen and Pie Shop | Honu Oceanside | Kihei Caffe | Monkeypod Kitchen by Merriman | Coconut's Fish Cafe | Hāna Farms Roadside Stand & Pizza Oven",
    hint:'Real candidates (verify open 2026): Tasty Crust (Wailuku), Sam Sato\'s (Wailuku saimin), Tin Roof is excluded, Sixtwelve? , Da Kitchen (status?), Geste Shrimp Truck (Kahului), Maui Fresh Streatery, Three\'s Bar & Grill (Kīhei), 808 Deli, Ono Tacos, Aloha Mixed Plate (Lahaina), Ululani\'s Hawaiian Shave Ice, Farmacy Health Bar (Kahului), Fork & Salad, Nuka (Haʻikū), Paia Bay Coffee. Verify each is open and not a duplicate.',
  },
]

phase('Author')
const results = await pipeline(
  STREAMS,
  (s) => agent(
    [
      COMMON.replace('{file}', s.file),
      '',
      'STREAM: ' + s.key + ' — add ~' + s.target + ' NEW "' + s.cat + '" entries to ' + REPO + '/' + s.file,
      'Allowed region labels: ' + s.regions,
      s.thin,
      '',
      'EXCLUSION LIST (already in the dataset — do NOT re-add): ' + s.exclude,
      '',
      s.hint,
      '',
      'Return exactly the schema. Aim for ' + s.target + ' high-quality, real, verified, non-duplicate entries distributed across the thin regions.',
    ].join('\n'),
    { label:'author:'+s.key, phase:'Author', agentType:(s.cat==='foods'?'os-marketplace-strategist':'general-purpose'), schema:authSchema(s.entry), effort:'medium' }
  ).then(a=>({ stream:s, author:a })),
  ({stream,author}) => author
    ? agent(
        [
          'You are an adversarial fact-checker for the OceanSafe ' + stream.key + ' additions. Another consultant proposed the entries below for ' + REPO + '/' + stream.file + ' (category "' + stream.cat + '"). REFUTE, do not rubber-stamp.',
          'For EACH proposed entry, web-verify and rule:',
          '  - real=false / ruling=reject if the place does not exist, is permanently closed, or you cannot confirm it operates in 2026.',
          '  - duplicate=true / ruling=reject if it duplicates the EXCLUSION LIST or another proposed entry. EXCLUSION LIST: ' + stream.exclude,
          '  - ruling=fix (supply fixedEntry, the FULL corrected record) if it is real but has a wrong region label (allowed: ' + stream.regions + '), bad/off-island coordinates, a missing required field, or an invented tag key.',
          '  - ruling=accept only if real, open, non-duplicate, correctly regioned, schema-complete.',
          'Coordinates must be on the correct island; spot-check a few against the place\'s real location.',
          '',
          'Proposed entries JSON:',
          JSON.stringify(author, null, 2),
        ].join('\n'),
        { label:'verify:'+stream.key, phase:'Verify', agentType:'general-purpose', schema:VERIFY_SCHEMA, effort:'medium' }
      ).then(v=>({ key:stream.key, file:stream.file, cat:stream.cat, target:stream.target, author, verify:v }))
    : { key:stream.key, file:stream.file, cat:stream.cat, target:stream.target, author:null, verify:null }
)

return results.filter(Boolean)
