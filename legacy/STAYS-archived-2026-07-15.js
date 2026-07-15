// STAYS — themed VRBO vacation rentals curated for the app's audience.
// Each booking_url should carry your VRBO affiliate parameter (?adid=YOUR_AFFILIATE_ID).
// Replace these placeholder VRBO IDs with real listings researched on vrbo.com.
const STAYS = [

  // HOTELS — Booking.com affiliate (sign up at partner.booking.com, append ?aid=MISSING_YOUR_AFF_ID_BOOKING).
  {id:'grand_hyatt_kauai', name:'Grand Hyatt Kauaʻi Resort & Spa', n:'Grand Hyatt', r:'South Shore',
   lat:21.8775, lon:-159.4495, theme:'hotel', sleeps:4, beds:1, baths:1,
   price_low:475, price_high:950, photo:'',
   tip:'Saltwater lagoon pool, lazy river, kid-friendly without being theme-park. Walking distance to Shipwrecks Beach.',
   near_beach_id:'shipwrecks',
   booking_url:'https://www.booking.com/hotel/us/grand-hyatt-kauai-resort-and-spa.html?aid=MISSING_YOUR_AFF_ID_BOOKING', platform:'booking'},
  {id:'1_hotel_hanalei', name:'1 Hotel Hanalei Bay', n:'1 Hotel Hanalei', r:'North Shore',
   lat:22.2030, lon:-159.4870, theme:'hotel', sleeps:4, beds:1, baths:1,
   price_low:895, price_high:1850, photo:'',
   tip:'Eco-luxury rebrand of the old St. Regis Princeville. The view of Hanalei Bay is the whole show.',
   near_beach_id:'hanalei',
   booking_url:'https://www.booking.com/hotel/us/1-hotel-hanalei-bay.html?aid=MISSING_YOUR_AFF_ID_BOOKING', platform:'booking'},
  {id:'koa_kea_poipu', name:'Koa Kea Hotel & Resort', n:'Koa Kea', r:'South Shore',
   lat:21.8725, lon:-159.4540, theme:'hotel', sleeps:4, beds:1, baths:1,
   price_low:525, price_high:1100, photo:'',
   tip:'Smaller boutique on Poʻipū Beach. Adults-leaning, oceanfront rooms get direct beach access.',
   near_beach_id:'poipu',
   booking_url:'https://www.booking.com/hotel/us/koa-kea-resort.html?aid=MISSING_YOUR_AFF_ID_BOOKING', platform:'booking'},
  {id:'kauai_shores_kapaa', name:'Kauaʻi Shores Hotel', n:'Kauaʻi Shores', r:'East Side',
   lat:22.0772, lon:-159.3320, theme:'hotel', sleeps:3, beds:1, baths:1,
   price_low:215, price_high:410, photo:'',
   tip:'Mid-budget oceanfront in Kapaʻa. Walkable to coastal path, food trucks, and the Kapaʻa town strip.',
   near_beach_id:'kealia',
   booking_url:'https://www.booking.com/hotel/us/kauai-shores.html?aid=MISSING_YOUR_AFF_ID_BOOKING', platform:'booking'},
  {id:'sheraton_kauai', name:'Sheraton Kauaʻi Coconut Beach', n:'Sheraton Kauaʻi', r:'East Side',
   lat:22.0980, lon:-159.3315, theme:'hotel', sleeps:5, beds:2, baths:1,
   price_low:325, price_high:625, photo:'',
   tip:'Family-friendly Marriott Bonvoy spot. Two pools, oceanfront fire pit, easy Wailua Bay access.',
   near_beach_id:'wailua',
   booking_url:'https://www.booking.com/hotel/us/sheraton-kauai-coconut-beach.html?aid=MISSING_YOUR_AFF_ID_BOOKING', platform:'booking'}
];