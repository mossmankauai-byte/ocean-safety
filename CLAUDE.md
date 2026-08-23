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

## Claims that are not yours to invent

- **Never write or change a price.** Pricing lives in the standards tree and
  changes often. If a request needs a number, say so and stop.
- Islands are Kaua'i, Maui, O'ahu and Hawai'i Island. No others.
- No efficacy or impact claim. There is no defensible OceanSafe number for
  drownings, rescues or incidents prevented.
- Never describe a hotel's free tier as a trial.

## After an edit to index.html

It is cached by the service worker. `sw.js` `CACHE_VERSION` has to be bumped or
the change never reaches a guest. The editor lists this for you under
**Before this ships**. Flag it in your reply, do not bump it yourself.

## Deploying

You do not. Edits stay on the branch. The repo owner runs the ship gate and
deploys. Say what you changed in one sentence and stop.
