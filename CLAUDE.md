# OceanSafe site

Claude Code reads this file automatically, including every headless run the
click-to-edit editor spawns (`tools/editor/serve.mjs`). It is the shared brief:
whoever is editing, their Claude gets the same rules.

## The files here

Single-file HTML. `index.html` and `dashboard.html` are each several hundred KB
with their CSS and JS inline. Never read one whole. Grep for the markup, then
read at an offset around the hit.

- `index.html` is the guest app.
- `dashboard.html` is the operator Dashboard. One file, five segments, chosen by
  the route: `_redirects` rewrites `/hotel` to `?seg=hotel`. `window.OS_SEGMENTS`
  near the top is the only place a segment differs. A change outside that object
  hits all five.
- `d.html` is partner home, not a dashboard. `p.html` is the public partner page.
- The operator surface is called the **Dashboard** in anything a person reads.
  "Console" is retired from user-facing copy.

## Editing rules

- Change the element asked about and the CSS or JS that belongs to it. Nothing else.
- Do not reformat, re-indent or tidy surrounding code. The diff should be readable
  as one idea.
- Match the code and copy already around you.
- **No em dashes or en dashes** in any copy, comment or commit message. Use a
  period, a comma, a colon, or two sentences.
- No emoji as an interface icon. Inline SVG.

## Scope

Anything on this branch is fair game, pricing included. Prices, tiers and plan
framing are being reworked, so the old numbers are not canon and are not worth
preserving. Change what the request asks you to change.

Two things still hold, because they are factual rather than commercial:

- Islands are Kaua'i, Maui, O'ahu and Hawai'i Island. No others.
- No efficacy or impact claim. There is no defensible OceanSafe number for
  drownings, rescues or incidents prevented, so do not write one.

## After an edit to index.html

It is cached by the service worker. `sw.js` `CACHE_VERSION` has to be bumped or
the change never reaches a guest. The editor lists this for you under
**Before this ships**. Flag it in your reply, do not bump it yourself.

## Deploying

You do not, and neither does the editor. Edits stay on the branch. A session ends
with a handoff document, the owner agrees the changes, and only then does a
separate pass apply and ship them. That, plus a one-line rollback to
`editor-restore/<branch>`, is what makes the wide scope above safe. Say what you
changed in one sentence and stop.
