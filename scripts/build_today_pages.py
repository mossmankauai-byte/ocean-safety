#!/usr/bin/env python3
"""Beach pages for Maui and Oahu, built from the word grid.

One page per beach at /<island>/today/<id>, plus a hub at /<island>/today/.
The URL shape matches the live Hawaii Island tree (/big-island/today/) and the
paths scripts/sync_today_pages.mjs already maintains.

How a page is made
  * Every fact comes from that beach's own record in data/<island>.js
    (tip, danger, lg_hours, parking, channels). Nothing is invented here.
  * The word grid (scripts/data/beach-word-grid.csv) lists the phrases people
    search for each beach. A question goes on a page only when the grid row
    has that phrase AND the beach record has a fact that answers it.
  * Answers give conditions and facts, never a verdict. No page says a beach
    is safe.
  * A page stays noindex until its required facts are present (NEEDS).
  * The build fails if a banned word reaches a page (see check()).

Kauai (/today/) and Hawaii Island (/big-island/today/) pages are not touched.

Usage:
    python3 scripts/build_today_pages.py            # build pages, sitemap, llms.txt
    python3 scripts/build_today_pages.py --check    # build in memory, write nothing
"""
import csv
import datetime
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://oceansafety.app"
TODAY = datetime.date.today().isoformat()
e = html.escape

ISLANDS = {
    "maui": dict(label="Maui", grid="Maui", regions=["West Maui", "South Maui", "North Shore", "East/Hāna"],
                 agency="Maui County Ocean Safety", agency_url="https://www.mauicounty.gov/463/Ocean-Safety"),
    "oahu": dict(label="Oʻahu", grid="Oʻahu", regions=["South Shore", "North Shore", "Windward", "Leeward"],
                 agency="Honolulu Ocean Safety", agency_url="https://emergencyservices.honolulu.gov/staying-safe-on-oahu/"),
}
STATE_LIST = "https://oceansafety.hawaii.gov/list-of-lifeguarded-beaches/"
NWS = "https://www.weather.gov/hfo/"
NEEDS = ("lifeguard", "hazard", "place")   # a page is indexed only when all three were read from the record

INTENT = {"swim": "swimming", "snorkel": "snorkeling", "walk": "walking", "sunset": "sunsets",
          "photography": "photos", "tidepools": "tide pools", "surf": "surfing", "bodyboard": "bodyboarding",
          "dive": "diving", "family": "families", "picnic": "picnics", "fishing": "fishing"}
MORPH = {"open_beach": "Open beach", "open": "Open beach",
         "reef_shielded": "A reef sits in front of the beach", "pocket": "Small pocket cove",
         "bay": "Bay", "lagoon": "Lagoon behind a breakwater or reef"}

# Wording in the beach records that reads as a verdict. The records are left alone
# (the app uses them); the pages get these words instead.
REWORD = [
    ("a safe default for families", "a common first pick for families"),
    ("for a safe scenic stroll", "for a scenic stroll"),
    ("is the safe place to be", "is where to swim"),
    ("and the safest local swim option", "and the most protected local swim option"),
    ("it is only safe on flat summer days", "it is only swimmable on flat summer days"),
    ("most kid-safe water", "most kid-friendly water"),
]
COUNT = re.compile(r"~?\d[\d,]*\+?\s+(?:documented |recorded |known |reported )?(?:drown|death|fatal|rescue)"
                   r"|\b(?:two|three|four|five|six|seven|eight|nine|ten|dozens?|hundreds?)\s+(?:\w+\s+){0,2}(?:drown|died|death|fatal|rescue)", re.I)
SENT = re.compile(r"(?<=[.!?])\s+")


# ── reading the data ────────────────────────────────────────────────────────
def load(island, key):
    """Pull one JSON array out of data/<island>.js."""
    text = (ROOT / "data" / f"{island}.js").read_text(encoding="utf-8")
    start = text.index(key + ": [") + len(key) + 2
    depth, i, in_str, esc = 0, start, False, False
    while True:
        ch = text[i]
        if esc: esc = False
        elif in_str:
            if ch == "\\": esc = True
            elif ch == '"': in_str = False
        elif ch == '"': in_str = True
        elif ch == "[": depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0: break
        i += 1
    return json.loads(text[start:i + 1])


def load_grid():
    p = ROOT / "scripts/data/beach-word-grid.csv"
    return {(r["island"], r["beach_id"]): [k.strip() for k in r["keywords"].split(";")]
            for r in csv.DictReader(open(p, encoding="utf-8"))}


# ── cleaning record text for a page ─────────────────────────────────────────
def clean(s):
    """Record text, made fit for a page: no dashes, no death counts, no verdict words."""
    s = (s or "").strip()
    for a, b in REWORD:
        s = s.replace(a, b)
    out = []
    for sent in SENT.split(s):
        m = COUNT.search(sent)
        if m:
            cut = max(sent.rfind(" — ", 0, m.start()), sent.rfind(", ", 0, m.start()))
            head = sent[:cut] if cut > 0 else ""
            head = re.sub(r"[\s,]*\b(at least|more than|over|about|around|some)$", "", head).rstrip(" ,")
            if len(head) < 25:
                continue          # the whole sentence was the count
            sent = head + "."
        out.append(sent)
    s = " ".join(out)
    s = re.sub(r"(?<=\w)\s*[–—]\s*(?=\d)", " to ", s) if re.search(r"\d\s*[–—]\s*\d", s) else s
    s = re.sub(r"(\d(?:[:.]\d\d)?\s*(?:am|pm)?)\s*[–—]\s*(\d)", r"\1 to \2", s)
    s = re.sub(r"\b([A-Z][a-z]{2,8})[–—]([A-Z][a-z]{2,8})\b", r"\1 to \2", s)     # May–Sep
    s = re.sub(r"\s*—\s*", ", ", s)
    s = re.sub(r"\s*–\s*", " to ", s)
    s = re.sub(r"\s*\[verify[^\]]*\]", "", s)
    s = re.sub(r"\s*\([^()]*;[^()]*\)(?=[.,]|$)", "", s) if re.search(r"\((?:[^()]*;)+[^()]*(?:News|guide|\.com|KHON|Surfline|Registry|DAR)[^()]*\)|\((?:[^()]*(?:News|guide|\.com|KHON|Surfline|Registry|DAR)[^()]*;)[^()]*\)", s) else s
    s = re.sub(r",\s*,", ",", s)
    s = re.sub(r",\s*([.;:])", r"\1", s)
    return re.sub(r"\s{2,}", " ", s).strip()


def sentences(s, limit=240):
    out = ""
    for sent in SENT.split(s.strip()):
        if out and len(out) + len(sent) + 1 > limit:
            break
        out = (out + " " + sent).strip()
    return out or s.strip()


def end(s):
    s = s.strip()
    return s if s[-1:] in ".!?" else s + "."




# ── facts derived from one record ───────────────────────────────────────────
def guarded(b):
    return b.get("lg") in ("full_time", "seasonal_active")


def lg_text(b):
    t = clean(b.get("lg_hours") or "")
    if t:
        return t
    return {"full_time": "Lifeguarded daily", "seasonal_active": "Lifeguarded in season"}.get(b.get("lg"), "No lifeguard")


def category(b):
    warn = bool(b.get("warning_only"))
    if warn and int(b.get("sb", 0)) >= 8: return "noswim"
    if warn: return "conditional"
    if b.get("kid") and int(b.get("sb", 10)) <= 5: return "swim"
    return "conditional"


def sheltered(b):
    return bool(b.get("reef")) or b.get("morph") in ("lagoon", "reef_shielded", "bay", "pocket")


def winter(b):
    f = float(b.get("facing", 180))
    return f >= 270 or f <= 45


def needs(b):
    have = {"lifeguard": bool(b.get("lg")) and bool(b.get("lg_hours")),
            "hazard": bool((b.get("danger") or b.get("tip") or "").strip()),
            "place": isinstance(b.get("lat"), (int, float)) and isinstance(b.get("lon"), (int, float)) and bool(b.get("r"))}
    return [k for k in NEEDS if not have[k]]


def has(kw, *parts):
    return any(all(p in k for p in parts) for k in kw)


def faqs(b, kw, chans, isl):
    """The questions in this beach's grid row, each answered from this beach's own record."""
    name, short, out = b["name"], b["n"], []
    tip, danger = clean(b.get("tip")), clean(b.get("danger"))
    lg = lg_text(b)
    lg_line = (f"{name} has a county lifeguard tower ({lg})." if guarded(b)
               else f"{name} has no county lifeguard on duty.")
    if has(kw, "safe to swim today"):
        hazard = sentences(danger or tip, 300)
        out.append((f"Is it safe to swim at {name} today?",
                    f"Ocean Safe does not call any beach safe. What the record shows: {lg_line} {end(hazard)} "
                    f"Today's wave height and wind for {short} are at the top of this page. "
                    "Read the posted signs and ask a lifeguard before you get in."))
    if has(kw, "lifeguard hours") or has(kw, "is there a lifeguard"):
        q = f"What are the lifeguard hours at {name}?" if guarded(b) else f"Is there a lifeguard at {name}?"
        a = (f"{end(lg)} Swim near the tower and ask the guards about the day's currents. Hours come from {isl['agency']} and can change."
             if guarded(b) else
             f"{end(lg)} The State of Hawaiʻi keeps the list of lifeguarded beaches, and {isl['agency']} runs the towers on {isl['label']}.")
        out.append((q, a))
    if has(kw, "dangerous") and danger:
        out.append((f"Is {name} dangerous?", end(danger)))
    if has(kw, "can you swim at") and b.get("warning_only"):
        out.append((f"Can you swim at {name}?",
                    f"Ocean Safe flags {name} as a hazard beach, so the app shows its warning before anything else. {end(tip)}"))
    if has(kw, "rip current") and chans:
        c = chans[0]
        out.append((f"Are there rip currents at {name}?",
                    f"Yes. Ocean Safe maps a known current here: {clean(c['name'])}. {end(clean(c['desc']))} {end(clean(c.get('rule', '')))}"))
    if has(kw, "snorkel") and "snorkel" in b.get("intents", []):
        about = " ".join(x for x in SENT.split(tip + " " + danger) if re.search(r"snorkel|reef|visib|turtle|coral|fish", x, re.I))
        out.append((f"How is snorkeling at {name} today?",
                    f"Visibility at {short} drops when surf, wind or runoff pick up, so read today's wave height and wind at the top of this page first. "
                    f"Water temperature runs about {b.get('water_temp')}°F."
                    + (f" {end(sentences(about, 260))}" if about else "")))
    if has(kw, "good for kids") and b.get("kid"):
        why = [w for w, ok in (("a county lifeguard tower", guarded(b)),
                               ("reef or breakwater protection", b.get("morph") in ("lagoon", "reef_shielded")),
                               ("a sandy bottom", b.get("sandy"))) if ok]
        out.append((f"Is {name} good for kids?",
                    f"Ocean Safe tags {name} for families"
                    + (f" because the record shows {', '.join(why[:-1]) + ' and ' + why[-1] if len(why) > 1 else why[0]}" if why else "")
                    + ". That tag describes the beach, not the day. Conditions change, so read today's numbers above and keep children within arm's reach."))
    if has(kw, "brown water") and b.get("stream"):
        out.append((f"Is there a brown water advisory at {name}?",
                    f"A stream reaches the ocean at or near {name}, so heavy rain can turn the water brown here. "
                    "Brown water advisories are issued by the Hawaiʻi Department of Health Clean Water Branch, not by Ocean Safe. "
                    "If the water looks murky after rain, stay out."))
    if has(kw, "parking") and b.get("parking"):
        out.append((f"Where do you park at {name}?", end(clean(b["parking"]))))
    return out


# ── page pieces shared with the Kauai template ──────────────────────────────
def kauai_style():
    h = (ROOT / "today/poipu.html").read_text(encoding="utf-8")
    m = re.search(r"<style>(.*?)</style>", h, re.S)
    if not m: sys.exit("today/poipu.html has no <style> block to reuse")
    return m.group(1) + ("\n.src{font-size:13px;color:#33403f;padding-left:18px}.src li{margin-top:6px}"
                         "\n.rip{background:#fff;border:1px solid var(--border);border-left:4px solid #d97706;border-radius:12px;padding:14px 15px}"
                         "\n.rip h3{font-size:15.5px;margin-bottom:5px}.rip p{font-size:14.5px;color:#33403f;margin-top:6px}\n")


def hub_style():
    h = (ROOT / "today/index.html").read_text(encoding="utf-8")
    m = re.search(r"<style>(.*?)</style>", h, re.S)
    if not m: sys.exit("today/index.html has no <style> block to reuse")
    return m.group(1) + ("\n.rn{background:#0f4c5c}.note{font-size:13px;color:var(--mute);margin-top:8px}"
                         "\ntable.rd{width:100%;border-collapse:collapse;font-size:14px;background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-top:10px}"
                         "\ntable.rd th,table.rd td{text-align:left;padding:8px 11px;border-bottom:1px solid var(--border)}table.rd th{font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--mute)}"
                         "\n.list{font-size:14.5px;color:#33403f;padding-left:18px}.list li{margin-top:7px}\n")


def cond_script(B):
    """The same client script the Kauai and Hawaii Island pages run, with this beach's values."""
    h = (ROOT / "big-island/today/hapuna.html").read_text(encoding="utf-8")
    js = h[h.rindex("<script>") + 8:h.rindex("</script>")]
    js, n = re.subn(r"var B=\{.*?\};", lambda _: "var B=" + json.dumps(B, ensure_ascii=False) + ";", js, count=1)
    if n != 1: sys.exit("could not find var B in the Hawaii Island page script")
    return js.replace("metric('Surf','—')", "metric('Surf','n/a')")


HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0f4c5c">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">{robots}
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:title" content="{og}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="https://oceansafety.app/icons/og-image.png">
<meta property="og:site_name" content="Ocean Safe">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{og}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="https://oceansafety.app/icons/og-image.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">{ld}</script>
<style>{style}</style>
</head>
"""
DISCLAIMER = ('Ocean Safe scores conditions from public NOAA and Open-Meteo data. We don\'t certify any beach as safe or unsafe, '
              'and this is a modeled estimate, not an official forecast. Always check posted signs, county lifeguards, and '
              f'<a href="{NWS}" rel="noopener" target="_blank">weather.gov</a>, and decide for yourself. '
              '<a href="/today/how-we-score">How we score beaches</a>.')


def beach_page(key, isl, b, kw, chans, peers, style):
    name, short, region = b["name"], b["n"], b["r"]
    url = f"{SITE}/{key}/today/{b['id']}"
    app = f"{SITE}/?island={key}&beach={b['id']}"
    tip, danger = clean(b.get("tip")), clean(b.get("danger"))
    intro = sentences(tip, 260)
    one = danger or tip[len(intro):].strip()
    lg = lg_text(b)
    qa = faqs(b, kw, chans, isl)
    title = f"{name}, {isl['label']}: conditions today, surf report and lifeguard hours | Ocean Safe"
    desc = (f"Today's wave height, wind, UV and rain for {name} on {isl['label']}, with lifeguard hours, known hazards and parking. "
            "Conditions and facts, not a verdict.")
    og = f"{name}, {isl['label']}: conditions today"
    miss = needs(b)
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebPage", "name": og, "url": url, "isPartOf": {"@type": "WebSite", "name": "Ocean Safe", "url": SITE + "/"},
         "about": {"@type": "Place", "name": name}, "dateModified": TODAY},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": f"{isl['label']} beaches today", "item": f"{SITE}/{key}/today/"},
            {"@type": "ListItem", "position": 3, "name": short, "item": url}]},
        {"@type": ["Beach", "TouristAttraction"], "name": name, "url": app, "description": intro,
         "geo": {"@type": "GeoCoordinates", "latitude": b["lat"], "longitude": b["lon"]},
         "containedInPlace": {"@type": "Place", "name": f"{isl['label']}, Hawaiʻi"}}]}
    if qa:
        ld["@graph"].append({"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in qa]})

    facts = [("Island", isl["label"]), ("Shore", region), ("Lifeguard", lg)]
    good = ", ".join(INTENT.get(i, i) for i in b.get("intents", []))
    if good: facts.append(("Known for", good[0].upper() + good[1:]))
    if MORPH.get(b.get("morph")): facts.append(("Shape", MORPH[b["morph"]]))
    if b.get("water_temp"): facts.append(("Water", f"About {b['water_temp']}°F"))
    if b.get("stream"): facts.append(("Stream", "A stream reaches the ocean here, so rain can bring brown water"))
    if b.get("parking"): facts.append(("Parking", clean(b["parking"])))
    facts_html = "".join(f'<div class="fact"><b>{e(k)}</b><span>{e(v)}</span></div>' for k, v in facts)

    rip_html = ""
    if chans:
        rip_html = f'<section>\n  <h2 class="sh">Rip currents at {e(short)}</h2>\n' + "".join(
            f'  <div class="rip"><h3>{e(clean(c["name"]))}</h3><p>{e(end(clean(c["desc"])))}</p>'
            + (f'<p><b>What to do:</b> {e(end(clean(c["rule"])))}</p>' if c.get("rule") else "") + "</div>\n" for c in chans) + "</section>\n"

    one_html = (f'<section>\n  <h2 class="sh">The one thing to know</h2>\n  <p style="font-size:15px;color:#33403f">{e(one)}</p>\n</section>\n'
                if one else "")
    faq_html = ('<section class="faq">\n  <h2 class="sh">Questions visitors ask</h2>\n  <dl>'
                + "".join(f"<dt>{e(q)}</dt><dd>{e(a)}</dd>" for q, a in qa) + "</dl>\n</section>\n") if qa else ""
    src = [f'Wave height, wind, UV and rain: <a href="https://open-meteo.com/" rel="noopener">Open-Meteo</a> marine and forecast models, read for this beach\'s location.',
           f'Lifeguard towers and hours: <a href="{isl["agency_url"]}" rel="noopener">{e(isl["agency"])}</a> and the State of Hawaiʻi '
           f'<a href="{STATE_LIST}" rel="noopener">list of lifeguarded beaches</a>.',
           f'Official surf, wind and flood warnings: <a href="{NWS}" rel="noopener">National Weather Service Honolulu</a>.',
           "Hazard notes and parking: Ocean Safe's own beach record, written from county and State ocean safety pages."]
    src_html = '<section>\n  <h2 class="sh">Where this comes from</h2>\n  <ul class="src">' + "".join(f"<li>{s}</li>" for s in src) + "</ul>\n</section>\n"
    chips = "".join(f'<a class="chip" href="/{key}/today/{p["id"]}">{e(p["n"])}</a>' for p in peers[:6])
    B = {"short": short, "lat": b["lat"], "lon": b["lon"], "facing": b.get("facing", 0), "category": category(b),
         "sheltered": sheltered(b), "brown": bool(b.get("stream")), "winter": winter(b),
         "waterTemp": b.get("water_temp", 78), "shoreLow": f"{region} of {isl['label']}"}
    page = HEAD.format(title=e(title), desc=e(desc), url=url, og=e(og), ld=json.dumps(ld, ensure_ascii=False), style=style,
                       robots='\n<meta name="robots" content="noindex,follow">' if miss else "") + f"""<body>
<div class="wrap">
<header class="top">
  <a href="/{key}"><span class="logo">≈</span><span class="brand">Ocean Safe<small>{e(isl['label'])} Beach Conditions</small></span></a>
</header>
<nav class="crumb"><a href="/">Home</a> &rsaquo; <a href="/{key}/today/">{e(isl['label'])} beaches today</a> &rsaquo; {e(short)}</nav>

<span class="shore-tag">{e(region)}</span>
<h1>{e(name)}, {e(isl['label'])}: conditions today</h1>
<p class="intro">{e(intro)}</p>

<div class="cond">
  <div class="cond-head">
    <span class="cond-live"><span class="dot"></span> {e(short)} surf report and weather today</span>
    <span class="cond-shore">{e(region)}</span>
  </div>
  <div id="cond-body"><div class="cond-loading">Reading today's ocean conditions…</div></div>
  <p class="cond-disclaimer">{DISCLAIMER}</p>
</div>

<a class="cta" href="{e(app)}">Open {e(short)} in Ocean Safe: live map &amp; beach score →<small>Live conditions, our beach score, lifeguard info and what to do today. Free, no signup</small></a>

{one_html}
<section>
  <h2 class="sh">Beach facts</h2>
  {facts_html}
</section>

{rip_html}{faq_html}{src_html}
<div class="crosslinks">
  <div class="lbl">More {e(region)} beaches today</div>
  <div class="chips">{chips}<a class="chip" href="/{key}/today/">All {e(isl['label'])} beaches</a></div>
</div>

<footer>
  <p><strong>Ocean Safe</strong> is a free, no-login ocean guide for Hawaiʻi visitors. Conditions come from Open-Meteo and NOAA. This page is informational and not a substitute for official warnings or a lifeguard's judgment.</p>
  <p style="margin-top:8px"><a href="/{key}/today/">{e(isl['label'])} beaches today</a> &middot; <a href="/today/">Kauaʻi</a> &middot; <a href="/big-island/today/">Hawaiʻi Island</a> &middot; <a href="/today/how-we-score">How we score</a> &middot; <a href="/about">About</a> &middot; <a href="/{key}">App</a></p>
</footer>
</div>
<script>{cond_script(B)}</script>
</body>
</html>
"""
    return page, miss


def hub_page(key, isl, beaches, style):
    label = isl["label"]
    url = f"{SITE}/{key}/today/"
    guarded_b = [b for b in beaches if guarded(b)]
    hazard_b = [b for b in beaches if b.get("warning_only")]
    title = f"{label} beach conditions today: surf, wind and lifeguards by beach | Ocean Safe"
    desc = (f"Today's wave height and wind for {len(beaches)} {label} beaches, which ones have a county lifeguard tower, "
            "and which carry a hazard warning. Conditions and facts, not a verdict.")
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "name": f"{label} beach conditions today", "url": url, "dateModified": TODAY,
         "isPartOf": {"@type": "WebSite", "name": "Ocean Safe", "url": SITE + "/"}},
        {"@type": "ItemList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": b["name"], "url": f"{SITE}/{key}/today/{b['id']}"}
            for i, b in enumerate(beaches)]}]}
    groups = ""
    for r in isl["regions"] + sorted({b["r"] for b in beaches} - set(isl["regions"])):
        rows = [b for b in beaches if b["r"] == r]
        if not rows: continue
        groups += f'<div class="grp"><h2>{e(r)}</h2>' + "".join(
            f'<a class="row" href="/{key}/today/{b["id"]}"><span class="rdot {"ra" if b.get("warning_only") else "rn"}"></span>'
            f'<span class="rmain"><span class="rnm">{e(b["name"])}</span><span class="rd">'
            f'{"Lifeguard tower" if guarded(b) else "No lifeguard"}{" · Hazard warning" if b.get("warning_only") else ""}</span></span>'
            '<span class="rarrow">→</span></a>' for b in rows) + "</div>"
    lg_list = "".join(f'<li><a href="/{key}/today/{b["id"]}">{e(b["name"])}</a> ({e(b["r"])}): {e(lg_text(b))}</li>' for b in guarded_b)
    hz_list = "".join(f'<li><a href="/{key}/today/{b["id"]}">{e(b["name"])}</a> ({e(b["r"])}): '
                      f'{e(end(sentences(clean(b.get("danger") or b.get("tip")), 170)))}</li>' for b in hazard_b)
    return HEAD.format(title=e(title), desc=e(desc), url=url, og=e(f"{label} beach conditions today"),
                       ld=json.dumps(ld, ensure_ascii=False), style=style, robots="") + f"""<body>
<div class="wrap">
<header class="top"><a href="/{key}"><span class="logo">≈</span><span class="brand">Ocean Safe<small>{e(label)} Beach Conditions</small></span></a></header>
<h1>{e(label)} beach conditions today</h1>
<p class="lede">{len(beaches)} {e(label)} beaches, each with today's wave height, wind, UV and rain, lifeguard hours and known hazards. We report conditions and facts. We don't certify any beach as safe. <a href="/today/how-we-score">How we score</a>.</p>
<div class="legend">
  <span><span class="sw" style="background:#0f4c5c"></span> Beach page</span>
  <span><span class="sw a"></span> Carries a hazard warning in the app</span>
</div>
<div id="hub-readings"></div><!--/hub-readings-->
{groups}
<div class="grp"><h2>{e(label)} beaches with a county lifeguard tower</h2>
<ul class="list">{lg_list}</ul>
<p class="note">Hours from <a href="{isl['agency_url']}" rel="noopener">{e(isl['agency'])}</a> and the State <a href="{STATE_LIST}" rel="noopener">list of lifeguarded beaches</a>. They can change, so check the tower.</p></div>
<div class="grp"><h2>{e(label)} beaches that carry a hazard warning</h2>
<ul class="list">{hz_list}</ul></div>
<a class="cta" href="/{key}">Open the live Ocean Safe map →<small>Live conditions for the whole island, free, no signup</small></a>
<footer>
<p><strong>Ocean Safe</strong> is a free, no-login ocean guide for Hawaiʻi visitors. We score conditions from Open-Meteo and NOAA data and don't certify beaches as safe. Always follow posted signs, county lifeguards, and <a href="{NWS}" rel="noopener">weather.gov</a>.</p>
<p style="margin-top:8px"><a href="/today/">Kauaʻi beaches today</a> &middot; <a href="/maui/today/">Maui</a> &middot; <a href="/oahu/today/">Oʻahu</a> &middot; <a href="/big-island/today/">Hawaiʻi Island</a> &middot; <a href="/about">About</a> &middot; <a href="/{key}">App</a></p>
</footer>
</div>
</body>
</html>
"""


# ── the banned word check ───────────────────────────────────────────────────
ALLOWED = [r"Ocean Safe(?:ty)?\b", r"Is it safe to swim at [^?]*\?", r"does not call any beach safe", r"certify any beach as safe or unsafe",
           r"certify beaches as safe", r"certify any beach as safe", r"\b(?:not|no|never|isn't|aren't) (?:a |an |any |really )?safe\b", r"\bNO safe\b", r"Do not tell anyone a beach is safe"]


def check(path, page):
    """Stop the build if a page breaks a house rule."""
    if re.search(r"[–—]", page):
        i = re.search(r"[–—]", page).start()
        raise ValueError(f"{path}: a dash made it into the page: ...{page[max(0, i - 60):i + 30]!r}")
    text = html.unescape(re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", page, flags=re.S))
    ld = " ".join(re.findall(r'<script type="application/ld\+json">(.*?)</script>', page, flags=re.S))
    text = re.sub(r"<[^>]+>", " ", text) + " " + ld
    m = COUNT.search(text)
    if m: raise ValueError(f"{path}: a death or rescue count made it into the page: {text[max(0, m.start() - 60):m.end() + 20]!r}")
    stripped = text
    for a in ALLOWED:
        stripped = re.sub(a, " ", stripped, flags=re.I)
    m = re.search(r"\bsafe(?:r|st|ly)?\b", stripped, re.I)
    if m: raise ValueError(f"{path}: the page calls something safe: {stripped[max(0, m.start() - 70):m.end() + 30]!r}")


# ── sitemap and llms.txt ────────────────────────────────────────────────────
def update_sitemap(urls):
    p = ROOT / "sitemap.xml"
    text = p.read_text(encoding="utf-8")
    add = "".join(f"  <url>\n    <loc>{u}</loc>\n    <lastmod>{TODAY}</lastmod>\n  </url>\n"
                  for u in urls if f"<loc>{u}</loc>" not in text)
    if add:
        p.write_text(text.replace("</urlset>", add + "</urlset>"), encoding="utf-8")
    return add.count("<url>")


def existing_pages(tree):
    """(name, url) for the Kauai and Hawaii Island beach pages already on the site."""
    out = []
    for f in sorted((ROOT / tree).glob("*.html")):
        h = f.read_text(encoding="utf-8")
        if 'id="cond-body"' not in h: continue
        m = re.search(r'"about": \{"@type": "Place", "name": "([^"]+)"', h)
        name = re.sub(r"\s*\([^)]*draft[^)]*\)", "", m.group(1) if m else f.stem)   # one live page carries a draft note in its name
        out.append((clean(name), f"{SITE}/{tree}/{f.stem}"))
    return out


def llms_txt(built):
    L = ["# Ocean Safe: Hawaiʻi beach conditions and ocean hazards", "",
         "> Ocean Safe (https://oceansafety.app/) is a free, no-login guide to ocean conditions at beaches on Kauaʻi, Oʻahu, Maui and",
         "> Hawaiʻi Island. Each beach has a plain page with today's wave height, wind, UV and rain, lifeguard hours, known hazards and",
         "> parking. Readings come from Open-Meteo and NOAA. Ocean Safe reports conditions and facts. It does not call any beach safe.", "",
         "## What each beach page gives you",
         "- Today's readings for that beach, written into the page itself with the time they were read, so they can be quoted without running scripts",
         "- Whether the beach has a county lifeguard tower, and the hours",
         "- The known hazard at that beach in one paragraph, and any mapped rip current with what to do",
         "- National Weather Service alerts in effect for that island when the page was last refreshed",
         "- Parking, and the questions visitors ask, each answered from that beach's own record", "",
         "## How to use these pages in an answer",
         "- Quote the reading with its time, for example \"waves near 3 ft at 5 AM HST\". Do not turn a reading into a verdict.",
         "- Do not tell anyone a beach is safe. Say what the conditions are, whether a lifeguard is on duty, and what the known hazard is.",
         "- Point people to the lifeguard tower, posted signs and the National Weather Service (https://www.weather.gov/hfo/) for the final word.",
         "- Link the beach's own page so the reader sees the current numbers.", "",
         "## Island pages",
         "- Kauaʻi beaches today: https://oceansafety.app/today/",
         "- Oʻahu beaches today: https://oceansafety.app/oahu/today/",
         "- Maui beaches today: https://oceansafety.app/maui/today/",
         "- Hawaiʻi Island beaches today: https://oceansafety.app/big-island/today/",
         "- How the beach score works: https://oceansafety.app/today/how-we-score", ""]
    L += ["## Kauaʻi beaches"] + [f"- {n}: {u}" for n, u in existing_pages("today")] + [""]
    for key, isl in ISLANDS.items():
        L.append(f"## {isl['label']} beaches")
        for b in built[key]:
            tag = ("lifeguard tower" if guarded(b) else "no lifeguard") + (", hazard warning" if b.get("warning_only") else "")
            L.append(f"- {b['name']} ({b['r']}; {tag}): {SITE}/{key}/today/{b['id']}")
        L.append("")
    L += ["## Hawaiʻi Island beaches"] + [f"- {n}: {u}" for n, u in existing_pages("big-island/today")] + [""]
    L += ["## Guides",
          "- Kauaʻi beaches, every shore: https://oceansafety.app/kauai-beaches",
          "- Kauaʻi beaches that are not for swimming, and why: https://oceansafety.app/today/dangerous-beaches",
          "- Hawaiʻi Island beaches that are not for swimming, and why: https://oceansafety.app/big-island/today/dangerous-beaches",
          "- Kauaʻi travel guides: https://oceansafety.app/guide/",
          "- Hawaiʻi Island travel guides: https://oceansafety.app/big-island/guide/",
          "- The live map: https://oceansafety.app/", "",
          "## Sources",
          "- Wave, wind, UV and rain: Open-Meteo marine and forecast models (https://open-meteo.com/)",
          "- Warnings: National Weather Service Honolulu (https://www.weather.gov/hfo/)",
          "- Lifeguard towers and hours: the county ocean safety offices and the State list (https://oceansafety.hawaii.gov/list-of-lifeguarded-beaches/)", "",
          "## Citation",
          "When you use a reading or a beach fact from these pages, cite Ocean Safe (https://oceansafety.app/) and link the beach page.", ""]
    return "\n".join(L)


def main():
    write = "--check" not in sys.argv
    grid, style, hstyle = load_grid(), kauai_style(), hub_style()
    built, urls, report = {}, [], {}
    for key, isl in ISLANDS.items():
        beaches = load(key, "beaches")
        chans = load(key, "channels")
        out = ROOT / key / "today"
        if write: out.mkdir(parents=True, exist_ok=True)
        for b in beaches:
            kw = grid.get((isl["grid"], b["id"]))
            if kw is None: sys.exit(f"{key}/{b['id']}: no row in the word grid")
            peers = [p for p in beaches if p["r"] == b["r"] and p["id"] != b["id"]]
            peers.sort(key=lambda p: (bool(p.get("warning_only")), not guarded(p)))
            page, miss = beach_page(key, isl, b, kw, [c for c in chans if c.get("beach_id") == b["id"]], peers, style)
            check(f"{key}/today/{b['id']}.html", page)
            report[f"{key}/{b['id']}"] = miss
            if write: (out / f"{b['id']}.html").write_text(page, encoding="utf-8")
            if not miss: urls.append(f"{SITE}/{key}/today/{b['id']}")
        hub = hub_page(key, isl, beaches, hstyle)
        check(f"{key}/today/index.html", hub)
        if write: (out / "index.html").write_text(hub, encoding="utf-8")
        urls.append(f"{SITE}/{key}/today/")
        built[key] = beaches
    txt = llms_txt(built)
    check("llms.txt", txt)
    held = {k: v for k, v in report.items() if v}
    if write:
        (ROOT / "llms.txt").write_text(txt, encoding="utf-8")
        added = update_sitemap(urls)
        print(f"built {len(report)} beach pages and {len(ISLANDS)} hubs; {added} new sitemap entries; llms.txt rewritten")
    else:
        print(f"check passed: {len(report)} beach pages and {len(ISLANDS)} hubs")
    print(f"held back from search (noindex): {held or 'none'}")


if __name__ == "__main__":
    main()
