#!/usr/bin/env python3
"""Clean-route freshness. Gate 6 of the Dashboard release-readiness set.

    python3 checks/clean-route-freshness.py <repo dir>

`_redirects` rewrites clean routes to .html with a 200, so the pathname the service
worker sees has no `.html` and misses any `\\.html$` matcher. Those routes then fall
through to the app-shell StaleWhileRevalidate and can render the previous build. That
is the OD-12 / OD-19 class, which has now recurred five times.

This check reads `_redirects` for every clean route that rewrites to an HTML file, then
evaluates sw.js's own NetworkFirst matcher against each pathname in a real JS engine
(node), so it tests the shipped rule rather than a copy of it. Any clean route that must
be fresh and is not matched is a blocker.

Exit 0 = every must-be-fresh clean route is matched.
"""
import json
import pathlib
import re
import subprocess
import sys

# Routes where a stale build reaches a person who matters. From OD-19 plus the operator
# surfaces in OD-12. A route not listed here is reported, not failed.
MUST_BE_FRESH = {
    "/demo/dashboard", "/onboard", "/plan", "/hotel", "/timeshare", "/rental",
    "/concierge", "/fleet", "/shop", "/join", "/set-password", "/partner-terms",
    # OD-19 also names the partner co-brand page and the creator public page. They are
    # wildcard rewrites, so they are probed with a "/sample" leaf.
    "/p/sample", "/@/sample", "/review",
}


def main():
    if len(sys.argv) < 2:
        print("usage: clean-route-freshness.py <repo dir>")
        sys.exit(2)
    repo = pathlib.Path(sys.argv[1]).expanduser()
    sw = (repo / "sw.js").read_text(encoding="utf-8")
    red = (repo / "_redirects").read_text(encoding="utf-8")

    clean = []
    for line in red.splitlines():
        m = re.match(r"^(/[^\s*]+)\s+(/\S+\.html)(\?\S*)?\s+200", line)
        if m and not m.group(1).endswith(".html"):
            clean.append((m.group(1), m.group(2)))
    # Wildcard rewrites (/p/*, /d/*) are matched by prefix; take one concrete sample each.
    for line in red.splitlines():
        m = re.match(r"^(/\S+)/\*\s+(/\S+\.html)\s+200", line)
        if m:
            clean.append((m.group(1) + "/sample", m.group(2)))

    # Pull the matcher callback out of sw.js and run it against each pathname in node.
    m = re.search(r"registerRoute\(\s*(\(\{ url \}\) =>[\s\S]*?),\s*\n\s*new workbox\.strategies\.NetworkFirst\(\{\s*\n\s*cacheName: \"jade-pages\"", sw)
    if not m:
        print("FAIL could not find the jade-pages NetworkFirst matcher in sw.js")
        sys.exit(1)
    matcher = m.group(1)
    js = (
        "const fn = " + matcher + ";\n"
        "const self = { location: { origin: 'https://x' } };\n"
        "const paths = " + json.dumps([p for p, _ in clean]) + ";\n"
        "const out = {};\n"
        "for (const p of paths) { try { out[p] = !!fn({ url: new URL('https://x' + p) }); } catch (e) { out[p] = 'error: ' + e.message; } }\n"
        "console.log(JSON.stringify(out));\n"
    ).replace("self.location.origin", "'https://x'")
    res = subprocess.run(["node", "-e", js], capture_output=True, text=True)
    if res.returncode != 0:
        print("FAIL could not evaluate the sw.js matcher: " + res.stderr.strip()[:200])
        sys.exit(1)
    matched = json.loads(res.stdout)

    fails = []
    print("clean routes in _redirects, against the shipped sw.js NetworkFirst matcher\n")
    for path, target in sorted(set(clean)):
        hit = matched.get(path)
        must = path in MUST_BE_FRESH
        if hit is True:
            print(f"  ok   {path:22s} -> {target:34s} fresh")
        elif must:
            fails.append(f"{path} -> {target}: must be fresh, falls through to the stale app-shell cache")
            print(f"  FAIL {path:22s} -> {target:34s} STALE-CAPABLE, and it must not be")
        else:
            print(f"  --   {path:22s} -> {target:34s} stale-capable (not on the must-be-fresh list)")

    print("\n" + "-" * 30)
    print(("FAIL" if fails else "PASS") + f" · {len(fails)} failed")
    for f in fails:
        print("  " + f)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
