/* GoHawaii advisories engine. Loaded by the guest app (public ref only) and by the GoHawaii
 * Dashboard, so both read one list the same way.
 *
 * Three sources, one list:
 *   nws    National Weather Service active alerts for Hawaiʻi (api.weather.gov, CORS open)
 *   hta    Hawaiʻi Tourism Authority alert posts (hta.hawaii.gov/feed/, through /api/hta-feed
 *          because that feed sends no CORS header)
 *   staff  what GoHawaii staff post from their Dashboard
 *
 * Review build: staff posts live in this browser's localStorage (key gh_notices_v1), so a post
 * shows in the app only on the browser that made it. The live version swaps load()/save() for
 * a server table; nothing else here changes.
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
  function save(s){
    try { s.log = (s.log || []).slice(-300); localStorage.setItem(KEY, JSON.stringify(s)); return true; }
    catch(e){ return false; }
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

  // ---- feeds, cached for the page's life; refresh() re-reads both ----
  var last = { nws: null, hta: null, nwsAt: 0, htaAt: 0, nwsOk: null, htaOk: null };
  var inflight = null;
  function refresh(){
    if(inflight) return inflight;
    var a = fetchNws().then(function(x){ last.nws = x; last.nwsOk = true; }).catch(function(){ last.nwsOk = false; }).then(function(){ last.nwsAt = Date.now(); });
    var b = fetchHta().then(function(x){ last.hta = x; last.htaOk = true; }).catch(function(){ last.htaOk = false; }).then(function(){ last.htaAt = Date.now(); });
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

  window.GH_ADV = {
    KEY: KEY, ISL: ISL, ORDER: ORDER, NWS_LEVEL: NWS_LEVEL, HTA_SHOW_HOURS: HTA_SHOW_HOURS,
    load: load, save: save, refresh: refresh, last: last, active: active, features: features,
    inWindow: inWindow, onIsland: onIsland, nwsLevel: nwsLevel,
    hst: hst, until: until, islandNames: islandNames, esc: esc, markSeen: markSeen, seen: seen
  };
})();
