/* GoHawaii advisories: the visitor side. Loaded only for a public ref (?ref=gohawaii), after
 * gh/advisories.js. Every other load of the app never fetches this file.
 *
 * What it adds:
 *   - red advisory: full screen until "I understand", again each visit until it ends
 *   - yellow advisory: a bar under the GoHawaii strip, plus one pop-up per visit
 *   - the GoHawaii page (tap the strip, or it opens once per visit): advisories, today's beach
 *     verdicts, what GoHawaii features, events this week. Mālama shows only when staff feature
 *     it: several of their Mālama listings are hotel packages, and this page carries no offers.
 *   - on a beach card: the advisories that apply there, at the top
 *   - on the map: a ring on any beach a GoHawaii advisory names
 *   - a Tsunami Warning: "Show the way out" opens a full-screen map of the state's evacuation zone
 *     with a walking route from the visitor's beach (or location) to the nearest spot outside it
 * It never changes a beach verdict. Safety content from the app still wins every tie.
 */
(function(){
  'use strict';
  var A = window.GH_ADV; if(!A) return;
  var esc = A.esc;
  var PREVIEW = (function(){ try { return new URLSearchParams(location.search).get('gh_preview') || ''; } catch(e){ return ''; } })();
  // ?gh_demo=tsunami (review build): a sample Tsunami Warning on the island in view, so the warning
  // and the way-out map can be shown on a calm day. One allowlisted literal; anything else is ignored.
  var DEMO = (function(){ try { return new URLSearchParams(location.search).get('gh_demo') === 'tsunami'; } catch(e){ return false; } })();
  var DEMO_AT = Date.now();
  var feeds = { nws: null, hta: null };
  var ICON = {
    warn: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    chev: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    cal:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    up:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 20 6-8 4 5 3-4 5 7z"/><path d="M12 3v6M9 6l3-3 3 3"/></svg>',
    pin:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    loc:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    shake:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h3l3-7 4 14 3-7h5"/></svg>',
    x:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };
  var VERDICT = { green:'Calmer today', yellow:'Use caution', red:'Not recommended', nodata:'No live data' };
  var VCOL = { green:'#16a34a', yellow:'#d97706', red:'#b91c1c', nodata:'#5f92a8' };

  function isl(){ return (window.ACTIVE && ACTIVE.slug) || 'kauai'; }
  function islName(){ return A.ISL[isl()] || (window.ACTIVE && ACTIVE.name) || ''; }
  function list(){ var out = A.active(feeds, isl(), Date.now(), PREVIEW); if(DEMO) out.unshift(demoTsu()); return out; }
  function demoTsu(){
    var i = isl(), first = new Date(DEMO_AT + 45 * 60e3).toISOString();
    return { id: 'demo:tsunami:' + i, src: 'nws', srcName: 'National Weather Service', demo: true, sample: true, level: 'red', listed: true,
      title: 'Tsunami Warning', headline: 'Tsunami Warning for ' + (A.ISL[i] || ''),
      body: 'A tsunami that could flood the coast is on the way. First waves are expected about ' + A.hst(first) + ' Hawaiʻi time.',
      where: 'All coasts of ' + (A.ISL[i] || ''),
      instruction: 'Leave the tsunami evacuation zone now. Go inland and uphill, away from the ocean. Follow police, sirens, and posted signs.',
      islands: [i], starts: new Date(DEMO_AT - 5 * 60e3).toISOString(), ends: new Date(DEMO_AT + 3 * 3600e3).toISOString(),
      sent: new Date(DEMO_AT).toISOString(), link: 'https://www.tsunami.gov/' };
  }
  function feats(){ return A.features(isl(), Date.now(), PREVIEW); }
  function ss(k, v){ try { if(v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch(e){ return null; } }

  function css(){
    if(document.getElementById('ghaStyle')) return;
    var st = document.createElement('style'); st.id = 'ghaStyle';
    st.textContent = [
      '.gha-lv-red{--lv:#b91c1c;--lvbg:#fdecea;--lvink:#7f1d1d}',
      '.gha-lv-yellow{--lv:#b45309;--lvbg:#fef3c7;--lvink:#78350f}',
      '.gha-lv-info{--lv:#0f4c5c;--lvbg:#e7f1f4;--lvink:#0f3b49}',
      '#ghaBar{display:flex;align-items:center;gap:8px;width:calc(100% + 28px);margin:0 -14px;padding:8px 14px;border:0;border-bottom:1px solid rgba(0,0,0,.06);background:var(--lvbg);color:var(--lvink);font:600 12.5px/1.3 "DM Sans",system-ui,sans-serif;text-align:left;cursor:pointer}',
      '#ghaBar .gha-ic{color:var(--lv);flex-shrink:0;display:flex}',
      '#ghaBar .gha-t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#ghaBar .gha-more{font-weight:700;font-size:11px;background:rgba(0,0,0,.07);border-radius:999px;padding:2px 7px;flex-shrink:0}',
      '#ghaRed{position:fixed;inset:0;z-index:6000;background:rgba(40,8,8,.72);display:flex;align-items:flex-end;justify-content:center;padding:0;font-family:"DM Sans",system-ui,sans-serif}',
      '@media(min-width:620px){#ghaRed{align-items:center;padding:24px}}',
      '#ghaRed .gha-card{background:#fff;width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden}',
      '@media(min-width:620px){#ghaRed .gha-card{max-width:520px;height:auto;max-height:92vh;border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.35)}}',
      '#ghaRed .gha-head{background:#b91c1c;color:#fff;padding:calc(22px + env(safe-area-inset-top,0px)) 20px 18px}',
      '#ghaRed .gha-kicker{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.95}',
      '#ghaRed h2{margin:8px 0 4px;font-size:24px;line-height:1.15;font-weight:800}',
      '#ghaRed .gha-sub{font-size:13px;opacity:.92}',
      '#ghaRed .gha-body{padding:16px 20px;overflow:auto;flex:1;font-size:14.5px;line-height:1.5;color:#1f2937}',
      '#ghaRed .gha-where{background:#fdecea;border-radius:10px;padding:10px 12px;margin-bottom:12px;color:#7f1d1d;font-size:13.5px}',
      '#ghaRed .gha-txt{white-space:pre-line}',
      '#ghaRed .gha-foot{padding:14px 20px calc(16px + env(safe-area-inset-bottom,0px));border-top:1px solid #eee;display:flex;flex-direction:column;gap:10px}',
      '#ghaRed .gha-ok{appearance:none;border:0;border-radius:12px;background:#b91c1c;color:#fff;font:800 16px "DM Sans",system-ui,sans-serif;padding:14px;cursor:pointer}',
      '#ghaRed .gha-fine{font-size:11.5px;color:#6b7280;text-align:center}',
      '#ghaRed a{color:#b91c1c}',
      '.gha-sample{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;background:#fff7d6;color:#7a5a00;border:1px dashed #d8b64a;border-radius:6px;padding:1px 6px;vertical-align:middle}',
      '#ghaRed .gha-head .gha-sample{background:rgba(255,255,255,.18);color:#fff;border-color:rgba(255,255,255,.6)}',
      '#ghaPop{position:fixed;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:5000;max-width:460px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 12px 36px rgba(0,0,0,.28);border-top:5px solid var(--lv);font-family:"DM Sans",system-ui,sans-serif;padding:14px 16px}',
      '#ghaPop .gha-kicker{display:flex;align-items:center;gap:7px;color:var(--lv);font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}',
      '#ghaPop b{display:block;font-size:16px;color:#0f172a;margin:6px 0 2px}',
      '#ghaPop .gha-sub{font-size:12.5px;color:#475569}',
      '#ghaPop .gha-row{display:flex;gap:8px;margin-top:12px}',
      '#ghaPop button{flex:1;appearance:none;border-radius:10px;font:700 14px "DM Sans",system-ui,sans-serif;padding:10px;cursor:pointer}',
      '#ghaPop .gha-p{background:var(--lv);color:#fff;border:0}',
      '#ghaPop .gha-s{background:#fff;color:#334155;border:1px solid #cbd5e1}',
      '.gha-card-a{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;margin-bottom:8px;border-radius:12px;background:var(--lvbg);border-left:4px solid var(--lv);cursor:pointer}',
      '.gha-card-a .gha-ic{color:var(--lv);flex-shrink:0;margin-top:1px;display:flex}',
      '.gha-card-a .gha-t{font-weight:700;color:var(--lvink);font-size:14px;line-height:1.3}',
      '.gha-card-a .gha-m{font-size:11.5px;color:#475569;margin-top:2px}',
      '.gha-card-a .gha-w{font-size:12.5px;color:#334155;margin-top:5px;line-height:1.4}',
      '.gha-card-a details{margin-top:6px;font-size:12.5px;color:#334155}',
      '.gha-card-a summary{cursor:pointer;color:var(--lv);font-weight:700}',
      '.gha-empty{padding:11px 12px;border-radius:12px;background:#f1f5f9;color:#334155;font-size:13px;line-height:1.45;margin-bottom:8px}',
      '.gha-hub h2{font-size:22px;margin:0;color:var(--ink,#0f172a);font-weight:800;letter-spacing:-.01em}',
      '.gha-hub .gha-date{font-size:12.5px;color:var(--mute,#64748b);margin-top:2px}',
      '.gha-hub .slbl{margin-top:18px}',
      '.gha-verd{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}',
      '.gha-verd span{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border,#e2e8f0);border-radius:999px;padding:5px 10px;font-size:12.5px;font-weight:600;color:#334155;background:#fff}',
      '.gha-verd i{width:9px;height:9px;border-radius:50%;display:inline-block}',
      '.gha-li{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border,#e2e8f0);border-radius:12px;margin-bottom:6px;cursor:pointer;background:#fff}',
      '.gha-li .gha-x{flex:1;min-width:0}',
      '.gha-li .gha-x b{display:block;font-size:13.5px;color:var(--ink,#0f172a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.gha-li .gha-x span{display:block;font-size:11.5px;color:var(--mute,#64748b)}',
      '.gha-li .gha-ico{position:relative;overflow:hidden;width:40px;height:40px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#e7f1f4;color:#0f4c5c}',
      '.gha-li .gha-ico img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
      '.gha-feat{border-radius:14px;overflow:hidden;border:1px solid var(--border,#e2e8f0);margin-bottom:8px;cursor:pointer;background:#fff}',
      '.gha-feat .gha-fimg{height:112px;background:linear-gradient(135deg,#0f4c5c,#1a7a8a);background-size:cover;background-position:center;position:relative}',
      '.gha-feat .gha-ftag{position:absolute;left:10px;top:10px;display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.94);color:#0f4c5c;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:800}',
      '.gha-feat .gha-fb{padding:10px 12px}',
      '.gha-feat .gha-ftag-in{position:static;background:#e7f1f4;margin-bottom:6px}',
      '.gha-feat .gha-fb b{display:block;font-size:15px;color:var(--ink,#0f172a)}',
      '.gha-feat .gha-fb > span:not(.gha-ftag){display:block;font-size:12.5px;color:var(--mute,#64748b);margin-top:2px}',
      '.gha-fine{font-size:11px;color:var(--mute,#64748b);margin-top:18px;line-height:1.5}',
      '.gha-ring{position:relative;width:0;height:0}',
      '.gha-ring::before{content:"";position:absolute;left:-19px;top:-19px;width:38px;height:38px;border-radius:50%;border:3px solid var(--lv);box-shadow:0 0 0 3px rgba(255,255,255,.85);animation:ghaPulse 1.8s ease-in-out infinite}',
      '.gha-ring::after{content:"!";position:absolute;left:10px;top:-26px;width:18px;height:18px;border-radius:50%;background:var(--lv);color:#fff;font:800 12px/18px "DM Sans",system-ui,sans-serif;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.35)}',
      '@keyframes ghaPulse{0%,100%{opacity:1}50%{opacity:.45}}',
      '@media (prefers-reduced-motion:reduce){.gha-ring::before{animation:none}}',
      '#ghaHubBtn{appearance:none;border:1px solid rgba(255,255,255,.55);background:rgba(255,255,255,.12);color:#fff;border-radius:999px;padding:3px 10px 3px 9px;font:700 11.5px "DM Sans",system-ui,sans-serif;display:inline-flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap}',
      '#ghaHubBtn .gha-dot{width:8px;height:8px;border-radius:50%;background:#5f92a8;box-shadow:0 0 0 2px rgba(255,255,255,.5)}',
      '#ghaRed .gha-ok2{background:#fff;color:#b91c1c;border:2px solid #b91c1c}',
      '.gha-waybtn{appearance:none;display:inline-flex;align-items:center;gap:6px;margin-top:8px;border:0;border-radius:10px;background:#b91c1c;color:#fff;font:800 13.5px "DM Sans",system-ui,sans-serif;padding:9px 12px;cursor:pointer}',
      '#ghTsu{position:fixed;inset:0;z-index:5900;display:flex;flex-direction:column;background:#dfe7ea;font-family:"DM Sans",system-ui,sans-serif;color:#0f172a}',
      '@media(min-width:760px){#ghTsu{left:50%;width:480px;margin-left:-240px;box-shadow:0 0 0 100vmax rgba(15,23,42,.6)}}',
      '#ghTsu .ght-bar{display:flex;align-items:center;gap:10px;padding:calc(12px + env(safe-area-inset-top,0px)) 12px 12px 14px;background:#b91c1c;color:#fff}',
      '#ghTsu .ght-bar .ght-t{flex:1;min-width:0}',
      '#ghTsu .ght-bar b{display:block;font-size:15.5px;font-weight:800;line-height:1.2}',
      '#ghTsu .ght-bar .ght-s{display:block;font-size:12.5px;opacity:.92}',
      '#ghTsu .ght-bar .gha-sample{background:rgba(255,255,255,.18);color:#fff;border-color:rgba(255,255,255,.6)}',
      '#ghTsu .ght-x{appearance:none;border:0;background:rgba(255,255,255,.18);color:#fff;border-radius:999px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}',
      '#ghTsuMap{flex:1;min-height:0;position:relative;z-index:0}',
      '#ghTsu .ght-leg{position:absolute;z-index:2;left:10px;top:calc(72px + env(safe-area-inset-top,0px));background:rgba(255,255,255,.95);border-radius:12px;padding:7px 10px;font-size:11.5px;box-shadow:0 2px 10px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:4px}',
      '#ghTsu .ght-leg span{display:flex;align-items:center;gap:7px}',
      '#ghTsu .ght-sw{width:16px;height:11px;border-radius:3px;flex-shrink:0;background:rgba(220,38,38,.42);border:2px solid #b91c1c}',
      '#ghTsu .ght-sw.x{background:rgba(245,158,11,.16);border:2px dashed #c2410c}',
      '#ghTsu .ght-sheet{position:absolute;z-index:2;left:0;right:0;bottom:0;max-height:62%;overflow:auto;background:#fff;border-radius:20px 20px 0 0;padding:12px 16px calc(16px + env(safe-area-inset-bottom,0px));box-shadow:0 -6px 24px rgba(0,0,0,.2)}',
      '#ghTsu .ght-pick{display:flex;gap:8px;margin-bottom:10px}',
      '#ghTsu .ght-pick select{flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:600 14px "DM Sans",system-ui,sans-serif;color:#0f172a;background:#fff}',
      '#ghTsu .ght-pick button{appearance:none;display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#1d4ed8;font:700 13px "DM Sans",system-ui,sans-serif;padding:8px 10px;cursor:pointer;white-space:nowrap}',
      '#ghTsu .ght-st{display:flex;gap:10px;align-items:flex-start}',
      '#ghTsu .ght-ic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#fdecea;color:#b91c1c}',
      '#ghTsu .ght-ic.gray{background:#eef2f5;color:#475569}',
      '#ghTsu .ght-ic.amber{background:#fef3c7;color:#b45309}',
      '#ghTsu h3{margin:0;font-size:18px;line-height:1.2;font-weight:800}',
      '#ghTsu .ght-st p{margin:4px 0 0;font-size:14px;color:#334155;line-height:1.4}',
      '#ghTsu .ght-way{margin-top:10px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:12px;padding:9px 11px}',
      '#ghTsu .ght-wh{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-weight:800;color:#1e3a8a;font-size:14px}',
      '#ghTsu .ght-wh span{font-weight:600;font-size:12.5px;color:#1d4ed8;white-space:nowrap}',
      '#ghTsu .ght-from{font-size:12px;color:#475569;margin-top:1px}',
      '#ghTsu .ght-way ol{margin:6px 0 0;padding:0;list-style:none;font-size:13px;color:#1e293b}',
      '#ghTsu .ght-way li{display:flex;gap:8px;align-items:center;padding:3px 0}',
      '#ghTsu .ght-way li i{font-style:normal;width:18px;height:18px;border-radius:50%;background:#2563eb;color:#fff;font-size:10.5px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
      '#ghTsu .ght-way li.end i{background:#15803d}',
      '#ghTsu .ght-way li b{margin-left:auto;font-weight:600;color:#475569;font-size:12px;white-space:nowrap}',
      '#ghTsu .ght-tip{margin:8px 0 0;font-size:12.5px;color:#475569;line-height:1.4}',
      '#ghTsu .ght-shake{margin-top:10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:9px 11px;font-size:13px;color:#7c2d12;display:flex;gap:8px;align-items:flex-start;line-height:1.4}',
      '#ghTsu .ght-shake svg{flex-shrink:0;margin-top:1px}',
      '#ghTsu .ght-src{margin-top:10px;font-size:11px;color:#64748b;display:flex;justify-content:space-between;gap:10px;line-height:1.35}',
      '#ghTsu .ght-src b{color:#15803d;white-space:nowrap}',
      '#ghTsu .ght-src b.stale{color:#b91c1c}',
      'body:has(#ghTsu) #swUpdateToast{display:none!important}'
    ].join('\n')
      // Inside the GoHawaii Dashboard's phone the service worker's reload prompt is noise.
      + (window.parent !== window ? '\n#swUpdateToast{display:none!important}' : '');
    document.head.appendChild(st);
  }

  // ---- blocked: never pop over the island picker or a modal the visitor is reading ----
  function modalOpen(){
    try {
      var g = document.getElementById('islandGate');
      if(g && g.style.display !== 'none' && !g.classList.contains('hide') && g.offsetParent !== null) return true;
      return ['privacyModal','installModal','disclaimerModal'].some(function(id){ var el = document.getElementById(id); return !!(el && el.classList.contains('on')); });
    } catch(e){ return true; }
  }
  function sheetOpen(){ var s = document.getElementById('sheet'); return !!(s && s.classList.contains('on')); }

  function srcLine(a){
    var who = a.src === 'staff' ? 'GoHawaii' : a.srcName;
    var when = a.src === 'hta' ? 'posted ' + A.hst(a.sent, true) : A.until(a);
    return who + ' · ' + when;
  }
  // A weather alert is named by its own last word (Warning, Watch, Advisory, Statement), the terms
  // state staff and forecasters use. GoHawaii and HTA posts are advisories.
  function kicker(a){
    if(a.src === 'nws'){ var w = String(a.title || '').trim().split(/\s+/).pop(); return w || 'Alert'; }
    return 'Advisory';
  }
  function sampleTag(a){ return a.sample ? ' <span class="gha-sample">Sample</span>' : (a.preview ? ' <span class="gha-sample">Preview</span>' : ''); }

  // ---- top bar: the GoHawaii button in the strip, and the advisory bar under it ----
  function strip(){
    var s = document.getElementById('publicBrandStrip'); if(!s) return;
    var btn = document.getElementById('ghaHubBtn');
    if(!btn){
      btn = document.createElement('button'); btn.type = 'button'; btn.id = 'ghaHubBtn';
      btn.setAttribute('aria-label', 'Open the GoHawaii page for today');
      btn.addEventListener('click', function(e){ e.stopPropagation(); openHub(); });
      // The strip is too narrow at phone width for three items; OceanSafety's credit moves to the
      // GoHawaii page footer.
      Array.prototype.forEach.call(s.children, function(c, i){ if(i > 0) c.style.display = 'none'; });
      s.appendChild(btn);
      s.style.cursor = 'pointer';
      s.addEventListener('click', function(){ openHub(); });
    }
    var L = list().filter(function(a){ return a.level !== 'info'; });
    var col = L.length ? (L[0].level === 'red' ? '#f87171' : '#fbbf24') : '#5f92a8';
    btn.innerHTML = '<span class="gha-dot" style="background:' + col + '"></span>Today' + ICON.chev;
  }
  function bar(){
    var tb = document.getElementById('topbar'); if(!tb) return;
    var L = list().filter(function(a){ return a.level !== 'info'; });
    var el = document.getElementById('ghaBar');
    if(!L.length){ if(el){ el.remove(); resize(); } return; }
    var a = L[0];
    if(!el){
      el = document.createElement('button'); el.type = 'button'; el.id = 'ghaBar';
      el.addEventListener('click', function(){ if(tsuAlert()) tsuOpen(); else openHub(); });
      var s = document.getElementById('publicBrandStrip');
      if(s && s.nextSibling) tb.insertBefore(el, s.nextSibling); else tb.appendChild(el);
    }
    el.className = 'gha-lv-' + a.level;
    el.innerHTML = '<span class="gha-ic">' + ICON.warn + '</span><span class="gha-t">' + esc(a.title) + ' · ' + esc(A.until(a)) + '</span>'
      + (L.length > 1 ? '<span class="gha-more">+' + (L.length - 1) + ' more</span>' : '') + ICON.chev;
    resize();
  }
  function resize(){ try { if(window.map && map.invalidateSize) setTimeout(function(){ map.invalidateSize(); }, 60); } catch(e){} }

  // ---- red: full screen, one at a time, until acknowledged this visit ----
  function redQueue(){ return list().filter(function(a){ return a.level === 'red' && !ss('gha_ack_' + a.id); }); }
  function showRed(){
    if(document.getElementById('ghaRed')) return true;
    var q = redQueue(); if(!q.length) return false;
    var a = q[0];
    var w = document.createElement('div'); w.id = 'ghaRed'; w.setAttribute('role', 'alertdialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'ghaRedT');
    var txt = a.src === 'nws' ? (a.headline ? a.headline + '\n\n' : '') + a.body : a.body;
    var tsu = isTsu(a); if(tsu) tsuLoad(isl());
    w.innerHTML = '<div class="gha-card"><div class="gha-head"><div class="gha-kicker">' + ICON.warn + esc(kicker(a)) + ' · ' + esc(a.src === 'staff' ? 'GoHawaii' : a.srcName) + sampleTag(a) + '</div>'
      + '<h2 id="ghaRedT">' + esc(a.title) + '</h2><div class="gha-sub">' + esc(A.islandNames(a.islands)) + ' · ' + esc(A.until(a)) + '</div></div>'
      + '<div class="gha-body">'
      + (a.where ? '<div class="gha-where"><b>Where:</b> ' + esc(a.where) + '</div>' : '')
      + (txt ? '<div class="gha-txt">' + esc(txt) + '</div>' : '')
      + (a.instruction ? '<div class="gha-txt" style="margin-top:12px"><b>What to do:</b> ' + esc(a.instruction) + '</div>' : '')
      + (a.demo ? '<p class="gha-fine" style="text-align:left;margin-top:12px">This is a sample tsunami warning for the review build. It is not real.</p>'
        : a.sample ? '<p class="gha-fine" style="text-align:left;margin-top:12px">This is a sample posted from the GoHawaii Dashboard review build. It is not a real advisory.</p>' : '')
      + '</div><div class="gha-foot">' + (tsu ? '<button type="button" class="gha-ok gha-way">Show the way out</button><button type="button" class="gha-ok gha-ok2">I understand</button>' : '<button type="button" class="gha-ok">I understand</button>')
      + (a.link ? '<div class="gha-fine"><a href="' + esc(a.link) + '" target="_blank" rel="noopener">Full details from ' + esc(a.src === 'staff' ? 'GoHawaii' : a.srcName) + '</a></div>' : '')
      + '<div class="gha-fine">Always follow lifeguards and posted signs.</div></div></div>';
    document.body.appendChild(w);
    A.markSeen(a.id);
    var ok = w.querySelector('.gha-ok:not(.gha-way)'), way = w.querySelector('.gha-way');
    ok.addEventListener('click', function(){
      ss('gha_ack_' + a.id, '1'); w.remove();
      if(!showRed()) setTimeout(pops, 400);
    });
    if(way) way.addEventListener('click', function(){ ss('gha_ack_' + a.id, '1'); w.remove(); tsuOpen(); });
    try { (way || ok).focus(); } catch(e){}
    return true;
  }

  // ---- yellow: one pop per advisory per visit. Then, at most one featured pop per visit ----
  function popCard(cls, kick, title, sub, primary, secondary, onP, onS){
    var p = document.createElement('div'); p.id = 'ghaPop'; p.className = cls; p.setAttribute('role', 'dialog'); p.setAttribute('aria-live', 'polite');
    p.innerHTML = '<div class="gha-kicker">' + kick + '</div><b>' + title + '</b><div class="gha-sub">' + sub + '</div>'
      + '<div class="gha-row"><button type="button" class="gha-s">' + secondary + '</button><button type="button" class="gha-p">' + primary + '</button></div>';
    document.body.appendChild(p);
    p.querySelector('.gha-p').addEventListener('click', function(){ p.remove(); onP(); });
    p.querySelector('.gha-s').addEventListener('click', function(){ p.remove(); if(onS) onS(); });
  }
  function pops(){
    if(document.getElementById('ghaRed') || document.getElementById('ghaPop')) return;
    if(modalOpen()) return;
    var y = list().filter(function(a){ return a.level === 'yellow' && !ss('gha_pop_' + a.id); })[0];
    if(y){
      ss('gha_pop_' + y.id, '1'); A.markSeen(y.id);
      popCard('gha-lv-yellow', ICON.warn + esc(kicker(y)) + ' · ' + esc(y.src === 'staff' ? 'GoHawaii' : y.srcName) + sampleTag(y),
        esc(y.title), esc(A.islandNames(y.islands)) + ' · ' + esc(A.until(y)), 'See details', 'Got it',
        function(){ openHub(); }, function(){ setTimeout(pops, 600); });
      return;
    }
    var f = feats()[0];
    if(f && !ss('gha_featpop') && !sheetOpen()){
      ss('gha_featpop', '1');
      var sub = [f.when ? dayLabel(f.when) : '', f.venue || ''].filter(Boolean).join(' · ') || A.islandNames(f.islands);
      popCard('gha-lv-info', ICON.star + 'Featured by GoHawaii' + sampleTag(f), esc(f.title), esc(sub), 'Take a look', 'Not now',
        function(){ openFeature(f); });
    }
  }

  // ---- the GoHawaii page ----
  function dayLabel(iso){ try { return (typeof _ghDayLabel === 'function') ? _ghDayLabel(iso) : iso; } catch(e){ return iso; } }
  function today(){ try { return (typeof _ghToday === 'function') ? _ghToday() : new Date().toISOString().slice(0,10); } catch(e){ return ''; } }
  function addDays(iso, n){ var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); }
  function gh(){ return window._GH_INDEX || {}; }
  function imgOk(u){ return u && String(u).indexOf('https://www.gohawaii.com/') === 0; }

  function advCard(a){
    var lv = a.level;
    var more = [];
    if(a.src === 'nws' && a.headline) more.push(a.headline);
    if(a.body) more.push(a.body);
    if(a.instruction) more.push('What to do: ' + a.instruction);
    return '<div class="gha-card-a gha-lv-' + lv + '"><span class="gha-ic">' + (lv === 'info' ? ICON.info : ICON.warn) + '</span><div style="flex:1;min-width:0">'
      + '<div class="gha-t">' + esc(a.title) + sampleTag(a) + '</div>'
      + '<div class="gha-m">' + esc(srcLine(a)) + (a.boaters ? ' · for boaters' : '') + '</div>'
      + (a.where ? '<div class="gha-w"><b>Where:</b> ' + esc(a.where.length > 220 ? a.where.slice(0, 217) + '...' : a.where) + '</div>' : '')
      + (more.length ? '<details><summary>Details</summary><div style="white-space:pre-line;margin-top:6px">' + esc(more.join('\n\n')) + '</div>'
          + (a.link ? '<div style="margin-top:6px"><a href="' + esc(a.link) + '" target="_blank" rel="noopener" style="color:var(--lv)">Open the source</a></div>' : '') + '</details>' : '')
      + (isTsu(a) ? '<button type="button" class="gha-waybtn" onclick="event.stopPropagation();ghTsuOpen()">' + ICON.up + 'Show the way out</button>' : '')
      + '</div></div>';
  }
  // A failed or missing source is said first and in amber, whatever else is on the list, so a
  // short list never reads as the whole story and an empty one never reads as an all-clear.
  function advSection(){
    var L = list(), ok = A.last.nwsOk, okH = A.last.htaOk;
    var h = '<div class="slbl">Advisories</div>';
    var amber = ' style="background:#fef3c7;color:#78350f"';
    var nwsDown = ok === false ? '<div class="gha-empty"' + amber + '>We could not reach the National Weather Service just now, so weather warnings may be missing here. Check weather.gov/hfo before you head out.</div>' : '';
    if(L.length) return h + nwsDown + L.map(advCard).join('');
    if(ok === null && okH === null) return h + '<div class="gha-empty">Checking the National Weather Service and the Hawaiʻi Tourism Authority now.</div>';
    if(ok === false) return h + nwsDown + (okH === false ? '<div class="gha-empty">We could not reach the Hawaiʻi Tourism Authority for travel updates either.</div>' : '');
    if(ok === null) return h + '<div class="gha-empty">Still checking the National Weather Service for ' + esc(islName()) + '.' + (okH === false ? ' We could not reach the Hawaiʻi Tourism Authority for travel updates.' : '') + '</div>';
    var at = A.hst(new Date(A.last.nwsAt || Date.now()).toISOString());
    var careful = ' The ocean can still change fast: check the beach verdicts below and swim near a lifeguard.';
    if(okH === null) return h + '<div class="gha-empty">No National Weather Service alerts for ' + esc(islName()) + ' as of ' + esc(at) + '. Still checking the Hawaiʻi Tourism Authority.' + careful + '</div>';
    if(okH === false) return h + '<div class="gha-empty">No National Weather Service alerts for ' + esc(islName()) + ' as of ' + esc(at) + '. We could not reach the Hawaiʻi Tourism Authority for travel updates.' + careful + '</div>';
    return h + '<div class="gha-empty">No advisories from the National Weather Service or the Hawaiʻi Tourism Authority for ' + esc(islName()) + ' as of ' + esc(at) + '. The ocean can still change fast: check the beach verdicts below and swim near a lifeguard.</div>';
  }
  // score() has no 'red': below the yellow line it returns 'hidden', which the app reads as not
  // recommended. 'hidden' with "Conditions Unavailable" means no live surf: never counted as a
  // verdict either way.
  function verdicts(){
    var n = { green:0, yellow:0, red:0, nodata:0, calm:[] };
    if(typeof B === 'undefined' || typeof scored === 'undefined') return n;
    B.forEach(function(b){
      if(b.warning_only) return;
      var r = scored[b.id]; if(!r) return;
      var s = r.status === 'hidden' ? (r.reason === 'Conditions Unavailable' ? 'nodata' : 'red') : r.status;
      if(n[s] === undefined) return; n[s]++; if(s === 'green') n.calm.push(b);
    });
    return n;
  }
  function beachSection(){
    try {
      if(typeof B === 'undefined' || typeof scored === 'undefined') return '';
      var n = verdicts(), calm = n.calm;
      if(n.nodata && !n.green && !n.yellow && !n.red) return '<div class="slbl">Beaches today</div><div class="gha-empty" style="background:#fef3c7;color:#78350f">Live surf data is unavailable right now, so there are no beach verdicts. Check with lifeguards before you swim.</div>';
      if(!n.green && !n.yellow && !n.red) return '';
      calm.sort(function(a, b){ var ca = scored[a.id]._c || {}, cb = scored[b.id]._c || {}; return (ca.es || 0) - (cb.es || 0); });
      var chips = ['green','yellow','red','nodata'].filter(function(k){ return n[k]; }).map(function(k){ return '<span><i style="background:' + VCOL[k] + '"></i>' + n[k] + ' ' + VERDICT[k].toLowerCase() + '</span>'; }).join('');
      var rows = calm.slice(0, 3).map(function(b){
        return '<div class="gha-li" onclick="openSheet(\'' + esc(b.id) + '\')"><span class="gha-ico" style="background:#e8f5ec;color:#15803d"><i style="width:10px;height:10px;border-radius:50%;background:' + VCOL.green + ';display:block"></i></span><span class="gha-x"><b>' + esc(b.name) + '</b><span>' + esc(b.r) + ' · ' + VERDICT.green + '</span></span>' + ICON.chev + '</div>';
      }).join('');
      return '<div class="slbl">Beaches today</div><div class="gha-verd">' + chips + '</div>' + rows
        + '<div style="font-size:11.5px;color:var(--mute,#64748b);margin-top:2px">Our verdicts from live surf and wind. A calmer beach can still have rip currents; swim near a lifeguard.</div>';
    } catch(e){ return ''; }
  }
  function openFeature(f){
    closeHub();
    if(f.ref && gh()[f.ref] && typeof openGhSheet === 'function'){ openGhSheet(f.ref); return; }
    if(f.link) window.open(f.link, '_blank', 'noopener');
  }
  window._ghaOpenFeature = function(id){ var f = feats().filter(function(x){ return x.id === id; })[0]; if(f) openFeature(f); };
  function featSection(){
    var F = feats(); if(!F.length) return '';
    return '<div class="slbl">Featured by GoHawaii</div>' + F.slice(0, 3).map(function(f){
      var g = f.ref ? gh()[f.ref] : null, img = (g && g.img) || f.img;
      var sub = [f.when ? dayLabel(f.when) : '', f.venue || '', f.body || ''].filter(Boolean).join(' · ');
      // A photo band only when there is a photo; otherwise the tag sits in the text block.
      var tag = '<span class="gha-ftag">' + ICON.star + esc(f.sub || 'Featured') + '</span>';
      return '<div class="gha-feat" onclick="_ghaOpenFeature(\'' + esc(f.id) + '\')">'
        + (imgOk(img) ? '<div class="gha-fimg" style="background-image:url(\'' + esc(img).replace(/'/g, '%27') + '\'),linear-gradient(135deg,#0f4c5c,#1a7a8a)">' + tag + '</div>' : '')
        + '<div class="gha-fb">' + (imgOk(img) ? '' : tag.replace('gha-ftag', 'gha-ftag gha-ftag-in')) + '<b>' + esc(f.title) + sampleTag(f) + '</b>' + (sub ? '<span>' + esc(sub.length > 160 ? sub.slice(0, 157) + '...' : sub) + '</span>' : '') + '</div></div>';
    }).join('');
  }
  function eventSection(){
    var t = today(); if(!t) return '';
    var end = addDays(t, 6), taken = {};
    feats().forEach(function(f){ if(f.ref) taken[f.ref] = 1; });
    var ev = Object.keys(gh()).map(function(k){ return gh()[k]; })
      .filter(function(g){ return g.type === 'event' && g.when && g.when >= t && g.when <= end && !taken[g.id]; })
      .sort(function(a, b){ return a.when < b.when ? -1 : a.when > b.when ? 1 : 0; }).slice(0, 6);
    if(!ev.length) return '';
    return '<div class="slbl">Events this week</div>' + ev.map(function(g){
      return '<div class="gha-li" onclick="_ghaGo(\'' + esc(g.id) + '\')"><span class="gha-ico">' + ICON.cal + (imgOk(g.img) ? '<img src="' + esc(g.img) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '') + '</span>'
        + '<span class="gha-x"><b>' + esc(g.name) + '</b><span>' + esc(dayLabel(g.when)) + (g.venue ? ' · ' + esc(g.venue) : (g.r ? ' · ' + esc(g.r) : '')) + '</span></span>' + ICON.chev + '</div>';
    }).join('');
  }
  window._ghaGo = function(id){ closeHub(); if(typeof openGhSheet === 'function') openGhSheet(id); };

  var hubOn = false;
  function hubHtml(){
    var d = '';
    try { d = new Date().toLocaleDateString('en-US', { timeZone:'Pacific/Honolulu', weekday:'long', month:'long', day:'numeric' }); } catch(e){}
    return '<div class="gha-hub"><div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0f4c5c">GoHawaii</div>'
      + '<h2>Today on ' + esc(islName()) + '</h2><div class="gha-date">' + esc(d) + ' · Hawaiʻi time</div>'
      + advSection() + beachSection() + featSection() + eventSection()
      + '<div class="gha-fine">Weather advisories come from the National Weather Service and travel updates from the Hawaiʻi Tourism Authority, credited on each card. GoHawaii posts its own notices here. Beach verdicts by Ocean Safe. Always follow lifeguards and posted signs.</div></div>';
  }
  function openHub(){
    var sc = document.getElementById('sc'), sh = document.getElementById('sheet'), ov = document.getElementById('overlay');
    if(!sc || !sh) return;
    var p = document.getElementById('ghaPop'); if(p) p.remove();
    sc.style.display = ''; sc.innerHTML = hubHtml(); sc.dataset.gha = 'hub'; sc.scrollTop = 0;
    sh.classList.add('on', 'sheet-poi'); if(ov) ov.classList.add('on');
    hubOn = true;
    list().forEach(function(a){ if(a.level === 'info') A.markSeen(a.id); });
  }
  function closeHub(){ if(typeof closeSheet === 'function') closeSheet(); hubOn = false; }
  function hubRefresh(){
    var sc = document.getElementById('sc');
    if(sc && sc.dataset.gha === 'hub' && sheetOpen()){ var y = sc.scrollTop; sc.innerHTML = hubHtml(); sc.scrollTop = y; }
    else if(sc && sc.dataset.gha === 'hub' && !sheetOpen()){ delete sc.dataset.gha; }
  }
  window.ghOpenHub = openHub;

  // ---- beach card: the advisories that apply to this beach, first thing under the photo ----
  window._ghAdvBeach = function(b){
    try {
      if(!b) return '';
      var L = list().filter(function(a){
        if(a.level === 'info' || a.boaters) return false;
        if(a.src === 'staff' && a.beaches && a.beaches.length) return a.beaches.indexOf(b.id) >= 0;
        return true;
      });
      if(!L.length) return '';
      css();
      return '<div style="margin:12px 0 4px" onclick="event.stopPropagation()">' + L.slice(0, 3).map(function(a){
        return '<div class="gha-card-a gha-lv-' + a.level + '" onclick="ghOpenHub()"><span class="gha-ic">' + ICON.warn + '</span><div style="flex:1;min-width:0">'
          + '<div class="gha-t">' + esc(a.title) + sampleTag(a) + '</div><div class="gha-m">' + esc(srcLine(a)) + '</div>'
          + (a.where && a.src !== 'nws' ? '<div class="gha-w">' + esc(a.where) + '</div>' : '')
          + (isTsu(a) ? '<button type="button" class="gha-waybtn" onclick="event.stopPropagation();ghTsuOpen(\'' + esc(b.id) + '\')">' + ICON.up + esc(tsuBeachLabel(b.id)) + '</button>' : '')
          + '</div></div>';
      }).join('') + (L.length > 3 ? '<div style="font-size:12px;color:var(--mute)">+' + (L.length - 3) + ' more on the GoHawaii page</div>' : '') + '</div>';
    } catch(e){ return ''; }
  };

  // ---- map: a ring on each beach a GoHawaii advisory names ----
  var rings = [];
  window._ghAdvPins = function(){
    try {
      rings.forEach(function(m){ m.remove(); }); rings = [];
      if(!window.map || typeof L === 'undefined' || typeof B === 'undefined') return;
      if(window._activeTab && window._activeTab !== 'beaches') return;
      list().forEach(function(a){
        if(a.src !== 'staff' || !a.beaches || !a.beaches.length || a.level === 'info') return;
        a.beaches.forEach(function(id){
          var b = B.filter(function(x){ return x.id === id; })[0]; if(!b) return;
          var m = L.marker([b.lat, b.lon], { zIndexOffset: 5000, keyboard: false, title: a.title,
            icon: L.divIcon({ className: '', iconSize: [0, 0], iconAnchor: [0, 0], html: '<div class="gha-ring gha-lv-' + a.level + '"></div>' }) });
          m.on('click', function(){ if(typeof openSheet === 'function') openSheet(b.id); });
          m.addTo(map); rings.push(m);
        });
      });
    } catch(e){}
  };

  // ---- tsunami: the evacuation zone and a walking way out, full screen ----
  // Opens only for a Tsunami Warning (an NWS name from the fixed list, never a pattern) or the
  // ?gh_demo=tsunami sample. The zones and a route from every beach are built ahead of time by
  // scripts/build-tsunami-routes.mjs into /gh/tsunami/<island>.js, loaded as a script so the service
  // worker keeps a copy when the network jams. A Tsunami Advisory keeps its full-screen card and gets
  // no map: its action is to leave the water, not the zone. The extreme zone is drawn, never routed:
  // the feed does not say when officials call for it.
  var TSU_BUILD = '2026-09-19-tsu1';
  function isTsu(a){ return !!a && a.level === 'red' && (a.demo === true || (a.src === 'nws' && a.title === 'Tsunami Warning')); }
  function tsuAlert(){ return list().filter(isTsu)[0] || null; }
  var tsuWait = {};
  function tsuLoad(slug, cb){
    var have = window.GH_TSU && window.GH_TSU[slug];
    if(have){ if(cb) cb(have); return; }
    (tsuWait[slug] = tsuWait[slug] || []).push(cb || function(){});
    if(document.getElementById('ghTsuJs-' + slug)) return;
    var s = document.createElement('script'); s.id = 'ghTsuJs-' + slug; s.src = '/gh/tsunami/' + slug + '.js?b=' + TSU_BUILD;
    s.onload = s.onerror = function(){
      var d = window.GH_TSU && window.GH_TSU[slug], w = tsuWait[slug] || []; tsuWait[slug] = [];
      if(!d) s.remove();                                   // let a later open try again
      w.forEach(function(f){ try { f(d || null); } catch(e){} });
    };
    document.head.appendChild(s);
  }
  function pip(g, lat, lon){                              // even-odd over every ring, so holes count
    var P = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates], c = false;
    for(var i = 0; i < P.length; i++) for(var j = 0; j < P[i].length; j++){
      var r = P[i][j];
      for(var k = 0, m = r.length - 1; k < r.length; m = k++){
        var xi = r[k][0], yi = r[k][1], xj = r[m][0], yj = r[m][1];
        if((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c;
      }
    }
    return c;
  }
  function meters(a, b){ var dx = (a[1] - b[1]) * 111320 * Math.cos(a[0] * Math.PI / 180), dy = (a[0] - b[0]) * 111320; return Math.sqrt(dx * dx + dy * dy); }
  function fmtD(m){ return m < 1000 ? Math.max(10, Math.round(m / 10) * 10) + ' m' : (m / 1000).toFixed(1) + ' km'; }
  function fmtT(s){ var m = Math.max(1, Math.round(s / 60)); return m < 60 ? 'about ' + m + ' min walk' : 'about ' + Math.floor(m / 60) + ' hr ' + (m % 60 ? m % 60 + ' min ' : '') + 'walk'; }
  function tsuBeachLabel(id){
    var d = window.GH_TSU && window.GH_TSU[isl()], r = d && d.routes[id];
    return r && r.d ? 'Way out from here: ' + fmtD(r.d) + ' walk' : 'Show the way out';
  }

  var T = { map: null, zl: null, rl: null, pick: '', me: null, slug: '', data: null, msg: '' };
  function tsuClose(){
    var w = document.getElementById('ghTsu'); if(w) w.remove();
    if(T.map){ try { T.map.remove(); } catch(e){} } T.map = null; T.rl = null;
    document.removeEventListener('keydown', tsuKey);
  }
  function tsuKey(e){ if(e.key === 'Escape') tsuClose(); }
  function tsuOpen(beachId){
    css();
    var a = tsuAlert();
    if(T.slug !== isl()){ T.slug = isl(); T.pick = ''; T.data = null; }
    if(beachId){ T.pick = beachId; T.me = null; }
    else if(!T.pick) T.pick = ss('ght_pick_' + T.slug) || '';
    if(!beachId && !T.me && window._userLocation) T.me = [window._userLocation.lat, window._userLocation.lon];
    T.msg = '';
    tsuClose();
    var w = document.createElement('div'); w.id = 'ghTsu'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'ghTsuT');
    w.innerHTML = '<div class="ght-bar">' + ICON.warn + '<div class="ght-t"><b id="ghTsuT">' + esc(a ? a.title : 'Tsunami Warning') + ' · ' + esc(islName()) + '</b>'
      + '<span class="ght-s">Leave the red zone now' + (a && a.sample ? ' <span class="gha-sample">Sample</span>' : '') + '</span></div>'
      + '<button type="button" class="ght-x" aria-label="Close the evacuation map">' + ICON.x + '</button></div>'
      + '<div id="ghTsuMap"></div>'
      + '<div class="ght-leg"><span><i class="ght-sw"></i>Evacuation zone: leave now</span><span><i class="ght-sw x"></i>Extreme zone: only if officials say so</span></div>'
      + '<div class="ght-sheet"><div class="ght-pick"><select aria-label="Your beach"><option value="">Pick your beach</option></select>'
      + '<button type="button" class="ght-loc">' + ICON.loc + 'My location</button></div><div class="ght-body"><div class="gha-empty">Loading the evacuation map...</div></div></div>';
    document.body.appendChild(w);
    w.querySelector('.ght-x').addEventListener('click', tsuClose);
    document.addEventListener('keydown', tsuKey);
    var sel = w.querySelector('select');
    sel.addEventListener('change', function(){ T.pick = sel.value; T.me = null; T.msg = ''; ss('ght_pick_' + T.slug, T.pick); tsuDraw(); });
    w.querySelector('.ght-loc').addEventListener('click', tsuLocate);
    try { w.querySelector('.ght-x').focus(); } catch(e){}
    tsuLoad(T.slug, function(d){
      if(!document.getElementById('ghTsu')) return;
      if(!d){ w.querySelector('.ght-body').innerHTML = tsuFail(); return; }
      T.data = d;
      Object.keys(d.routes).map(function(id){ return [id, d.routes[id].n]; })
        .sort(function(x, y){ return x[1].localeCompare(y[1]); })
        .forEach(function(r){ var o = document.createElement('option'); o.value = r[0]; o.textContent = r[1]; sel.appendChild(o); });
      tsuDraw();
    });
  }
  function tsuFail(){
    return '<div class="ght-st"><div class="ght-ic">' + ICON.up + '</div><div><h3>Go inland and uphill now</h3><p>The evacuation map could not load. Leave the beach and move away from the ocean. Follow police, sirens, and posted signs.</p></div></div>' + tsuShake();
  }
  function tsuLocate(){
    var b = document.querySelector('#ghTsu .ght-body');
    if(!navigator.geolocation){ T.msg = 'This browser cannot share your location. Pick your beach instead.'; tsuDraw(); return; }
    if(b) b.insertAdjacentHTML('afterbegin', '<div class="gha-empty" id="ghtFinding">Finding your location...</div>');
    navigator.geolocation.getCurrentPosition(function(pos){
      T.me = [pos.coords.latitude, pos.coords.longitude]; T.msg = '';
      window._userLocation = { lat: T.me[0], lon: T.me[1] };
      tsuDraw();
    }, function(){ T.msg = 'We could not get your location. Pick your beach instead.'; tsuDraw(); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }
  // From a location inside the zone: walk to the nearest point of any saved beach route, then follow
  // it out. Scored as the walk there (straight line, plus 30% for streets) and the rest of the route.
  // No network needed, so it still works when the router or the cell network is down.
  function tsuJoin(me){
    var R = T.data.routes, best = null;
    Object.keys(R).forEach(function(id){
      var L = R[id].line; if(!L) return;
      var rem = new Array(L.length); rem[L.length - 1] = 0;
      for(var i = L.length - 2; i >= 0; i--) rem[i] = rem[i + 1] + meters(L[i], L[i + 1]);
      for(var j = 0; j < L.length; j++){
        var dm = meters(me, L[j]); if(dm > 500) continue;
        var tot = dm * 1.3 + rem[j];
        if(!best || tot < best.tot) best = { tot: tot, dm: dm, rem: rem[j], line: L.slice(j) };
      }
    });
    if(!best) return null;
    var st = best.dm >= 15 ? [['Walk to the blue route', fmtD(best.dm)], ['Follow it out of the zone', fmtD(best.rem)]] : [['Follow the blue route out of the zone', fmtD(best.rem)]];
    return { n: '', a: me, line: best.line, d: best.dm + best.rem, s: best.tot / 1.35, st: st };
  }
  // Where the visitor is, and what to tell them. A location wins over a picked beach; a location
  // more than 40 km from every beach on this island is not on it, so the beach list is used.
  function tsuState(){
    var d = T.data, R = d.routes;
    if(T.me){
      var nd = 1e9;
      Object.keys(R).forEach(function(id){ var r = R[id], m = meters(T.me, r.a || r.ll); if(m < nd) nd = m; });
      if(nd > 40000){ T.me = null; T.msg = 'Your location is not on ' + islName() + '. Pick a beach to see its way out.'; }
      else {
        if(pip(d.zone, T.me[0], T.me[1])) return { k: 'me-in', row: tsuJoin(T.me) };
        if(pip(d.extreme, T.me[0], T.me[1])) return { k: 'me-x' };
        return { k: 'me-out' };
      }
    }
    if(T.pick && R[T.pick]) return { k: R[T.pick].line ? 'beach' : 'beach-none', row: R[T.pick] };
    return { k: 'none' };
  }
  function tsuShake(){ return '<div class="ght-shake">' + ICON.shake + '<span><b>Felt shaking or saw the ocean pull back?</b> Go inland now. Do not wait for an alert.</span></div>'; }
  function tsuSrc(){
    var a = tsuAlert(), right;
    if(a && a.demo) right = '<b class="stale">Sample</b>';
    else if(A.last.nwsOk === false) right = '<b class="stale">Weather service not reached</b>';
    else right = '<b>Checked ' + esc(A.hst(new Date(A.last.nwsAt || Date.now()).toISOString())) + '</b>';
    return '<div class="ght-src"><span>National Weather Service. Zones: State of Hawaiʻi. Routes: OpenStreetMap.</span>' + right + '</div>';
  }
  function tsuWay(r, from){
    var long = r.d > 2000 ? '<p class="ght-tip">That is a long way on foot. If you came by car, drive this way inland now.</p>' : '';
    return '<div class="ght-way"><div class="ght-wh">Nearest way out<span>' + fmtD(r.d) + ' · ' + fmtT(r.s) + '</span></div>'
      + '<div class="ght-from">' + esc(from) + '</div><ol>'
      + r.st.map(function(s, i){ return '<li><i>' + (i + 1) + '</i>' + esc(s[0]) + '<b>' + esc(s[1]) + '</b></li>'; }).join('')
      + '<li class="end"><i>' + (r.st.length + 1) + '</i>Out of the zone. Keep going inland if you can.</li></ol></div>' + long;
  }
  function tsuStatus(ic, cls, h, p){ return '<div class="ght-st"><div class="ght-ic ' + cls + '">' + ic + '</div><div><h3>' + h + '</h3><p>' + p + '</p></div></div>'; }
  var TALL = '<p class="ght-tip">Cannot get out in time? Go to the 4th floor or higher of a concrete building 10 or more stories tall.</p>';
  function tsuDraw(){
    var d = T.data, Lf = window.L, w = document.getElementById('ghTsu'); if(!d || !Lf || !w) return;
    if(!T.map){
      T.map = Lf.map('ghTsuMap', { zoomControl: false, attributionControl: true, zoomSnap: 0.5 });
      (typeof osBasemap === 'function' ? osBasemap() : Lf.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri' })).addTo(T.map);
      T.map.attributionControl.setPrefix(false).addAttribution('Zones: State of Hawaiʻi · Routes: © OpenStreetMap');
      Lf.geoJSON({ type: 'Feature', geometry: d.extreme }, { interactive: false, style: { color: '#c2410c', weight: 2, dashArray: '6 5', fillColor: '#f59e0b', fillOpacity: .14 } }).addTo(T.map);
      T.zl = Lf.geoJSON({ type: 'Feature', geometry: d.zone }, { interactive: false, style: { color: '#b91c1c', weight: 2, fillColor: '#dc2626', fillOpacity: .4 } }).addTo(T.map);
      T.rl = Lf.layerGroup().addTo(T.map);
    }
    var st = tsuState(), r = st.row, h = T.msg ? '<div class="gha-empty">' + esc(T.msg) + '</div>' : '';
    var sel = w.querySelector('select'); if(sel) sel.value = T.me ? '' : (T.pick || '');
    if(st.k === 'me-in') h += tsuStatus(ICON.up, '', 'You are in the evacuation zone', 'Leave now. Go inland and uphill, away from the ocean. Follow police, sirens, and posted signs.')
      + (r ? tsuWay(r, 'From where you are') : '<p class="ght-tip">The red area on the map is the zone. Head for the nearest road that leaves it, inland and uphill.</p>') + TALL;
    else if(st.k === 'me-x') h += tsuStatus(ICON.pin, 'amber', 'You are in the extreme zone', 'Only the red zone has to leave for this warning. Be ready to move farther inland if officials call for the extreme zone.');
    else if(st.k === 'me-out') h += tsuStatus(ICON.pin, 'gray', 'You are outside the mapped zone', 'Stay here unless officials tell you to move. Do not go to the coast to watch, and keep roads clear for people leaving.')
      + '<p class="ght-tip">The zone is the minimum distance, not a guarantee. Wait for the all clear.</p>';
    else if(st.k === 'beach') h += tsuStatus(ICON.up, '', esc(r.n) + ' is in the evacuation zone', 'Leave now. Follow the blue route, then keep going inland.') + tsuWay(r, 'From ' + r.n) + TALL;
    else if(st.k === 'beach-none') h += tsuStatus(ICON.up, '', 'Leave ' + esc(r.n) + ' now', 'We have no saved route from this beach. Go inland and uphill, away from the ocean, and follow police and posted signs.');
    else h += tsuStatus(ICON.pin, 'gray', 'Where are you?', 'Pick your beach above, or use your location, to see the nearest way out of the zone.');
    w.querySelector('.ght-body').innerHTML = h + tsuShake() + tsuSrc();

    T.rl.clearLayers();
    var pts = [];
    function flag(ll, txt, col){
      return Lf.marker(ll, { interactive: false, keyboard: false, icon: Lf.divIcon({ className: '', iconSize: [0, 0], html:
        '<div style="position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">'
        + '<div style="background:' + col + ';color:#fff;font:800 11px \'DM Sans\',sans-serif;padding:3px 7px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3)">' + esc(txt) + '</div>'
        + '<div style="width:12px;height:12px;border-radius:50%;background:' + col + ';border:3px solid #fff;margin-top:3px;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div></div>' }) });
    }
    if(r && r.line){
      var line = r.line, a0 = r.a || r.ll;
      if(meters(a0, line[0]) > 5) Lf.polyline([a0, line[0]], { color: '#2563eb', weight: 4, dashArray: '2 8', lineCap: 'round' }).addTo(T.rl);
      Lf.polyline(line, { color: '#fff', weight: 10, opacity: .95, lineCap: 'round', lineJoin: 'round' }).addTo(T.rl);
      Lf.polyline(line, { color: '#2563eb', weight: 6, lineCap: 'round', lineJoin: 'round' }).addTo(T.rl);
      if(st.k === 'beach') flag(a0, r.n, '#0f4c5c').addTo(T.rl);
      flag(line[line.length - 1], 'Out of zone', '#15803d').addTo(T.rl);
      pts = pts.concat([a0], line);
    } else if(r){ flag(r.ll, r.n, '#0f4c5c').addTo(T.rl); pts.push(r.ll); }
    if(T.me){
      Lf.marker(T.me, { interactive: false, keyboard: false, zIndexOffset: 1000, icon: Lf.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 10],
        html: '<div style="width:20px;height:20px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 7px rgba(37,99,235,.25),0 2px 6px rgba(0,0,0,.35)"></div>' }) }).addTo(T.rl);
      pts.push(T.me);
    }
    T.map.invalidateSize();
    var sh = w.querySelector('.ght-sheet'), leg = w.querySelector('.ght-leg');
    // The padding clears the legend and the sheet, plus a flag's label, which sits above its point
    // and runs up to about 80 px either side of it.
    var pad = { paddingTopLeft: [80, (leg ? leg.offsetHeight + 16 : 60) + 36], paddingBottomRight: [80, (sh ? sh.offsetHeight : 300) + 16], maxZoom: 17 };
    if(pts.length > 1) T.map.fitBounds(Lf.latLngBounds(pts), pad);
    else if(pts.length) T.map.setView(pts[0], 15);
    else T.map.fitBounds(T.zl.getBounds(), pad);
  }
  window.ghTsuOpen = tsuOpen;

  // ---- run ----
  function paint(){ css(); strip(); bar(); try { window._ghAdvPins(); } catch(e){} hubRefresh(); if(tsuAlert()) tsuLoad(isl()); }
  var hubTries = 0;
  function autoHub(){
    if(ss('gha_hub_auto')) return;
    if(document.getElementById('ghaRed') || document.getElementById('ghaPop')) { if(++hubTries < 40) setTimeout(autoHub, 1500); return; }
    if(modalOpen() || sheetOpen()){ if(++hubTries < 40) setTimeout(autoHub, 1500); return; }
    try { if(typeof _islandSignalExplicit === 'function' && !_islandSignalExplicit()) return; } catch(e){}
    ss('gha_hub_auto', '1'); openHub();
  }
  var popTries = 0;
  function afterFeeds(){
    paint();
    if(modalOpen()){ if(++popTries < 60) setTimeout(afterFeeds, 1500); return; }
    if(!showRed()) pops();
    setTimeout(autoHub, 900);
  }
  function tick(){ A.refresh().then(function(r){ feeds.nws = r.nws; feeds.hta = r.hta; paint(); if(!showRed()) pops(); }); }
  // Inside the GoHawaii Dashboard (same origin, in an iframe) the app hands the parent its own beach
  // verdict counts once scoring is done, so the Dashboard shows the app's numbers, never a copy of
  // its rules. ?gh_probe=1 is a hidden iframe that only does this: no pop-ups, no page, no strip.
  var PROBE = (function(){ try { return new URLSearchParams(location.search).get('gh_probe') === '1'; } catch(e){ return false; } })();
  function postVerdicts(){
    try {
      if(window.parent === window) return;
      // Wait until the counts hold still across two reads: the first paint can score on the
      // snapshot before live surf lands.
      var tries = 0, last = '', same = 0;
      (function wait(){
        var n = verdicts(), key = [n.green, n.yellow, n.red, n.nodata].join('/');
        same = (key === last && n.green + n.yellow + n.red + n.nodata > 0) ? same + 1 : 0; last = key;
        if(same < 2 && ++tries < 50){ setTimeout(wait, 700); return; }
        window.parent.postMessage({ type: 'gh-verdicts', island: isl(), green: n.green, yellow: n.yellow, red: n.red, nodata: n.nodata, at: Date.now() }, location.origin);
      })();
    } catch(e){}
  }
  function start(){
    postVerdicts();
    if(PROBE) return;
    css(); strip();
    // Staff posts need no feed: show them now, then again as each feed lands.
    afterFeeds();
    A.refresh(function(r){ feeds.nws = r.nws; feeds.hta = r.hta; afterFeeds(); });
    setInterval(tick, 10 * 60 * 1000);
    // A post from the Dashboard in another tab of this browser lands here at once.
    window.addEventListener('storage', function(e){ if(e.key === A.KEY){ paint(); if(!showRed()) pops(); } });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
