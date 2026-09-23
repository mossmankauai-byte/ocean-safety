#!/usr/bin/env python3
"""Heiau and wahi pana pins for the Culture layer (2026-09-23).

One source of truth: SITES below. Running this writes the entries into the four island ACTS arrays
(index.html for Kauaʻi, data/<island>.js for the rest) and adds a `heiau` attribute object to the three
entries that already existed. Idempotent: entries it wrote before are replaced, never duplicated.

Every fact carries its source. `pin` says where the coordinate came from; `src` is the official page.
The list is the State's own: Hawaiʻi State Parks brochure "Nā Wahi Pana" (SITES TO VISIT), plus six
public sites Nick added (state_list False).
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BROCHURE = 'https://dlnr.hawaii.gov/dsp/files/2022/12/Wahi-Pana-brochure-1.pdf'

WAILUA_HOURS = 'Daily 7:00am to 7:45pm'
WAILUA_ENTRY = 'Free for Hawaiʻi residents. Visitors pay an entry fee and a parking fee'
WAILUA_SRC = 'https://dlnr.hawaii.gov/dsp/parks/kauai/wailua-river-state-park/'

SITES = {
 'kauai': [
  dict(id='heiau_hikinaakala', name='Hikinaakalā Heiau', r='East Side', lat=22.04291, lon=-159.3356,
       kind='Heiau and place of refuge', steward='Hawaiʻi State Parks (Wailua River State Park)',
       access='Next to Lydgate Park, at the mouth of the Wailua River',
       entry=WAILUA_ENTRY, hours=WAILUA_HOURS, booking='', state_list=True, src=WAILUA_SRC,
       pin='OpenStreetMap', dur=30,
       tip='Part of the Wailua Complex of Heiau, a National Historic Landmark. The same site holds Hauola, a place of refuge, and petroglyphs at the river mouth.',
       tags=['cultural','parking_easy','restrooms','school_age','teen']),
  dict(id='heiau_holoholoku', name='Holoholokū Heiau', aka='Kalaeokamanu', r='East Side', lat=22.04901, lon=-159.33959,
       kind='Heiau and royal birth site', steward='Hawaiʻi State Parks (Wailua River State Park)',
       access='Roadside on the south side of Kuamoʻo Road (Route 580), just past the old Coco Palms',
       entry=WAILUA_ENTRY, hours=WAILUA_HOURS, booking='', state_list=True, src=WAILUA_SRC,
       pin='National Register nomination (UTM, shifted to WGS84)', dur=20,
       tip='Also known as Kalaeokamanu. The birthing stone and the navel stone sit about 65 feet inland from the heiau.',
       tags=['cultural','parking_easy','school_age','teen']),
  dict(id='heiau_poliahu', name='Poliʻahu Heiau', r='East Side', lat=22.04627, lon=-159.35585,
       kind='Heiau', steward='Hawaiʻi State Parks (Wailua River State Park)',
       access='Off Kuamoʻo Road, on the bluff above the Wailua River, before the ʻŌpaekaʻa Falls lookout',
       entry=WAILUA_ENTRY, hours=WAILUA_HOURS, booking='', state_list=True, src=WAILUA_SRC,
       pin='National Register nomination (UTM, shifted to WGS84)', dur=20,
       tip='A large heiau of more than an acre on the north bank of the Wailua River, part of the Wailua Complex of Heiau.',
       tags=['cultural','parking_easy','school_age','teen']),
  dict(id='heiau_kauluapaoa', name='Kauluapāʻoa Heiau', r='North Shore', lat=22.2221, lon=-159.5827,
       kind='Heiau', steward='Hawaiʻi State Parks (Hāʻena State Park)',
       access='Near Keʻe Beach, inside Hāʻena State Park',
       entry='Free for Hawaiʻi residents. Visitors pay entry and parking fees when they book',
       hours='Daily 7:00am to 7:45pm (winter to 6:45pm)',
       booking='Visitors need an entry and parking reservation at gohaena.com, up to 30 days ahead',
       state_list=True, src='https://dlnr.hawaii.gov/dsp/parks/kauai/haena-state-park/',
       pin='Access point: Keʻe Beach', dur=30,
       tip='At the end of the road on the north shore. Book the park before you drive; there is no walk-up entry for visitors.',
       tags=['cultural','reservations','restrooms','school_age','teen']),
  dict(id='heiau_kaneiolouma', name='Kāneiolouma', r='South Shore', lat=21.8754, lon=-159.45285,
       kind='Village and heiau complex', steward='Hui Mālama O Kāneiolouma, on County of Kauaʻi land',
       access='Across the street from Poʻipū Beach Park; park at the beach park and walk over',
       entry='Free', hours='Daylight hours', booking='', state_list=False,
       src='https://en.wikipedia.org/wiki/K%C4%81neiolouma_Complex', pin='OpenStreetMap', dur=30,
       tip='A 13-acre village site from the 1400s with house sites, fishponds, loʻi, and a Makahiki sporting ground. Four carved kiʻi face the cardinal directions.',
       tags=['cultural','free','parking_easy','little_kid','school_age','teen']),
 ],
 'oahu': [
  dict(id='heiau_puuomahuka', name='Puʻu o Mahuka Heiau', r='North Shore', lat=21.64147, lon=-158.05916,
       kind='Heiau', steward='Hawaiʻi State Parks', access='Drive-up site on the bluff above Waimea Bay',
       entry='Free', hours='Daily 9:00am to 5:30pm', booking='', state_list=True,
       src='https://dlnr.hawaii.gov/dsp/parks/oahu/puu-o-mahuka-heiau-state-historic-site/', pin='OpenStreetMap', dur=30,
       tip='The largest heiau on Oʻahu, almost two acres, on the bluff above Waimea Bay. State Parks asks visitors to look from outside the walls.',
       tags=['cultural','free','parking_easy','scenic','school_age','teen']),
  dict(id='heiau_ulupo', name='Ulupō Heiau', r='Windward', lat=21.38559, lon=-157.75306,
       kind='Heiau', steward='Hawaiʻi State Parks',
       access='Next to the Windward YMCA, 1200 Kailua Road. When the gate is shut, park at the YMCA and walk in',
       entry='Free', hours='Mon to Fri 7:00am to 7:00pm. Gate open Mon to Fri 8:00am to noon, Sat 8:00am to 3:00pm',
       booking='', state_list=True, src='https://dlnr.hawaii.gov/dsp/parks/oahu/ulupo-heiau-state-historic-site/',
       pin='OpenStreetMap', dur=20,
       tip='A large stone platform above Kawainui Marsh. Volunteers restore the grounds on community Saturdays.',
       tags=['cultural','free','parking_easy','school_age','teen']),
  dict(id='heiau_keaiwa', name='Keaīwa Heiau', r='Leeward', lat=21.40222, lon=-157.89972,
       kind='Healing heiau', steward='Hawaiʻi State Parks (Keaīwa Heiau State Recreation Area)',
       access='Inside Keaīwa Heiau State Recreation Area, ʻAiea Heights',
       entry='Free', hours='Daily 7:00am to 7:45pm (winter to 6:45pm)', booking='', state_list=True,
       src='https://dlnr.hawaii.gov/dsp/parks/oahu/keaiwa-heiau-state-recreation-area/', pin='Wikipedia', dur=30,
       tip='A heiau hoʻōla, a place for healing and for training in medicine. The park has pavilions, restrooms, and the ʻAiea Loop Trail.',
       tags=['cultural','free','restrooms','parking_easy','shaded','school_age','teen']),
  dict(id='heiau_kuilioloa', name='Kūʻīlioloa Heiau', r='Leeward', lat=21.44038, lon=-158.19149,
       kind='Heiau', steward='City and County of Honolulu (Pōkaʻī Bay Beach Park)',
       access='Short walk out onto Kāneʻilio Point from the Pōkaʻī Bay Beach Park lot',
       entry='Free', hours='Beach park hours', booking='', state_list=True,
       src=BROCHURE, pin='OpenStreetMap', dur=20,
       tip='A three-tiered stone heiau on Kāneʻilio Point at Pōkaʻī Bay. It was a place of learning for fishing and navigation.',
       tags=['cultural','free','parking_easy','restrooms','little_kid','school_age','teen']),
  dict(id='heiau_kukaniloko', name='Kūkaniloko Birthstones', r='North Shore', lat=21.50465, lon=-158.03627,
       kind='Royal birth site', steward='Hawaiʻi State Parks, cared for by the Hawaiian Civic Club of Wahiawā',
       access='At Kamehameha Highway and Whitmore Avenue, Wahiawā. The stones are visible from the road',
       entry='Free', hours='Escorted visits Mon, Tue and Fri, 9:00am to 10:00am',
       booking='Closed to the public. Escorted visits only, by reservation through kukaniloko.org',
       state_list=True, src='https://www.kukaniloko.org/', pin='OpenStreetMap', dur=60,
       tip='The piko, the center, of Oʻahu, and the most powerful birth site for the island\'s high chiefs. Visit with the civic club that cares for it.',
       tags=['cultural','free','reservations','school_age','teen']),
  dict(id='heiau_haleolono', name='Hale o Lono Heiau', r='North Shore', lat=21.63389, lon=-158.05167,
       kind='Heiau', steward='Waimea Valley',
       access='Inside Waimea Valley, with paid valley entry',
       entry='Included in paid Waimea Valley admission', hours='9am to 5pm daily (check waimeavalley.net)',
       booking='', state_list=True, src='https://www.waimeavalley.net/cultural-sites',
       pin='Access point: Waimea Valley', dur=20,
       tip='A heiau dedicated to Lono, the god of agriculture, rain, and peace. Seen as part of a Waimea Valley visit.',
       tags=['cultural','restrooms','stroller','school_age','teen']),
 ],
 'maui': [
  dict(id='heiau_halekii', name='Halekiʻi-Pihana Heiau', r='Central Maui', lat=20.90489, lon=-156.49161,
       kind='Two heiau', steward='Hawaiʻi State Parks', access='Drive-up site above Wailuku',
       entry='Free', hours='Daily during daylight hours', booking='', state_list=True,
       src='https://dlnr.hawaii.gov/dsp/parks/maui/halekii-pihana-heiau-state-monument/', pin='OpenStreetMap', dur=30,
       tip='The royal court of Kahekili, the last ruling chief of Maui, and the birthplace of Keōpūolani. Wide views of central Maui.',
       tags=['cultural','free','parking_easy','scenic','school_age','teen']),
  dict(id='heiau_ohala', name='Ohala Heiau', r='East/Hāna', lat=20.78263, lon=-155.99529,
       kind='Heiau', steward='Hawaiʻi State Parks (Waiʻānapanapa State Park)',
       access='Inside Waiʻānapanapa State Park',
       entry='Free for Hawaiʻi residents. Visitors pay entry and parking fees when they book',
       hours='Daily 7:00am to 6:00pm', booking='Visitors need a reservation at gostateparks.hawaii.gov/waianapanapa',
       state_list=True, src='https://dlnr.hawaii.gov/dsp/parks/maui/waianapanapa-state-park/', pin='OpenStreetMap', dur=30,
       tip='A heiau on the black lava coast of Waiʻānapanapa. Book the park before the drive to Hāna.',
       tags=['cultural','reservations','restrooms','school_age','teen']),
  dict(id='heiau_piilanihale', name='Piʻilanihale Heiau', r='East/Hāna', lat=20.80385, lon=-156.03973,
       kind='Heiau', steward='National Tropical Botanical Garden (Kahanu Garden)',
       access='Inside Kahanu Garden, near Hāna',
       entry='Paid garden admission. Free for 12 and under and Hāna residents', hours='Mon to Fri 9am to 3pm, last entry 2pm. Closed weekends',
       booking='Online reservations encouraged; guided tours Fridays 9:30am by reservation',
       state_list=True, src='https://ntbg.org/gardens/kahanu/', pin='OpenStreetMap', dur=90,
       tip='A massive stone platform heiau inside Kahanu Garden, on the road to Hāna.',
       tags=['cultural','garden','reservations','restrooms','school_age','teen']),
 ],
 'hawaii': [
  dict(id='heiau_mailekini', name='Mailekini Heiau', r='Kohala', lat=20.02796, lon=-155.82236,
       kind='Heiau', steward='National Park Service (Puʻukoholā Heiau National Historic Site)',
       access='On the Puʻukoholā path from the visitor center',
       entry='Free', hours='Daily 8:30am to 4:30pm', booking='', state_list=False,
       src='https://www.nps.gov/puhe/', pin='OpenStreetMap', dur=20,
       tip='The heiau beside Puʻukoholā. The path from the visitor center to the base of both heiau is wheelchair accessible.',
       tags=['cultural','free','ada','restrooms','parking_easy','school_age','teen']),
  dict(id='heiau_mookini', name='Moʻokini Heiau', r='Kohala', lat=20.25765, lon=-155.87703,
       kind='Heiau and royal birth site', steward='Hawaiʻi State Parks (Kohala Historical Sites State Monument)',
       access='Rough dirt road past ʻUpolu Airport (4WD), or park at the end of paved Old Coast Guard Road and walk about a mile along the coast',
       entry='Free', hours='Daily during daylight hours', booking='', state_list=True,
       src='https://dlnr.hawaii.gov/dsp/parks/hawaii/kohala-historical-sites-state-monument/', pin='OpenStreetMap', dur=90,
       tip='A luakini heiau on the windswept north tip of the island, next to the birthplace of Kamehameha I.',
       tags=['cultural','free','scenic','teen']),
  dict(id='heiau_kuemanu', name='Kuʻemanu Heiau', r='Kona', lat=19.58152, lon=-155.96715,
       kind='Surfing heiau', steward='Hawaiʻi County (Kahaluʻu Beach Park)',
       access='On the north side of Kahaluʻu Bay, beside Aliʻi Drive at the beach park',
       entry='Free', hours='Beach park hours', booking='', state_list=True,
       src=BROCHURE, pin='OpenStreetMap', dur=15,
       tip='A heiau tied to surfing and wave watching, overlooking a surf break still ridden today. Stay off the walls and platform.',
       tags=['cultural','free','restrooms','parking_easy','little_kid','school_age','teen']),
  dict(id='heiau_hapaialii', name='Hāpaialiʻi and Keʻekū Heiau', r='Kona', lat=19.57972, lon=-155.97111,
       kind='Two heiau', steward='Kamehameha Schools',
       access='On the shoreline just south of Kahaluʻu Beach Park; seen from the shoreline path',
       entry='Free', hours='Daylight hours', booking='', state_list=True,
       src='https://historichawaii.org/historic-property-hi/keauhou-sacred-sites/', pin='USGS GNIS (Hāpaialiʻi)', dur=20,
       tip='Two stone platforms restored in 2007. Hāpaialiʻi was built in the 1400s and works as a solar calendar; Keʻekū sits beside it.',
       tags=['cultural','free','school_age','teen']),
  dict(id='heiau_hikiau', name='Hikiau Heiau', r='Kona', lat=19.47556, lon=-155.91936,
       kind='Heiau', steward='Hawaiʻi State Parks (Kealakekua Bay State Historical Park)',
       access='On the shore at Nāpōʻopoʻo',
       entry='Free', hours='Daily 7:00am to 8:00pm', booking='', state_list=True,
       src='https://dlnr.hawaii.gov/dsp/parks/hawaii/kealakekua-bay-state-historical-park/', pin='OpenStreetMap', dur=20,
       tip='A large heiau on the shore of Kealakekua Bay. State Parks asks visitors not to go onto it; it remains a sacred site.',
       tags=['cultural','free','restrooms','parking_easy','school_age','teen']),
  dict(id='heiau_ahuena', name='Ahuʻena Heiau', r='Kona', lat=19.63889, lon=-155.99738,
       kind='Heiau', steward='Ahuʻena Heiau stewards (ahuena-heiau.org)',
       access='At Kamakahonu in Kailua-Kona; seen from the beach',
       entry='Free', hours='Daylight hours', booking='', state_list=False,
       src='https://www.ahuena-heiau.org/', pin='OpenStreetMap', dur=15,
       tip='Built by Kamehameha I in 1812 and 1813 to honor Lono. Kamehameha spent his last years here, at Kamakahonu.',
       tags=['cultural','free','little_kid','school_age','teen']),
  dict(id='heiau_puuoina', name='Puʻuoina Heiau', r='Kona', lat=19.67067, lon=-156.02725,
       kind='Heiau', steward='National Park Service (Kaloko-Honokōhau National Historical Park)',
       access='Honokōhau Beach. Walk in from the park visitor center lot, or from the Honokōhau Harbor side',
       entry='Free', hours='Park lot 8:30am to 4:00pm. After 4pm, walk in from Honokōhau Harbor',
       booking='', state_list=False, src='https://www.nps.gov/kaho/', pin='OpenStreetMap', dur=30,
       tip='A stone platform heiau on the south shore of Honokōhau Bay, by the ʻAiʻōpio fishtrap where green sea turtles bask.',
       tags=['cultural','free','school_age','teen']),
 ],
}

# Entries that already existed: they get the attribute card, their own fields stay.
EXISTING = {
 'kauai': {'wailua_heiau': dict(kind='Heiau complex', steward='Hawaiʻi State Parks (Wailua River State Park)',
    access='Roadside stops from the Wailua River mouth up Kuamoʻo Road', entry=WAILUA_ENTRY, hours=WAILUA_HOURS,
    booking='', state_list=True, src=WAILUA_SRC, pin='Wailua River mouth')},
 'hawaii': {
   'hi_puukohola_heiau': dict(kind='Heiau', steward='National Park Service', access='Paved path from the visitor center; wheelchair path to the base of the heiau',
     entry='Free', hours='Daily 8:30am to 4:30pm', booking='', state_list=True, src='https://www.nps.gov/puhe/', pin='App data'),
   'hi_puuhonua_honaunau': dict(kind='Place of refuge and Hale o Keawe', steward='National Park Service',
     access='Flat self-guided loop from the visitor center to Hale o Keawe', entry='National park entrance fee, per vehicle',
     hours='Daily 8:15am until sunset', booking='', state_list=True, src='https://www.nps.gov/puho/', pin='App data'),
 },
}

ATTR_KEYS = ('kind','steward','access','entry','hours','booking','state_list','src','pin','aka')

def act(s):
    h = {k: s[k] for k in ATTR_KEYS if k in s}
    short = s['name'].replace(' Heiau', '') if len(s['name']) > 18 else s['name']
    return {'id': s['id'], 'name': s['name'], 'n': short, 'r': s['r'], 'lat': s['lat'], 'lon': s['lon'],
            'type': 'cultural', 'price': s['entry'].split('.')[0], 'hours': s['hours'], 'duration_min': s['dur'],
            'tip': s['tip'], 'tags': s['tags'], 'website': s['src'], 'heiau': h}

def lint(txt, where):
    bad = [c for c in (chr(0x2014), chr(0x2013)) if c in txt]
    if bad: sys.exit('dash in ' + where)

def patch_json_file(path, island):
    src = path.read_text()
    m = re.search(r'(acts:\s*)(\[.*?\])(\s*,\s*\n)', src, re.S)
    acts = json.loads(m.group(2))
    acts = [a for a in acts if not a['id'].startswith('heiau_')]
    for a in acts:
        if a['id'] in EXISTING.get(island, {}): a['heiau'] = EXISTING[island][a['id']]
    acts += [act(s) for s in SITES[island]]
    out = json.dumps(acts, ensure_ascii=False, separators=(',', ':'))
    lint(json.dumps([a for a in acts if 'heiau' in a], ensure_ascii=False), path.name)
    path.write_text(src[:m.start(2)] + out + src[m.end(2):])

def js_obj(d):
    return json.dumps(d, ensure_ascii=False, separators=(',', ':'))

def patch_kauai(path):
    src = path.read_text()
    begin, end = '  // HEIAU (culture/heiau/build_heiau.py)\n', '  // END HEIAU\n'
    if begin in src:
        src = src[:src.index(begin)] + src[src.index(end) + len(end):]
    # The existing Wailua entry: attribute card, park hours from the State page, em dash out.
    i = src.index("{id:'wailua_heiau'"); j = src.index("tags:[", i); k = src.rindex("}", j, src.index("\n", j)) + 1
    ent = src[i:k]
    ent = re.sub(r",heiau:\{.*?\}(?=\})", '', ent)
    ent = ent.replace("Daily during daylight hours; non-resident entry fee $5/person + $10/vehicle parking (credit card only at on-site kiosks, effective Feb 22 2026)",
                      "Daily 7:00am to 7:45pm")
    ent = ent.replace("Daily 7:00am to 7:45pm; non-resident entry $5/person + $10/vehicle parking", "Daily 7:00am to 7:45pm")
    ent = ent.replace("along the Wailua River " + chr(0x2014) + " Hawaiian", "along the Wailua River, Hawaiian")
    ent = ent[:-1] + ',heiau:' + js_obj(EXISTING['kauai']['wailua_heiau']) + '}'
    src = src[:i] + ent + src[k:]
    k = i + len(ent)
    block = begin + ''.join('  ' + js_obj(act(s)) + ',\n' for s in SITES['kauai']) + end
    nl = src.index('\n', k) + 1
    if src[k] != ',': sys.exit('wailua_heiau is not followed by a comma')
    lint(block, 'kauai block')
    src = src[:nl] + block + src[nl:]
    path.write_text(src)

if __name__ == '__main__':
    patch_kauai(ROOT / 'index.html')
    for isl in ('oahu', 'maui', 'hawaii'): patch_json_file(ROOT / 'data' / (isl + '.js'), isl)
    n = sum(len(v) for v in SITES.values())
    print('new pins', n, 'existing enriched', sum(len(v) for v in EXISTING.values()))
