/* Ocean Safe — embeddable Kauaʻi ocean-conditions badge.
   <script src="https://oceansafety.app/embed/badge.js" data-beach="hanalei" async></script>
   No dependencies. Conditions from Open-Meteo. Never shows a false "calm". */
(function(){
  var SITE="https://oceansafety.app";
  var DATA={"lydgate": {"name": "Lydgate Beach Park", "lat": 22.0388, "lon": -159.3406, "sheltered": true, "category": "swim"}, "poipu": {"name": "Poʻipū Beach Park", "lat": 21.8726, "lon": -159.4598, "sheltered": true, "category": "swim"}, "anini": {"name": "ʻAnini Beach", "lat": 22.2255, "lon": -159.5012, "sheltered": true, "category": "swim"}, "salt_pond": {"name": "Salt Pond Beach", "lat": 21.9077, "lon": -159.5985, "sheltered": true, "category": "swim"}, "kalapaki": {"name": "Kalapakī Beach", "lat": 21.954, "lon": -159.353, "sheltered": true, "category": "swim"}, "hanalei": {"name": "Hanalei Bay", "lat": 22.2097, "lon": -159.5033, "sheltered": false, "category": "conditional"}, "kee": {"name": "Keʻe Beach", "lat": 22.2244, "lon": -159.5827, "sheltered": true, "category": "conditional"}, "tunnels": {"name": "Tunnels (Mākua)", "lat": 22.2247, "lon": -159.5675, "sheltered": true, "category": "conditional"}, "kealia": {"name": "Keālia Beach", "lat": 22.0936, "lon": -159.3033, "sheltered": false, "category": "conditional"}, "wailua": {"name": "Wailua Beach", "lat": 22.0445, "lon": -159.336, "sheltered": false, "category": "conditional"}, "mahaulepu": {"name": "Māhāʻulepu Beach", "lat": 21.8731, "lon": -159.415, "sheltered": false, "category": "conditional"}, "kekaha": {"name": "Kekaha Beach Park", "lat": 21.9711, "lon": -159.7106, "sheltered": false, "category": "conditional"}, "shipwreck": {"name": "Shipwreck Beach (Keoneloa)", "lat": 21.8651, "lon": -159.4357, "sheltered": false, "category": "conditional"}, "donkey": {"name": "Donkey Beach (Paliku)", "lat": 22.1119, "lon": -159.3092, "sheltered": false, "category": "conditional"}, "queens_bath": {"name": "Queen's Bath", "lat": 22.2272, "lon": -159.4808, "sheltered": false, "category": "noswim"}, "brennecke": {"name": "Brennecke Beach", "lat": 21.8719, "lon": -159.4583, "sheltered": false, "category": "noswim"}, "lumahai": {"name": "Lumahaʻi Beach", "lat": 22.2128, "lon": -159.5395, "sheltered": false, "category": "noswim"}, "secret": {"name": "Secret Beach (Kauapea)", "lat": 22.2197, "lon": -159.4076, "sheltered": false, "category": "noswim"}, "kalihiwai": {"name": "Kalihiwai Bay", "lat": 22.2185, "lon": -159.4302, "sheltered": false, "category": "noswim"}, "polihale": {"name": "Polihale State Park", "lat": 22.081, "lon": -159.7625, "sheltered": false, "category": "noswim"}, "koloa_landing": {"name": "Kōloa Landing", "lat": 21.8775, "lon": -159.4748, "sheltered": true, "category": "noswim"}, "pakala": {"name": "Pakalā (Infinities)", "lat": 21.9305, "lon": -159.6028, "sheltered": false, "category": "noswim"}};
  var S=document.currentScript;
  if(!S){var ss=document.getElementsByTagName('script');for(var i=ss.length-1;i>=0;i--){if((ss[i].src||'').indexOf('badge.js')>-1){S=ss[i];break;}}}
  function qp(n){try{return new URLSearchParams(location.search).get(n)}catch(e){return null}}
  var key=(((S&&S.getAttribute('data-beach'))||qp('beach')||'')+'').toLowerCase();
  var b=DATA[key]||null;
  var ISLAND={lat:22.0964,lon:-159.5261};
  if(!document.getElementById('osb-style')){
    var st=document.createElement('style');st.id='osb-style';
    st.textContent=".osb-card{font-family:'DM Sans',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:340px;border:1px solid #e5e7eb;border-radius:14px;background:#fff;box-shadow:0 6px 20px rgba(15,76,92,.08);overflow:hidden;color:#1c1c1c;line-height:1.4}"+
    ".osb-hd{background:#0f4c5c;color:#fff;padding:10px 14px;display:flex;align-items:center;gap:8px}"+
    ".osb-logo{width:22px;height:22px;border-radius:6px;background:#c9a84c;color:#0f4c5c;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex:none}"+
    ".osb-hd b{font-size:13px;font-weight:700;display:block}.osb-hd span{font-size:10px;opacity:.85;display:block;text-transform:uppercase;letter-spacing:.05em}"+
    ".osb-bd{padding:12px 14px}.osb-nm{font-size:14px;font-weight:700;color:#0f4c5c;margin-bottom:8px}"+
    ".osb-m{display:flex;gap:6px;flex-wrap:wrap}"+
    ".osb-chip{background:#f5ecd7;border:1px solid #e5e7eb;border-radius:9px;padding:6px 9px;text-align:center;min-width:54px;flex:1}"+
    ".osb-chip.w{background:#fef3c7;border-color:#fcd34d}.osb-chip.b{background:#fee2e2;border-color:#fca5a5}"+
    ".osb-v{font-size:15px;font-weight:700;display:block;color:#1c1c1c}.osb-chip.w .osb-v{color:#a16207}.osb-chip.b .osb-v{color:#991b1b}"+
    ".osb-l{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.03em}"+
    ".osb-note{font-size:11px;color:#6b7280;margin:9px 0 0}"+
    ".osb-cta{display:block;text-align:center;background:#0f4c5c;color:#fff!important;text-decoration:none;font-weight:700;font-size:12.5px;border-radius:9px;padding:9px;margin-top:10px}"+
    ".osb-ft{font-size:10px;color:#6b7280;text-align:center;padding:6px 8px;border-top:1px solid #e5e7eb}.osb-ft a{color:#0f4c5c;text-decoration:none;font-weight:600}";
    (document.head||document.documentElement).appendChild(st);
  }
  var link=SITE+'/today/'+(b?key:'');
  var card=document.createElement('div');card.className='osb-card';
  card.innerHTML='<div class="osb-hd"><span class="osb-logo">≈</span><div><b>Ocean Safe</b><span>Live Kauaʻi conditions</span></div></div>'+
    '<div class="osb-bd"><div class="osb-nm">'+(b?b.name:'Kauaʻi today')+'</div>'+
    '<div class="osb-m" id="osb-m">Loading…</div>'+
    '<p class="osb-note" id="osb-note"></p>'+
    '<a class="osb-cta" href="'+link+'" target="_blank" rel="noopener">Full safety report →</a></div>'+
    '<div class="osb-ft">Live Kauaʻi ocean safety by <a href="'+SITE+'/" target="_blank" rel="noopener">Ocean Safe</a></div>';
  if(S&&S.parentNode){S.parentNode.insertBefore(card,S.nextSibling);}else{(document.body||document.documentElement).appendChild(card);}
  var m=card.querySelector('#osb-m'),note=card.querySelector('#osb-note');
  function chip(l,v,c){return '<div class="osb-chip '+(c||'')+'"><span class="osb-v">'+v+'</span><span class="osb-l">'+l+'</span></div>';}
  var lat=b?b.lat:ISLAND.lat,lon=b?b.lon:ISLAND.lon,tz='Pacific/Honolulu';
  var fc='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=wind_speed_10m,uv_index&wind_speed_unit=mph&timezone='+tz;
  var mar='https://marine-api.open-meteo.com/v1/marine?latitude='+lat+'&longitude='+lon+'&current=wave_height&length_unit=imperial&timezone='+tz;
  function fail(){m.innerHTML='';note.innerHTML='Check live conditions and our full beach score before you go in.';}
  Promise.all([fetch(fc).then(function(r){return r.ok?r.json():null}),fetch(mar).then(function(r){return r.ok?r.json():null}).catch(function(){return null})]).then(function(res){
    var f=res[0]&&res[0].current;if(!f){return fail();}
    var mc=res[1]&&res[1].current;var wave=(mc&&mc.wave_height!=null&&!isNaN(mc.wave_height))?Number(mc.wave_height):null;
    var th=(b&&b.sheltered)?[2,4]:[1.5,3];var html='';
    if(wave==null)html+=chip('Surf','—');
    else{var c=wave<th[0]?'':(wave<th[1]?'w':'b');html+=chip('Surf',wave.toFixed(1)+'ft',c);}
    html+=chip('Wind',Math.round(f.wind_speed_10m)+'mph',f.wind_speed_10m>22?'w':'');
    html+=chip('UV',Math.round(f.uv_index),f.uv_index>=8?'b':(f.uv_index>=6?'w':''));
    m.innerHTML=html;
    if(b&&b.category==='noswim'){note.innerHTML='Not a swimming beach. See the report for why, and a calmer nearby option.';}
    else if(wave!=null&&wave>=th[1]){note.innerHTML='Surf is high today. Check the full conditions before entering.';}
    else{note.innerHTML='A modeled estimate. Always check the full report and a lifeguard.';}
  }).catch(fail);
})();
