#!/bin/bash
# Company map notes backend: create the D1 database and table, publish the os-company-notes Worker,
# set its key, and read every step back. Run from Nick's terminal (the auto-mode classifier blocks
# remote Cloudflare writes from Claude). Safe to re-run: every step checks before it acts.
#   bash ~/oceansafe-wt/company-map/backend-company-notes/finish-notes-deploy.sh
set -uo pipefail
W=~/.npm/_npx/d77349f55c2be1c0/node_modules/.bin/wrangler
DIR=~/oceansafe-wt/company-map/backend-company-notes
KEYF=~/.config/oceansafe/company-notes-key
URL=https://os-company-notes.oceansafe-hi.workers.dev
LOG=$DIR/finish-notes-$(date +%Y-%m-%d-%H%M).log
die(){ echo "STOPPED: $*" | tee -a "$LOG"; exit 1; }
say(){ echo "$*" | tee -a "$LOG"; }
cd "$DIR" || die "no $DIR"
[ -s "$KEYF" ] || die "no key at $KEYF (the encrypted /sales page was built with it; do not make a new one)"
dbid(){ $W d1 list --json 2>>"$LOG" | python3 -c 'import sys,json;print(next((d["uuid"] for d in json.load(sys.stdin) if d["name"]=="company-notes"),""))'; }

say "== 1. signed in?"
$W whoami 2>&1 | grep -q "nick@oceansafety.app" || die "run: $W login"

say "== 2. database"
if grep -q 'database_id = "REPLACE_ME"' wrangler.toml; then
  ID=$(dbid)
  if [ -z "$ID" ]; then $W d1 create company-notes >>"$LOG" 2>&1 || die "d1 create failed (see $LOG)"; ID=$(dbid); fi
  [ -n "$ID" ] || die "no database id came back"
  sed -i '' "s/database_id = \"REPLACE_ME\"/database_id = \"$ID\"/" wrangler.toml
fi
say "database: $(grep -o 'database_id = "[^"]*"' wrangler.toml)"
$W d1 execute company-notes --remote --file=schema.sql >>"$LOG" 2>&1 || die "schema failed (see $LOG)"
T=$($W d1 execute company-notes --remote --json --command "SELECT name FROM sqlite_master WHERE type='table' AND name='notes'" 2>>"$LOG" | grep -o '"name": *"notes"')
say "read back: $T"
[ -n "$T" ] || die "notes table not there"

say "== 3. publish the Worker and set its key"
$W deploy >>"$LOG" 2>&1 || die "deploy failed (see $LOG)"
tr -d '\n' < "$KEYF" | $W secret put NOTES_KEY >>"$LOG" 2>&1 || die "secret put failed"

say "== 4. read back the live Worker"
KEY=$(cat "$KEYF")
for i in $(seq 1 24); do
  R=$(curl -s -m 10 -H "Authorization: Bearer $KEY" -H "Origin: https://oceansafety.app" "$URL/notes")
  echo "$R" | grep -q '"ok":true' && break; sleep 5
done
say "GET /notes with key: $(echo "$R" | head -c 120)"
echo "$R" | grep -q '"ok":true' || die "key not accepted after 2 minutes"
NOKEY=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "$URL/notes")
say "GET /notes with no key: $NOKEY (want 401)"
[ "$NOKEY" = "401" ] || die "notes are not locked"
say "DONE. Notes backend is live at $URL"
