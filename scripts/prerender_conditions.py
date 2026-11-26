#!/usr/bin/env python3
"""Write today's readings into the beach pages so they can be read without running scripts.

Why: the conditions card on every beach page is filled in by the visitor's
browser. Search and assistant crawlers (OAI-SearchBot, PerplexityBot, ClaudeBot)
do not run scripts, so the only text they get from the card is "Reading today's
ocean conditions". This script asks the same two Open-Meteo services the page
asks, and writes the answer into the page as plain sentences. In a browser the
page's own script still replaces it with live values.

Rules this script keeps
  * Readings and a time stamp only. Never a verdict. A reading stays true as a
    statement about that time; a verdict goes stale.
  * If a reading cannot be fetched, the page goes back to the plain loading line.
    A stale or made up number is never left in place.
  * National Weather Service alerts are listed only when the service returns
    them. The page never says there are no alerts.
  * dateModified and the sitemap lastmod move only for pages that really changed.

Run by .github/workflows/daily-freshness.yml. Usage:
    python3 scripts/prerender_conditions.py            # fetch and write
    python3 scripts/prerender_conditions.py --dry-run  # fetch and report, write nothing
    python3 scripts/prerender_conditions.py --fixture scripts/data/prerender-fixture.json   # no network, for tests
"""
import argparse
import datetime
import html
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://oceansafety.app"
HST = datetime.timezone(datetime.timedelta(hours=-10))
UA = {"User-Agent": "OceanSafe-prerender/1.0", "Accept": "application/geo+json, application/json"}
e = html.escape

# tree on disk -> (island name, words that pick this island's zones out of an NWS alert)
TREES = {
    "today": ("Kauaʻi", ("kauai", "niihau")),
    "oahu/today": ("Oʻahu", ("oahu", "waianae", "koolau", "honolulu", "olomana", "ewa plain")),
    "maui/today": ("Maui", ("maui", "haleakala", "kipahulu", "kahoolawe", "maalaea", "pailolo", "alenuihaha")),
    "big-island/today": ("Hawaiʻi Island", ("big island", "kona", "kohala", "hilo", "puna", "kau", "hamakua", "alenuihaha")),
}
ALERT_WORDS = ("surf", "rip current", "flood", "tsunami", "hurricane", "tropical storm", "storm surge", "wind", "gale",
               "small craft", "marine", "seas", "swell")

FORECAST = ("https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
            "&current=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index"
            "&daily=wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,precipitation_sum"
            "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=Pacific%2FHonolulu&forecast_days=1")
MARINE = ("https://marine-api.open-meteo.com/v1/marine?latitude={lat}&longitude={lon}"
          "&current=wave_height,wave_period&daily=wave_height_max"
          "&length_unit=imperial&timezone=Pacific%2FHonolulu&forecast_days=1")
ALERTS = "https://api.weather.gov/alerts/active?area=HI"

COND_RE = re.compile(r'<div id="cond-body"><div class="cond-(?:loading|static)"[^>]*>.*?</div></div>', re.S)
LOADING = '<div id="cond-body"><div class="cond-loading">Reading today\'s ocean conditions…</div></div>'
HUB_RE = re.compile(r'<div id="hub-readings">.*?</div><!--/hub-readings-->', re.S)
HUB_EMPTY = '<div id="hub-readings"></div><!--/hub-readings-->'
B_RE = re.compile(r"var B=(\{.*?\});")
NAME_RE = re.compile(r'"about": \{"@type": "Place", "name": "([^"]+)"')
MOD_RE = re.compile(r'("dateModified"\s*:\s*")[0-9-]{10}(")')
COMPASS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"]


def get(url, timeout=25):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def fetch_readings(points):
    """points: list of (lat, lon). Returns one dict (or None) per point. Open-Meteo takes many points in one call."""
    out = [None] * len(points)
    for start in range(0, len(points), 40):
        chunk = points[start:start + 40]
        lat = ",".join(f"{p[0]}" for p in chunk)
        lon = ",".join(f"{p[1]}" for p in chunk)
        try:
            fc = get(FORECAST.format(lat=lat, lon=lon))
            mar = get(MARINE.format(lat=lat, lon=lon))
        except Exception as ex:            # one failed call leaves those beaches on the loading line
            print(f"  feed failed for beaches {start} to {start + len(chunk) - 1}: {ex.__class__.__name__}")
            continue
        fc = fc if isinstance(fc, list) else [fc]
        mar = mar if isinstance(mar, list) else [mar]
        if len(fc) != len(chunk) or len(mar) != len(chunk):
            print(f"  feed returned the wrong number of places for beaches {start} to {start + len(chunk) - 1}")
            continue
        for i, (f, m) in enumerate(zip(fc, mar)):
            out[start + i] = reading(f, m)
        time.sleep(1)
    return out


def first(d, k):
    v = (d or {}).get(k)
    return v[0] if isinstance(v, list) and v else None


def reading(f, m):
    """One beach's numbers, or None when the two numbers that matter most are missing."""
    cur, mcur = (f or {}).get("current") or {}, (m or {}).get("current") or {}
    wave, wind = mcur.get("wave_height"), cur.get("wind_speed_10m")
    if wave is None or wind is None:
        return None
    return {"wave": wave, "period": mcur.get("wave_period"), "wind": wind, "gust": cur.get("wind_gusts_10m"),
            "dir": cur.get("wind_direction_10m"), "air": cur.get("temperature_2m"), "uv": cur.get("uv_index"),
            "rain": cur.get("precipitation"), "at": cur.get("time"),
            "wave_max": first((m or {}).get("daily"), "wave_height_max"),
            "wind_max": first((f or {}).get("daily"), "wind_speed_10m_max"),
            "gust_max": first((f or {}).get("daily"), "wind_gusts_10m_max"),
            "uv_max": first((f or {}).get("daily"), "uv_index_max"),
            "rain_sum": first((f or {}).get("daily"), "precipitation_sum")}


def stamp(iso):
    """'2026-11-26T05:00' (Honolulu time from the feed) -> '5:00 AM HST on Thursday, November 26, 2026'."""
    try:
        t = datetime.datetime.fromisoformat(iso)
    except (TypeError, ValueError):
        t = datetime.datetime.now(HST)
    return f"{t.strftime('%I:%M %p').lstrip('0')} HST on {t.strftime('%A, %B')} {t.day}, {t.year}"


def sentences(name, c):
    now = [f"waves near {c['wave']:.1f} ft" + (f" about {c['period']:.0f} seconds apart" if c.get("period") else ""),
           f"wind {c['wind']:.0f} mph" + (f" from the {COMPASS[int((c['dir'] + 22.5) // 45) % 8]}" if c.get("dir") is not None else "")
           + (f" with gusts to {c['gust']:.0f} mph" if c.get("gust") is not None else "")]
    if c.get("air") is not None: now.append(f"air temperature {c['air']:.0f}°F")
    s1 = f"At {name}, the model reading at {stamp(c['at'])} was {', '.join(now)}."
    day = []
    if c.get("wave_max") is not None: day.append(f"waves up to {c['wave_max']:.1f} ft")
    if c.get("wind_max") is not None:
        day.append(f"wind up to {c['wind_max']:.0f} mph" + (f" with gusts to {c['gust_max']:.0f} mph" if c.get("gust_max") is not None else ""))
    if c.get("uv_max") is not None: day.append(f"UV index peaking near {c['uv_max']:.0f}")
    if c.get("rain_sum") is not None: day.append(f"{c['rain_sum']:.2f} in of rain")
    s2 = f"Forecast for the whole day: {', '.join(day)}." if day else ""
    return s1, s2


def fetch_alerts():
    try:
        feats = get(ALERTS).get("features", [])
    except Exception as ex:
        print(f"  NWS alerts not read: {ex.__class__.__name__}")
        return None
    out = []
    for f in feats:
        p = f.get("properties") or {}
        ev = p.get("event") or ""
        if p.get("status") != "Actual" or not any(w in ev.lower() for w in ALERT_WORDS):
            continue
        out.append({"event": ev, "areas": [a.strip() for a in (p.get("areaDesc") or "").split(";") if a.strip()],
                    "ends": p.get("ends") or p.get("expires")})
    return out


def until(iso):
    try:
        t = datetime.datetime.fromisoformat(iso).astimezone(HST)
    except (TypeError, ValueError):
        return ""
    return f" until {t.strftime('%I:%M %p').lstrip('0')} HST {t.strftime('%A')}"


def alert_line(alerts, island, words):
    """One sentence naming NWS alerts whose zones name this island. Empty when none were returned."""
    if not alerts:
        return ""
    seen, bits = set(), []
    for a in alerts:
        zones = [z for z in a["areas"] if any(re.search(r"\b" + w + r"\b", z.lower().replace("ʻ", "").replace("'", "")) for w in words)]
        zones = [z for z in zones if "summit" not in z.lower()]      # mountain summit zones say nothing about a beach
        if not zones or (a["event"], tuple(zones)) in seen:
            continue
        seen.add((a["event"], tuple(zones)))
        bits.append(f"{a['event']}{until(a['ends'])} for {', '.join(zones[:6])}")
    if not bits:
        return ""
    return (f"National Weather Service alerts naming {island} zones when this was read: {'; '.join(bits[:5])}. "
            "Alerts change through the day.")


def block(name, c, alert):
    s1, s2 = sentences(name, c)
    p = 'style="font-size:14.5px;color:#33403f;margin:0 0 7px"'
    return ('<div id="cond-body"><div class="cond-static" data-prerendered="1">'
            f"<p {p}>{e(s1)}</p>" + (f"<p {p}>{e(s2)}</p>" if s2 else "") + (f"<p {p}>{e(alert)}</p>" if alert else "")
            + f'<p {p}>These are model readings from Open-Meteo, not a verdict. Ocean Safe does not call any beach safe. '
            'Live values load in your browser and may differ.</p></div></div>')


def hub_block(island, rows, alert):
    if not rows:
        return HUB_EMPTY
    at = stamp(rows[0][2]["at"])
    def high(c):
        return "%.1f ft" % c["wave_max"] if c.get("wave_max") is not None else ""
    body = "".join('<tr><td><a href="%s">%s</a></td><td>%.1f ft</td><td>%s</td><td>%.0f mph</td></tr>'
                   % (e(href), e(name), c["wave"], high(c), c["wind"]) for name, href, c in rows)
    cell = 'style="text-align:left;padding:7px 10px;border-bottom:1px solid #e5e7eb"'
    body = body.replace("<td>", f"<td {cell}>")
    return ('<div id="hub-readings"><h2 style="font-size:18px;margin:22px 0 4px">'
            f"{e(island)} wave height and wind by beach</h2>"
            f'<p style="font-size:13px;color:#6b7280">Model readings from Open-Meteo at {e(at)}. Readings, not a verdict.</p>'
            + (f'<p style="font-size:14px;color:#33403f;margin-top:6px">{e(alert)}</p>' if alert else "")
            + '<table style="width:100%;border-collapse:collapse;font-size:14px;background:#fff;margin-top:8px">'
            f"<tr><th {cell}>Beach</th><th {cell}>Waves now</th><th {cell}>Waves, day high</th><th {cell}>Wind now</th></tr>"
            f"{body}</table></div><!--/hub-readings-->")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--fixture", help="JSON file with readings and alerts, used in place of the network")
    ap.add_argument("--urls-out", help="write the URLs of pages that changed to this file, one per line")
    args = ap.parse_args()
    today = datetime.datetime.now(HST).date().isoformat()

    pages = []                                       # (tree, path, html, B, name)
    for tree in TREES:
        for p in sorted((ROOT / tree).glob("*.html")):
            h = p.read_text(encoding="utf-8")
            if not COND_RE.search(h):
                continue
            m = B_RE.search(h)
            if not m:
                sys.exit(f"{p}: has a conditions card but no var B. The page template changed; fix this script before it runs again.")
            B = json.loads(m.group(1))
            nm = NAME_RE.search(h)
            name = re.sub(r"\s*\([^)]*draft[^)]*\)", "", nm.group(1)) if nm else B["short"]
            pages.append((tree, p, h, B, name))
    if not pages:
        sys.exit("no beach pages found")

    if args.fixture:
        fx = json.loads(pathlib.Path(args.fixture).read_text(encoding="utf-8"))
        readings = [reading(fx["forecast"], fx["marine"]) for _ in pages]
        alerts = fx.get("alerts")
    else:
        readings = fetch_readings([(x[3]["lat"], x[3]["lon"]) for x in pages])
        alerts = fetch_alerts()

    changed_urls, done, reset, hub_rows = [], 0, 0, {t: [] for t in TREES}
    for (tree, p, h, B, name), c in zip(pages, readings):
        island, words = TREES[tree]
        url = f"{SITE}/{tree}/{p.stem}"
        if c is None:
            new = COND_RE.sub(lambda _: LOADING, h, count=1)
            reset += 1
        else:
            new = COND_RE.sub(lambda _: block(name, c, alert_line(alerts, island, words)), h, count=1)
            new = MOD_RE.sub(rf"\g<1>{today}\g<2>", new)
            hub_rows[tree].append((name, f"/{tree}/{p.stem}", c))
            done += 1
        if new != h:
            changed_urls.append(url)
            if not args.dry_run:
                p.write_text(new, encoding="utf-8")

    for tree, rows in hub_rows.items():
        hub = ROOT / tree / "index.html"
        if not hub.exists():
            continue
        h = hub.read_text(encoding="utf-8")
        if not HUB_RE.search(h):
            continue
        island, words = TREES[tree]
        new = HUB_RE.sub(lambda _: hub_block(island, rows, alert_line(alerts, island, words)), h, count=1)
        if rows:
            new = MOD_RE.sub(rf"\g<1>{today}\g<2>", new)
        if new != h:
            changed_urls.append(f"{SITE}/{tree}/")
            if not args.dry_run:
                hub.write_text(new, encoding="utf-8")

    sm = ROOT / "sitemap.xml"
    if changed_urls and sm.exists() and not args.dry_run:
        text = sm.read_text(encoding="utf-8")
        want = set(changed_urls)

        def bump(m):
            loc = re.search(r"<loc>([^<]+)</loc>", m.group(0))
            if loc and loc.group(1) in want:
                return re.sub(r"<lastmod>[^<]*</lastmod>", f"<lastmod>{today}</lastmod>", m.group(0))
            return m.group(0)
        sm.write_text(re.sub(r"<url>.*?</url>", bump, text, flags=re.S), encoding="utf-8")

    if args.urls_out and not args.dry_run:
        pathlib.Path(args.urls_out).write_text("\n".join(changed_urls) + ("\n" if changed_urls else ""), encoding="utf-8")
    print(f"readings written on {done} pages | put back on the loading line: {reset} | pages changed: {len(changed_urls)}"
          f" | NWS alerts read: {'no' if alerts is None else len(alerts)}")
    if done == 0:
        sys.exit("no page got a reading. Check the Open-Meteo calls.")


if __name__ == "__main__":
    main()
