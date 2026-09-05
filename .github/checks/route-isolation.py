#!/usr/bin/env python3
"""Routing and tenant isolation. Gate 3 of the Dashboard release-readiness set.

    python3 checks/route-isolation.py [--repo <checkout with _redirects>]

Three assertions against the live mirror:

  A. Segment round-trip. Every route that rewrites to dashboard.html?seg=... must serve
     a page whose route table resolves to THAT segment. Prints the route x segment matrix.
  B. Fork detection. sha256 of every HTML route's body. Two different routes with the
     same hash is the OD-10 class: a console that is a byte-copy of another segment's.
  C. Slug guessing. /p/<garbage> and /d/<garbage> must not render a partner surface.

Exit 0 = PASS. Stdlib only, same shape as smoke.py.
"""
import argparse
import hashlib
import re
import sys
import urllib.request
import urllib.error

HOST = "https://ocean-safety.netlify.app"
# Pinned 2026-09-04 from _redirects. Pass --repo to read the live table instead.
PINNED = [("/hotel", "hotel"), ("/timeshare", "timeshare"), ("/rental", "pm"),
          ("/concierge", "concierge"), ("/fleet", "cars")]
fails = []


def get(path):
    req = urllib.request.Request(HOST + path, headers={"User-Agent": "os-route-isolation"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def routes(repo):
    if not repo:
        return PINNED
    out = []
    for line in open(repo.rstrip("/") + "/_redirects", encoding="utf-8"):
        m = re.match(r"^(/\S+)\s+/dashboard\.html\?seg=([a-z]+)", line)
        if m:
            out.append((m.group(1), m.group(2)))
    return out or PINNED


def targets(repo):
    """route -> the file it rewrites to. Two routes pointing at the SAME file are
    aliases and are supposed to serve identical bytes; that is not a fork. A fork is
    two routes with DIFFERENT targets whose bytes match anyway."""
    if not repo:
        return {}
    out = {}
    for line in open(repo.rstrip("/") + "/_redirects", encoding="utf-8"):
        m = re.match(r"^(/\S+?)(/\*)?\s+(/\S+?)(\?\S*)?\s+\d{3}", line)
        if m:
            out[m.group(1)] = m.group(3)
    return out


def resolved_seg(path, body):
    """What segment does the served page actually resolve to?

    The route table lives in the page (OS_ROUTE_SEG, added by the 9-02 fix). Without it
    the page can only read ?seg= from location.search, which a 200 rewrite never sets,
    so the page falls back to its default. Reproduce that logic here rather than running
    a browser, so this check stays stdlib.
    """
    word = path.strip("/").lower()
    m = re.search(r"window\.OS_ROUTE_SEG\s*=\s*\{(.*?)\}", body, re.S)
    if m:
        table = dict(re.findall(r"([a-z]+)\s*:\s*'([a-z]+)'", m.group(1)))
        if word in table:
            return table[word], "route table"
    m2 = re.search(r"if\(!window\.OS_SEGMENTS\[q\]\)\s*q\s*=\s*'([a-z]+)'", body)
    return (m2.group(1) if m2 else "?"), "fallback (no route table)"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo")
    args = ap.parse_args()
    table = routes(args.repo)
    tmap = targets(args.repo)

    print("A. Segment round-trip")
    bodies = {}
    for path, want in table:
        status, body = get(path)
        bodies[path] = body
        got, how = resolved_seg(path, body)
        mark = "ok  " if got == want else "FAIL"
        if got != want:
            fails.append(f"{path}: asked seg={want}, page resolves seg={got} via {how}")
        print(f"  {mark} {path:12s} want={want:10s} got={got:10s} ({how}, HTTP {status})")

    print("\nB. Fork detection")
    seen = {}
    for path in [p for p, _ in table] + ["/analytics-console.html", "/demo/dashboard", "/shopdemo"]:
        body = bodies.get(path)
        if body is None:
            status, body = get(path)
            if status != 200:
                print(f"  --   {path:26s} HTTP {status}, skipped")
                continue
        h = hashlib.sha256(body.encode()).hexdigest()[:16]
        seen.setdefault(h, []).append(path)
    for h, paths in seen.items():
        if len(paths) > 1:
            # Same file served at several segment routes is the design here: the segment
            # is chosen at runtime. Only flag it when the page has no route table, which
            # is the case where those routes genuinely cannot differ.
            has_table = "OS_ROUTE_SEG" in bodies.get(paths[0], "")
            tgt = {tmap.get(p, p) for p in paths}
            aliases = len(tgt) == 1
            ok = has_table or aliases
            mark = "ok  " if ok else "FAIL"
            if not ok:
                fails.append(f"identical bytes, different targets, no route table: {', '.join(paths)}")
            why = " (runtime segment)" if has_table else (" (aliases of " + list(tgt)[0] + ")" if aliases else "  <- cannot differ per segment")
            print(f"  {mark} {h} shared by {', '.join(paths)}{why}")
        else:
            print(f"  ok   {h} unique: {paths[0]}")

    print("\nC. Slug guessing")
    # /p/ and /d/ are client-side shells: the same bytes are served for every token and
    # the partner is resolved in the browser. So the test is not "does the word $649
    # appear" (it always does, as template text) but "do two different tokens get
    # different bytes", which would mean partner data is being server-rendered, and
    # "is there a not-found path at all".
    for prefix in ["/p/", "/d/"]:
        s1, b1 = get(prefix + "zzz-not-a-token-9f2")
        s2, b2 = get(prefix + "qqq-also-not-real-4a1")
        h1, h2 = hashlib.sha256(b1.encode()).hexdigest(), hashlib.sha256(b2.encode()).hexdigest()
        if s1 == 200 and h1 != h2:
            fails.append(f"{prefix}<token>: two unknown tokens get DIFFERENT bytes, so partner data is server-rendered and guessable")
            print(f"  FAIL {prefix}<token> HTTP {s1}, bytes differ between two unknown tokens")
            continue
        has_notfound = re.search(r"not found|Invalid partner link", b1, re.I)
        if s1 != 200:
            print(f"  ok   {prefix}<token> HTTP {s1}")
        elif has_notfound:
            print(f"  ok   {prefix}<token> HTTP 200, identical shell for any token, carries a not-found path")
        else:
            fails.append(f"{prefix}<token>: HTTP 200 with no not-found path in the shell")
            print(f"  FAIL {prefix}<token> HTTP 200 and no not-found path")

    print("\n" + "-" * 30)
    print(("FAIL" if fails else "PASS") + f" · {len(fails)} failed")
    for f in fails:
        print("  " + f)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
