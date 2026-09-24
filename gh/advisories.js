/* GoHawaii advisories engine. Loaded by the guest app (public ref only) and by the GoHawaii
 * Dashboard, so both read one list the same way.
 *
 * Three sources, one list:
 *   nws    National Weather Service active alerts for Hawaiʻi (api.weather.gov, CORS open)
 *   hta    Hawaiʻi Tourism Authority alert posts (hta.hawaii.gov/feed/, through /api/hta-feed
 *          because that feed sends no CORS header)
 *   staff  what GoHawaii staff post from their Dashboard
 *
 * Review build (gh/config.js api empty): staff posts live in this browser's localStorage (key
 * gh_notices_v1), so a post shows in the app only on the browser that made it. With the backend
 * named in gh/config.js, the same load()/save() read and write through it; see the sync block.
 *
 * Levels. red: full screen until the visitor taps "I understand", again every visit until it
 * ends. yellow: banner at the top plus one pop-up per visit. info: GoHawaii page only.
 * An advisory only ever adds caution. Nothing here reads or changes a beach verdict.
 */
(function(){
  'use strict';
  var KEY = 'gh_notices_v1';
  var ISL = { kauai:'Kauaʻi', oahu:'Oʻahu', maui:'Maui', hawaii:'Hawaiʻi Island' };
  var ORDER = ['kauai','oahu','maui','hawaii'];
  var HTA_SHOW_HOURS = 72;          // an HTA post has no end time; it shows as info this long
  var FETCH_MS = 9000;

  // NWS product names are a FIXED list, never pattern-matched (marine canon C-12): "Flood
  // Advisory", "Coastal Flood Advisory" and "Flood Watch" are three products with three meanings.
  // Anything NOT on this list shows yellow, so a product we never heard of is never silent.
  // Red is a Warning (occurring or imminent) plus Tsunami Advisory, whose action is "get out of
  // the water". Info is outlooks, statements, and marine products written for boaters.
  var NWS_LEVEL = {
    'Tsunami Warning':'red', 'Tsunami Advisory':'red', 'Hurricane Warning':'red',
    'Tropical Storm Warning':'red', 'Storm Surge Warning':'red', 'Extreme Wind Warning':'red',
    'High Surf Warning':'red', 'Flash Flood Warning':'red', 'Flood Warning':'red',
    'High Wind Warning':'red', 'Coastal Flood Warning':'red',
    'Tsunami Watch':'yellow', 'Hurricane Watch':'yellow', 'Tropical Storm Watch':'yellow',
    'Storm Surge Watch':'yellow', 'High Surf Advisory':'yellow', 'Beach Hazards Statement':'yellow',
    'Flash Flood Watch':'yellow', 'Flood Watch':'yellow', 'Flood Advisory':'yellow',
    'Coastal Flood Watch':'yellow', 'Coastal Flood Advisory':'yellow', 'High Wind Watch':'yellow',
    'Wind Advisory':'yellow',
    'Special Weather Statement':'info', 'Hazardous Weather Outlook':'info', 'Hydrologic Outlook':'info',
    'Small Craft Advisory':'info', 'Gale Warning':'info'
  };
  var NWS_BOATERS = { 'Small Craft Advisory':1, 'Gale Warning':1 };
  function nwsLevel(ev){ return NWS_LEVEL[ev] || 'yellow'; }

  // Which of our four islands an NWS zone list names. A list naming none of them (a channel, or
  // Molokaʻi/Lānaʻi only) is handled below: channels show everywhere, Molokaʻi/Lānaʻi-only nowhere.
  var NWS_ISLAND = [
    ['kauai',  /\b(Kauai|Niihau)\b/i],
    ['oahu',   /\b(Oahu|Waianae|Koolau|Olomana|Honolulu)\b/i],
    ['maui',   /\b(Maui|Haleakala|Kahoolawe)\b/i],
    ['hawaii', /\b(Big Island|Kona|Kohala|Kau|Puna|Hilo|Hamakua)\b/i]
  ];
  function nwsIslands(area){
    var out = [];
    NWS_ISLAND.forEach(function(p){ if(p[1].test(area)) out.push(p[0]); });
    if(out.length) return out;
    if(/\b(Molokai|Lanai)\b/i.test(area)) return [];
    return ['all'];
  }
  // The "WHERE..." line of an NWS product, verbatim, so the visitor reads the forecaster's words.
  function nwsWhere(desc){
    var m = /\*\s*WHERE\.\.\.([\s\S]*?)(?:\n\s*\n|\n\*|$)/.exec(desc || '');
    return m ? m[1].replace(/\s+/g,' ').trim() : '';
  }

  function withTimeout(url, opts){
    var ctl = null, t = null;
    try { ctl = new AbortController(); t = setTimeout(function(){ ctl.abort(); }, FETCH_MS); } catch(e){}
    var o = opts || {}; if(ctl) o.signal = ctl.signal;
    return fetch(url, o).then(function(r){ if(t) clearTimeout(t); if(!r.ok) throw new Error('HTTP ' + r.status); return r; });
  }

  function fetchNws(){
    return withTimeout('https://api.weather.gov/alerts/active?area=HI', { headers:{ 'Accept':'application/geo+json' } })
      .then(function(r){ return r.json(); })
      .then(function(d){
        var feats = (d && Array.isArray(d.features)) ? d.features : [];
        var items = [];
        feats.forEach(function(f){
          var p = f && f.properties; if(!p || !p.event) return;
          if(p.status && p.status !== 'Actual') return;          // drills and tests never reach a visitor
          if(p.messageType === 'Cancel') return;
          var isl = nwsIslands(p.areaDesc || '');
          if(!isl.length) return;
          items.push({
            id: 'nws:' + (p.id || f.id), src: 'nws', srcName: 'National Weather Service',
            level: nwsLevel(p.event), listed: !!NWS_LEVEL[p.event], boaters: !!NWS_BOATERS[p.event],
            title: p.event, headline: p.headline || '', body: (p.description || '').slice(0, 1400),
            where: nwsWhere(p.description) || (p.areaDesc || ''), area: p.areaDesc || '',
            instruction: (p.instruction || '').slice(0, 600),
            islands: isl, starts: p.onset || p.effective || p.sent, ends: p.ends || p.expires,
            sent: p.sent, link: 'https://www.weather.gov/hfo/'
          });
        });
        return items;
      });
  }

  function htaIslands(text){
    var out = [];
    if(/Kaua[ʻ'‘]?i/i.test(text)) out.push('kauai');
    if(/O[ʻ'‘]?ahu/i.test(text)) out.push('oahu');
    if(/\bMaui\b/i.test(text)) out.push('maui');
    if(/Hawai[ʻ'‘]?i Island|Big Island|Hawai[ʻ'‘]?i County/i.test(text)) out.push('hawaii');
    return out.length ? out : ['all'];
  }
  function strip(html){
    try { var d = new DOMParser().parseFromString('<div>' + (html || '') + '</div>', 'text/html'); return (d.body.textContent || '').replace(/\s+/g,' ').trim(); }
    catch(e){ return String(html || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }
  }
  function fetchHta(){
    return withTimeout('/api/hta-feed')
      .then(function(r){ return r.text(); })
      .then(function(xml){
        var doc = new DOMParser().parseFromString(xml, 'text/xml');
        // A bot-check page or any non-feed body is a failure, never an empty feed (an empty feed
        // would read as "no HTA updates").
        if(!doc.querySelector('rss > channel')) throw new Error('not an RSS feed');
        var items = [];
        Array.prototype.forEach.call(doc.querySelectorAll('item'), function(it){
          function tx(sel){ var n = it.querySelector(sel); return n ? (n.textContent || '').trim() : ''; }
          var link = tx('link');
          if(link.indexOf('/alerts/') < 0) return;               // the feed mixes news and alerts
          var title = tx('title'), pub = tx('pubDate');
          var desc = strip(tx('description')).replace(/The post .* appeared first on .*$/i, '').trim();
          var t = Date.parse(pub); if(!isFinite(t)) return;
          items.push({
            id: 'hta:' + link, src: 'hta', srcName: 'Hawaiʻi Tourism Authority',
            level: 'info', title: title, headline: '', body: desc.slice(0, 700), where: '',
            islands: htaIslands(title + ' ' + desc),
            starts: new Date(t).toISOString(), ends: new Date(t + HTA_SHOW_HOURS * 3600e3).toISOString(),
            sent: new Date(t).toISOString(), link: link
          });
        });
        return items;
      });
  }

  // ---- staff store (review build: this browser) ----
  function blank(){ return { items: [], hta: {}, log: [] }; }
  function load(){
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if(!s || typeof s !== 'object') return blank();
      if(!Array.isArray(s.items)) s.items = [];
      if(!s.hta || typeof s.hta !== 'object') s.hta = {};
      if(!Array.isArray(s.log)) s.log = [];
      return s;
    } catch(e){ return blank(); }
  }

  function inWindow(it, now){
    if(it.starts && Date.parse(it.starts) > now) return false;
    if(it.ends && Date.parse(it.ends) <= now) return false;
    return true;
  }
  function onIsland(it, isl){
    var a = it.islands || [];
    return !a.length || a.indexOf('all') >= 0 || !isl || a.indexOf(isl) >= 0;
  }
  var RANK = { red: 0, yellow: 1, info: 2 };
  function byLevel(a, b){
    var d = (a.level in RANK ? RANK[a.level] : 2) - (b.level in RANK ? RANK[b.level] : 2); if(d) return d;   // red is 0: never || it
    return (Date.parse(b.sent || b.starts || 0) || 0) - (Date.parse(a.sent || a.starts || 0) || 0);
  }

  // The list a visitor on `isl` sees at `now`. feeds = { nws: [...], hta: [...] } (either may be
  // null when that feed could not be reached). previewId shows one staff item as if it were live.
  function active(feeds, isl, now, previewId){
    now = now || Date.now();
    var st = load(), out = [];
    (feeds && feeds.nws || []).forEach(function(it){ if(inWindow(it, now) && onIsland(it, isl)) out.push(it); });
    (feeds && feeds.hta || []).forEach(function(it){
      // Staff may hide an HTA post (the state's own words, their call). To raise one to yellow or
      // red they repost it as a staff advisory, which then goes through the same approval as any post.
      var ov = st.hta[it.id];
      if(ov && ov.hidden) return;
      if(inWindow(it, now) && onIsland(it, isl)) out.push(it);
    });
    st.items.forEach(function(it){
      if(it.kind !== 'advisory') return;
      var pv = previewId && it.id === previewId;
      if(!pv && it.status !== 'live') return;
      if(!pv && !inWindow(it, now)) return;
      if(!onIsland(it, isl)) return;
      out.push(pv ? Object.assign({}, it, { preview: true }) : it);
    });
    return out.sort(byLevel);
  }
  function features(isl, now, previewId){
    now = now || Date.now();
    return load().items.filter(function(it){
      if(it.kind !== 'feature') return false;
      var pv = previewId && it.id === previewId;
      if(!pv && (it.status !== 'live' || !inWindow(it, now))) return false;
      return onIsland(it, isl);
    }).sort(function(a, b){ return (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0); });
  }

  // ---- timed promotions (kind 'promo'): GoHawaii's own notices with daily hours in Hawaiʻi time ----
  // Posted by an Editor, live at once (only a red advisory needs a second approval). A promotion shows
  // in the app only inside its active dates AND its daily hours and days, all read in Hawaiʻi time.
  var DOW = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }, DAYN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function hstParts(now){
    try {
      var s = new Date(now).toLocaleString('en-US', { timeZone:'Pacific/Honolulu', weekday:'short', hour:'2-digit', minute:'2-digit', hour12:false }).replace(/\u200e/g, '');
      var m = /^(\w{3})\D+(\d{1,2}):(\d{2})/.exec(s);
      if(!m) return null;
      return { dow: DOW[m[1]], min: ((+m[2]) % 24) * 60 + (+m[3]) };
    } catch(e){ return null; }
  }
  function winParse(w){
    if(!w || typeof w !== 'object') return null;
    var a = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(w.start || '')), b = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(w.end || ''));
    if(!a || !b) return null;
    return { s: (+a[1]) * 60 + (+a[2]), e: (+b[1]) * 60 + (+b[2]) };
  }
  // True when the promotion's hours and days include this moment, Hawaiʻi time. No hours set = all day.
  // A malformed window never shows: a typo hides a promotion, it never shows it at the wrong time.
  function inDaily(it, now){
    var h = hstParts(now || Date.now()); if(!h) return true;
    if(Array.isArray(it.days) && it.days.length && it.days.indexOf(h.dow) < 0) return false;
    if(!it.window) return true;
    var p = winParse(it.window); if(!p) return false;
    return p.s <= p.e ? (h.min >= p.s && h.min < p.e) : (h.min >= p.s || h.min < p.e);
  }
  function promos(isl, now, previewId, all){
    now = now || Date.now();
    return load().items.filter(function(it){
      if(it.kind !== 'promo') return false;
      var pv = previewId && it.id === previewId;
      if(!pv && (it.status !== 'live' || !inWindow(it, now))) return false;
      if(!pv && !all && !inDaily(it, now)) return false;
      return onIsland(it, isl);
    }).sort(function(a, b){ return (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0); });
  }
  function hoursLabel(it){
    var p = winParse(it.window);
    function t(m){ var h = Math.floor(m / 60), mi = m % 60; return (((h + 11) % 12) + 1) + (mi ? ':' + (mi < 10 ? '0' : '') + mi : '') + (h >= 12 ? 'pm' : 'am'); }
    var d = Array.isArray(it.days) && it.days.length && it.days.length < 7 ? ' · ' + it.days.slice().sort().map(function(x){ return DAYN[x]; }).join(', ') : '';
    return (p ? t(p.s) + ' to ' + t(p.e) + ' Hawaiʻi time' : 'All day') + d;
  }

  // ---- feeds, cached for the page's life; refresh() re-reads both ----
  var last = { nws: null, hta: null, nwsAt: 0, htaAt: 0, nwsOk: null, htaOk: null };
  var inflight = null;
  // onEach(last) runs as each feed settles, so a slow feed never holds back the other.
  function refresh(onEach){
    if(inflight) return inflight;
    function each(){ if(onEach) try { onEach(last); } catch(e){} }
    var a = fetchNws().then(function(x){ last.nws = x; last.nwsOk = true; }).catch(function(){ last.nwsOk = false; }).then(function(){ last.nwsAt = Date.now(); each(); });
    var b = fetchHta().then(function(x){ last.hta = x; last.htaOk = true; }).catch(function(){ last.htaOk = false; }).then(function(){ last.htaAt = Date.now(); each(); });
    inflight = Promise.all([a, b]).then(function(){ inflight = null; return last; });
    return inflight;
  }

  // ---- display helpers (Hawaiʻi time, always) ----
  function hst(iso, withDay){
    var t = Date.parse(iso); if(!isFinite(t)) return '';
    try {
      var o = { timeZone:'Pacific/Honolulu', hour:'numeric', minute:'2-digit' };
      if(withDay){ o.weekday = 'short'; o.month = 'short'; o.day = 'numeric'; }
      return new Date(t).toLocaleString('en-US', o).replace(':00', '').replace(' AM','am').replace(' PM','pm');
    } catch(e){ return new Date(t).toISOString().slice(0,16).replace('T',' '); }
  }
  function until(it){ return it.ends ? 'until ' + hst(it.ends, true) : 'no end time'; }
  function islandNames(a){
    if(!a || !a.length || a.indexOf('all') >= 0) return 'Kauaʻi, Oʻahu, Maui and Hawaiʻi Island';
    return ORDER.filter(function(k){ return a.indexOf(k) >= 0; }).map(function(k){ return ISL[k]; }).join(', ');
  }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }

  // Times this browser has shown an advisory (the review stand-in for the live "seen by" count).
  function markSeen(id){
    try { var m = JSON.parse(localStorage.getItem('gh_adv_seen') || '{}'); m[id] = (m[id] || 0) + 1; localStorage.setItem('gh_adv_seen', JSON.stringify(m)); } catch(e){}
  }
  function seen(id){ try { return (JSON.parse(localStorage.getItem('gh_adv_seen') || '{}')[id]) || 0; } catch(e){ return 0; } }

  // ---- Places: what State and county staff change in the GoHawaii listings (Nick, 2026-09-23) ----
  // An overlay per island, applied on top of the pulled layer (key gh_places_v1 holds all four):
  //   edits[id]  fields that replace the listing's own (name, tip, hours, address, website, img, r, lat, lon, owner)
  //   hidden[id] a listing taken off the app
  //   added[]    places staff put on the map; ids start gh_staff_ so the app's gh_ guards accept them
  // Beaches are not in here: a beach verdict and its safety data never come from this store.
  var PKEY = 'gh_places_v1';
  var PLACE_FIELDS = ['name','n','tip','hours','address','website','img','r','lat','lon','owner','target','type','theme','gh_sub'];
  // Who looks after a place. GoHawaii's own listings default to the State.
  var OWNERS = { state:'State of Hawaiʻi', kauai:'County of Kauaʻi', oahu:'City and County of Honolulu', maui:'County of Maui', hawaii:'County of Hawaiʻi' };
  function placeBlank(){ return { edits: {}, hidden: {}, added: [] }; }
  function placesAll(){
    var d = null; try { d = JSON.parse(localStorage.getItem(PKEY)); } catch(e){}
    d = d && typeof d === 'object' ? d : {};
    var out = {};
    ORDER.forEach(function(i){ var x = d[i] || {}; out[i] = { edits: x.edits || {}, hidden: x.hidden || {}, added: Array.isArray(x.added) ? x.added : [] }; });
    return out;
  }
  function placesLoad(isl){ return placesAll()[isl] || placeBlank(); }
  function placesWrite(all){ try { localStorage.setItem(PKEY, JSON.stringify(all)); } catch(e){} }
  function placesSave(isl, d, note){
    var all = placesAll(); all[isl] = d; placesWrite(all);
    if(staffOn()) push('places:' + isl, d, note);
  }
  // The rows the app should show on this island: the layer's rows with edits laid over them, hidden ones
  // dropped, added ones last. Every returned row is a copy, so the layer file itself never changes.
  function applyPlaces(isl, rows, d){
    d = d || placesLoad(isl);
    var out = [];
    (Array.isArray(rows) ? rows : []).forEach(function(r){
      if(!r || d.hidden[r.id]) return;
      var e = d.edits[r.id], c = {}; for(var k in r) c[k] = r[k];
      if(e) PLACE_FIELDS.forEach(function(f){ if(e[f] !== undefined) c[f] = e[f]; });
      if(e) c.staff = true;
      out.push(c);
    });
    (d.added || []).forEach(function(r){ if(!d.hidden[r.id]){ var c = {}; for(var k in r) c[k] = r[k]; c.staff = true; out.push(c); } });
    return out;
  }

  // ---- The shared backend (backend-gohawaii/). Off until gh/config.js names it. ----
  // Off: everything above lives in this browser, as in the review build. On: visitors read the live posts
  // and place changes from /gh/public, staff read and save through their own sign-in key, and the app sends
  // visit totals. localStorage stays the working copy either way, so every screen reads the same place.
  var API = (function(){ try { return String((window.GH_CONFIG && window.GH_CONFIG.api) || '').replace(/\/+$/, ''); } catch(e){ return ''; } })();
  var SKEY = 'gh_staff_key';
  var vers = {};
  function staffKey(){ try { return sessionStorage.getItem(SKEY) || ''; } catch(e){ return ''; } }
  function staffOn(){ return !!(API && staffKey()); }
  function emit(type, detail){ try { window.dispatchEvent(new CustomEvent(type, { detail: detail })); } catch(e){} }
  function sreq(path, opt){
    opt = opt || {};
    opt.headers = Object.assign({ 'Authorization': 'Bearer ' + staffKey(), 'Content-Type': 'application/json' }, opt.headers || {});
    return fetch(API + path, opt).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ j._status = r.status; return j; }); });
  }
  function adopt(name, body){
    if(name === 'notices'){ var s = load(); s.items = body.items || []; s.hta = body.hta || {}; s.log = body.log || []; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e){} }
    else { var all = placesAll(); all[name.slice(7)] = { edits: body.edits || {}, hidden: body.hidden || {}, added: body.added || [] }; placesWrite(all); }
  }
  var queue = {}, busy = {};
  function push(name, body, note){
    queue[name] = { body: body, note: note || '' };
    if(busy[name]) return;
    busy[name] = true;
    var job = queue[name]; delete queue[name];
    sreq('/gh/doc/' + name, { method: 'PUT', body: JSON.stringify({ ver: vers[name] || 0, body: job.body, note: job.note }) }).then(function(j){
      if(j._status === 200){ vers[name] = j.ver; adopt(name, j.body); emit('gh-synced', { name: name }); }
      else if(j._status === 409){ vers[name] = j.ver; adopt(name, j.body); emit('gh-sync-error', { name: name, error: 'conflict', by: j.updated_by }); }
      else { emit('gh-sync-error', { name: name, error: j.error || ('http ' + j._status), id: j.id }); pullStaff(); }
    }).catch(function(){ emit('gh-sync-error', { name: name, error: 'offline' }); })
      .then(function(){ busy[name] = false; if(queue[name]){ var q = queue[name]; delete queue[name]; push(name, q.body, q.note); } });
  }
  function signIn(key){
    try { sessionStorage.setItem(SKEY, key); } catch(e){}
    return sreq('/gh/me').then(function(j){ if(j._status !== 200){ signOut(); throw new Error(j.error || 'sign_in'); } return pullStaff().then(function(){ return j; }); });
  }
  function signOut(){ try { sessionStorage.removeItem(SKEY); } catch(e){} }
  function me(){ return staffOn() ? sreq('/gh/me').then(function(j){ return j._status === 200 ? j : null; }) : Promise.resolve(null); }
  function pullStaff(){
    var names = ['notices'].concat(ORDER.map(function(i){ return 'places:' + i; }));
    return Promise.all(names.map(function(n){ return sreq('/gh/doc/' + n).then(function(j){ if(j._status === 200){ vers[n] = j.ver; adopt(n, j.body); } }); }))
      .then(function(){ emit('gh-synced', { name: 'all' }); });
  }
  function save(s){
    try { s.log = (s.log || []).slice(-300); localStorage.setItem(KEY, JSON.stringify(s)); }
    catch(e){ return false; }
    if(staffOn()) push('notices', { items: s.items, hta: s.hta, log: s.log });
    return true;
  }
  // Visitors: the public read. Only live posts come back; a staff member's own browser uses pullStaff.
  function pullPublic(){
    if(!API) return Promise.resolve(false);
    return fetch(API + '/gh/public').then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
      if(!j) return false;
      var before = localStorage.getItem(KEY) + '|' + localStorage.getItem(PKEY);
      try { localStorage.setItem(KEY, JSON.stringify({ items: j.items || [], hta: j.hta || {}, log: [] })); } catch(e){}
      var all = {}; ORDER.forEach(function(i){ all[i] = (j.places && j.places[i]) || placeBlank(); }); placesWrite(all);
      return before !== localStorage.getItem(KEY) + '|' + localStorage.getItem(PKEY);
    }).catch(function(){ return false; });
  }
  function stats(days){ return staffOn() ? sreq('/gh/stats?days=' + (days || 30)) : Promise.resolve(null); }
  function audit(){ return staffOn() ? sreq('/gh/audit') : Promise.resolve(null); }

  // Visit totals. Added up in the page and sent as totals when the visitor leaves or every 30 seconds;
  // nothing names the visitor, their device, or where they are. Off unless the backend is on.
  var tally = {}, tallyIsl = '';
  function count(isl, metric, k){
    if(!API) return;
    try { if(navigator.doNotTrack === '1' || window.doNotTrack === '1') return; } catch(e){}
    if(tallyIsl && tallyIsl !== isl) flush();   // a batch belongs to one island
    tallyIsl = isl; var key = metric + '\u0001' + String(k == null ? '' : k).toLowerCase().slice(0, 64);
    tally[key] = (tally[key] || 0) + 1;
  }
  function flush(){
    var keys = Object.keys(tally); if(!API || !keys.length || !tallyIsl) return;
    var rows = keys.map(function(key){ var p = key.split('\u0001'); return [p[0], p[1], tally[key]]; });
    tally = {};
    var body = JSON.stringify({ island: tallyIsl, rows: rows });
    try { if(navigator.sendBeacon && navigator.sendBeacon(API + '/gh/e', new Blob([body], { type: 'text/plain' }))) return; } catch(e){}
    try { fetch(API + '/gh/e', { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(function(){}); } catch(e){}
  }
  if(API){
    setInterval(flush, 30000);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'hidden') flush(); });
  }

  window.GH_ADV = {
    PKEY: PKEY, OWNERS: OWNERS, placesLoad: placesLoad, placesSave: placesSave, applyPlaces: applyPlaces,
    API: API, staffOn: staffOn, signIn: signIn, signOut: signOut, me: me, pullStaff: pullStaff, pullPublic: pullPublic, stats: stats, audit: audit, count: count, flush: flush,
    KEY: KEY, ISL: ISL, ORDER: ORDER, NWS_LEVEL: NWS_LEVEL, HTA_SHOW_HOURS: HTA_SHOW_HOURS,
    load: load, save: save, refresh: refresh, last: last, active: active, features: features, promos: promos, inDaily: inDaily, hoursLabel: hoursLabel,
    inWindow: inWindow, onIsland: onIsland, nwsLevel: nwsLevel,
    hst: hst, until: until, islandNames: islandNames, esc: esc, markSeen: markSeen, seen: seen
  };
})();
