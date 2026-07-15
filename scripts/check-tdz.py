#!/usr/bin/env python3
"""Catch temporal-dead-zone bugs in d.html before they ship.

WHY THIS EXISTS. d.html builds the whole dashboard in one big root.innerHTML template that calls
helper functions. Function declarations hoist, so a helper can live anywhere — but a `const` it
closes over does NOT. Declare the const next to the helper (which reads naturally) and it lands
in the temporal dead zone at call time: ReferenceError, the async render dies, and every town_ad
partner's dashboard hangs forever on "Loading your dashboard…".

That shipped to production once (PROMO_SHOT_ISLANDS, fixed in 6615bb8) and the same reflex
re-introduced it within the hour (CAT_LABEL). The file PARSES FINE both times — every syntax
check passes. A TDZ error exists only at runtime.

SCOPE. Only declarations in the async IIFE's OWN body can be in the dead zone at build time.
Function-local consts (inside pinCard, promoCard, an event handler…) initialise when that
function runs, which is fine — flagging them was the first version's mistake and made the check
useless noise. The IIFE body is indented exactly 2 spaces; nested scopes are deeper. That
indentation is the discriminator, so it must hold — if d.html is ever reformatted, fix this.

Run:  python3 scripts/check-tdz.py            # exit 1 on a violation
"""
import re, sys, pathlib

SRC = pathlib.Path(__file__).resolve().parent.parent / "d.html"
s = SRC.read_text(encoding="utf-8")

anchor = s.find("root.innerHTML=\n")
if anchor < 0:
    anchor = s.find("isTownAd ? pinCard()")
if anchor < 0:
    sys.exit("ABORT: can't find the render anchor in d.html — update this script.")

# IIFE-body declarations ONLY: exactly two spaces of indent.
decls = {m.group(2): m.start(0) for m in re.finditer(r"\n  (const|let) ([A-Za-z_$][\w$]*)\s*=", s)}

# The template region plus every helper it calls at build time.
regions = [s[anchor:anchor + 6000]]
for fn in ("pinCard", "promoCard", "phonePreview", "lockCard"):
    i = s.find("function " + fn + "(")
    if i >= 0:
        regions.append(s[i:i + 2500])

violations = []
for name, pos in decls.items():
    if pos <= anchor:
        continue                                   # initialised before the build — fine
    if any(re.search(r"\b" + re.escape(name) + r"\b", r) for r in regions):
        violations.append((name, pos))

if violations:
    print("TDZ RISK in d.html — declared AFTER the render that uses them:", file=sys.stderr)
    for name, pos in sorted(violations, key=lambda v: v[1]):
        print(f"  {name}  declared @{pos}, render @{anchor}", file=sys.stderr)
    print("\nMove them above the root.innerHTML build, with the other constants.", file=sys.stderr)
    sys.exit(1)

print(f"  ✓ no TDZ risk — {len(decls)} IIFE-scope declarations checked against the render at {anchor}")
