#!/usr/bin/env python3
"""Daily freshness for the conditions-driven pages.

The /today/ pages render live ocean conditions on every visit, so their content
genuinely changes day to day. This bumps the sitemap <lastmod> for those URLs and
the schema dateModified inside them, which prompts Google to re-crawl and re-render
the current conditions. Static pages (/best/, /about) are left at their real dates.

Run by .github/workflows/daily-freshness.yml; commits + pushes if anything changed.
"""
import re
import glob
import pathlib
import datetime

today = datetime.date.today().isoformat()

# 1. sitemap <lastmod> for the homepage + every /today/ URL
sm = pathlib.Path("sitemap.xml")
if sm.exists():
    text = sm.read_text(encoding="utf-8")

    def bump(m):
        block = m.group(0)
        loc_m = re.search(r"<loc>([^<]+)</loc>", block)
        if not loc_m:
            return block
        loc = loc_m.group(1)
        if "/today/" in loc or loc.rstrip("/").endswith("oceansafety.app"):
            block = re.sub(r"<lastmod>[^<]*</lastmod>", f"<lastmod>{today}</lastmod>", block)
        return block

    sm.write_text(re.sub(r"<url>.*?</url>", bump, text, flags=re.S), encoding="utf-8")

# 2. dateModified inside the /today/ page JSON-LD
for f in glob.glob("today/*.html"):
    p = pathlib.Path(f)
    h = p.read_text(encoding="utf-8")
    h2 = re.sub(r'("dateModified"\s*:\s*")[0-9]{4}-[0-9]{2}-[0-9]{2}(")', rf"\g<1>{today}\g<2>", h)
    if h2 != h:
        p.write_text(h2, encoding="utf-8")

print(f"freshened to {today}")
