# GoHawaii backend

The GoHawaii Dashboard and the GoHawaii link of the app run in two modes:

- **Review** (`gh/config.js` has `api: ''`): posts, place changes and sign-in stay in each browser. Nothing is counted.
- **Live** (`api` set to this Worker): staff sign in with their own key, every browser shares posts and place
  changes, and the app sends visit totals that the Dashboard's Visitors view shows in its first card.

This Worker and its database are separate from the partner telemetry worker (`concierge-guide-api`), so
deploying or changing one never touches the other.

## What it keeps

| Table | Holds | Never holds |
|---|---|---|
| `counts` | totals per Hawaiʻi calendar day, island and kind (visits, beaches opened, tabs, languages, device type, taps out) | an id, an IP address, a location, anything about one visitor |
| `docs` | the posts document and one place-changes document per island, each with a version | |
| `staff` | a SHA-256 of each staff key, with name, role (Editor or Approver) and org (State or a county) | the key itself |
| `audit` | who saved which document, and when | |

Rules the server enforces, whatever the page sends:

- "Who" on every post and log line comes from the key.
- A red advisory goes live only when an Approver who did not write it approves it.
- County staff post and change places only on their own island.
- A save made on an old copy gets `409` and the current version, so two people never overwrite each other.
- Visitors read only live posts, with no staff names and no log.

## Turn it on (about ten minutes)

Run these from this folder, signed in to the Cloudflare account that should own it (`wrangler login`).

1. Create the database, then paste the id it prints into `database_id` in `wrangler.toml`.

   ```bash
   npx wrangler d1 create gohawaii
   ```

2. Create the tables.

   ```bash
   npx wrangler d1 execute gohawaii --remote --file=schema.sql
   ```

3. Set the admin key (a long random string you keep; it only issues staff keys).

   ```bash
   npx wrangler secret put ADMIN_KEY
   ```

4. Put the Dashboard's site in `STAFF_ORIGINS` in `wrangler.toml`, then deploy.

   ```bash
   npx wrangler deploy
   ```

5. Issue one key per person. The key is shown once; send it to that person privately.

   ```bash
   curl -s -X POST https://gohawaii-api.<account>.workers.dev/gh/admin/staff -H "Authorization: Bearer $ADMIN_KEY" -d '{"name":"Full Name","role":"Editor","org":"state"}'
   ```

   `role` is `Editor` or `Approver`. `org` is `state`, `kauai`, `oahu`, `maui` or `hawaii`.
   To turn a key off: `-d '{"off":"<the key>"}'`.

6. **Update `../privacy.html` in the same deploy.** It says the GoHawaii version runs "no visit counter",
   which stops being true here. Replace that sentence (line ~109) with: "The GoHawaii version runs none of
   the three. It sends visit totals to a GoHawaii counter instead: which island, which beaches and places
   were opened, which tabs, the language and the kind of device, added up per day. It sends no id, no
   location and nothing that tells one visitor from another." Add a version line under "Changes".

7. Set `api` in `../gh/config.js` to the Worker's address, bump `GH_ADV_BUILD` in `index.html` and the
   `?b=` on the Dashboard's two `/gh/` script tags (so returning visitors load the new config), and deploy
   the site.

## Cost

Free-tier Cloudflare covers a pilot: D1 allows 100,000 row writes a day and the app sends one small batch
per visit (about five rows). Past roughly 20,000 visits a day, move the account to the paid Workers plan.

## Test locally

```bash
npx wrangler d1 execute gohawaii --local --file=schema.sql
```

```bash
npx wrangler dev --local --port 8787
```

```bash
node test-api.mjs
```

`.dev.vars` holds `ADMIN_KEY=local-admin-key-for-testing-only` for local runs; it is not committed.
