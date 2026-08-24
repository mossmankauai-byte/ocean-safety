#!/usr/bin/env node
// Reads what the /review tool has sent.
//
//   node tools/review-inbox.mjs          new submissions only
//   node tools/review-inbox.mjs --all    everything Netlify still holds
//   node tools/review-inbox.mjs --seen   mark everything shown as handled
//
// Submissions land in Netlify Forms, so there is no server to run and no key to
// keep. The token is the one the Netlify CLI already stored on this machine.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const SITE = 'ocean-safety'
const FORM = 'os-review'
const SEEN = path.join(os.homedir(), '.claude', 'review-inbox-seen.json')

function token() {
  const p = path.join(os.homedir(), 'Library', 'Preferences', 'netlify', 'config.json')
  if (!fs.existsSync(p)) die('No Netlify config on this machine. Run: netlify login')
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'))
  for (const u of Object.values(cfg.users || {})) {
    const t = u?.auth?.token
    if (t) return t
  }
  die('Netlify config has no token. Run: netlify login')
}

function die(msg) { console.error(msg); process.exit(1) }

async function api(pathname, tok) {
  const r = await fetch('https://api.netlify.com/api/v1' + pathname, {
    headers: { Authorization: 'Bearer ' + tok },
  })
  if (!r.ok) die(`Netlify API ${r.status} on ${pathname}`)
  return r.json()
}

const seen = () => { try { return new Set(JSON.parse(fs.readFileSync(SEEN, 'utf8'))) } catch { return new Set() } }
const markSeen = ids => {
  fs.mkdirSync(path.dirname(SEEN), { recursive: true })
  fs.writeFileSync(SEEN, JSON.stringify([...new Set([...seen(), ...ids])].slice(-500)))
}

const tok = token()
const all = process.argv.includes('--all')
const mark = process.argv.includes('--seen')

const sites = await api('/sites?filter=all', tok)
const site = sites.find(s => s.name === SITE)
if (!site) die(`No Netlify site named ${SITE} on this account.`)

const forms = await api(`/sites/${site.id}/forms`, tok)
const form = forms.find(f => f.name === FORM)
if (!form) {
  console.log(`No "${FORM}" form on ${SITE} yet. Netlify registers it on the deploy after`)
  console.log(`review.html ships, and it appears here once someone sends the first one.`)
  process.exit(0)
}

const subs = await api(`/forms/${form.id}/submissions`, tok)
const known = seen()
const show = all ? subs : subs.filter(s => !known.has(s.id))

if (!show.length) {
  console.log(all ? 'No submissions at all yet.' : `Nothing new. ${subs.length} handled already.`)
  process.exit(0)
}

console.log(`${show.length} review${show.length === 1 ? '' : 's'}${all ? '' : ' new'}, newest last.\n`)
for (const s of show.slice().reverse()) {
  const d = s.data || {}
  console.log('='.repeat(74))
  console.log(`${d.who || 'unknown'} · ${d.counts || ''} · ${new Date(s.created_at).toLocaleString()}`)
  console.log(`id ${s.id}`)
  console.log('='.repeat(74))
  console.log(d.prompt || '(no prompt in this submission)')
  console.log()
}

if (mark) {
  markSeen(show.map(s => s.id))
  console.log(`Marked ${show.length} as handled.`)
} else {
  console.log('Run again with --seen once these are dealt with.')
}
