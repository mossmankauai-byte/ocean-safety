# Click-to-edit editor

Local dev tool. Point at any page of the site, click a region, tell Claude what to change,
watch it change locally. Nothing here deploys.

```bash
git switch -c work/what-you-are-changing
node tools/editor/serve.mjs
```

It refuses to start on `main`. The editor writes straight to disk, so it needs a working
branch you can open a pull request from.

Then open http://localhost:4321/__editor/

Run it from a terminal where `claude` is logged in. The server spawns headless Claude Code, so
it inherits that terminal's auth.

## Loop

1. Pick a page from the dropdown, or type any path.
2. Click **Select element**, then click the region in the preview. The panel shows the
   selector and the source line it resolved to.
3. Type the change, hit **Send to Claude** (or Cmd+Enter). Tool calls stream into the panel.
4. When it finishes, the preview reloads with the change already on disk.
5. **Work log** tab lists every edit and note on this branch, each edit with **Show diff**
   and **Revert**.

## Working with someone else

Each person runs the editor on their own machine with their own Claude login. Nothing is
shared over the network, and nobody points a tunnel at localhost.

- **Add note** writes a comment to the work log without calling Claude. Use it for the
  things a diff cannot say: why a change was made, what still looks wrong, a question.
- The work log is `tools/editor/worklog/<branch>.jsonl`, and it is **committed**. Their
  notes, their requests and their diffs all arrive together in the pull request.
- Every entry is stamped with `git config user.name`, so a shared branch is never ambiguous.
- The reviewer runs the ship gate before anything deploys. That has not changed.
- A collaborator has full run of the branch. `CLAUDE.md` at the repo root is the
  brief their Claude loads on every run: how the single-file pages are built, edit
  surgically, no em dashes, and never deploy. Edit that file to change the rules
  for everyone at once.

## What's in the panel

- **Widen crumbs.** Clicked the icon when you meant the card? Click an ancestor crumb instead
  of hunting for the right pixel.
- **Phone / Tablet / Full.** Real widths, 390 and 834, so responsive problems show up here
  rather than in the ship check.
- **Show diff.** The actual before and after lines for any edit, not just Claude's summary.
- **Before this ships.** When an edit touches `index.html`, the ripple items appear: bump
  CACHE_VERSION, mirror `p/demo.html`, run SYNC for the co-brand fleet, verify on the mirror.
- **Page search.** Every HTML page on the site, 130 of them, in the search box.
- **New thread** drops Claude's context when you switch to an unrelated change. **Stop** kills
  a run in flight. The session's spend sits in the top right.

## Notes

- Every run snapshots the target file into `.backups/` first. Revert restores it.
- The inspector is injected into the served response only. It is never written into the file.
- Edit mode follows in-page navigation via an `osed` cookie. `?__edit=0` clears it.
- One run at a time per file.
- Each send is a headless Claude Code run. Expect a few cents per edit.
- Deploying is unchanged: normal deploy path, plus the ship gate before anything goes out.

`.backups/` and `history.jsonl` are local working files, not for deploy.
