#!/usr/bin/env node
// Local click-to-edit editor for the OceanSafe site.
// Serves the site root same-origin, injects an element inspector into previewed
// pages (response only, never the file on disk), and relays headless Claude Code
// runs back to the editor shell over SSE.
//
//   node tools/editor/serve.mjs      ->  http://localhost:4321/__editor/

import http from 'node:http'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const BACKUPS = path.join(HERE, '.backups')
const WORKLOG_DIR = path.join(HERE, 'worklog')
const PORT = Number(process.env.PORT || 4321)

// --- who and where ----------------------------------------------------------
// The work log is committed per branch, so a collaborator's notes and edits
// travel with their pull request instead of dying on their laptop.
const git = (...a) => {
  const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : ''
}
const BRANCH = git('rev-parse', '--abbrev-ref', 'HEAD')
const AUTHOR = git('config', 'user.name') || process.env.USER || 'unknown'

const PROTECTED = new Set(['main', 'master', 'HEAD', ''])
if (PROTECTED.has(BRANCH)) {
  console.error(`\n  Refusing to start on "${BRANCH || 'a detached HEAD'}".`)
  console.error(`  The editor writes straight to disk, so it needs a working branch:\n`)
  console.error(`      git switch -c work/<what-you-are-changing>\n`)
  process.exit(1)
}

const HISTORY = path.join(WORKLOG_DIR, BRANCH.replace(/[\/\\]/g, '-') + '.jsonl')

fs.mkdirSync(BACKUPS, { recursive: true })
fs.mkdirSync(WORKLOG_DIR, { recursive: true })

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
}

const jobs = new Map()   // jobId -> { events[], done, listeners[], child }
const locks = new Set()  // target files with a run in flight
const SKIP_DIRS = new Set(['tools', 'node_modules', 'icons', 'assets', '.git', '.claude'])

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}

const readBody = req => new Promise((resolve, reject) => {
  let raw = ''
  req.on('data', c => { raw += c; if (raw.length > 2e6) req.destroy() })
  req.on('end', () => { try { resolve(JSON.parse(raw || '{}')) } catch (e) { reject(e) } })
  req.on('error', reject)
})

// Resolve a browser path to a file inside ROOT, refusing anything that escapes it.
function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0])
  let abs = path.join(ROOT, clean)
  if (!abs.startsWith(ROOT)) return null
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) abs = path.join(abs, 'index.html')
  return fs.existsSync(abs) ? abs : null
}

// --- source anchoring -------------------------------------------------------
// Find the line in the raw source that holds the clicked element. An id is the
// strongest hook; otherwise fall back to a normalized prefix of its outerHTML.
function findLine(source, { elementId, snippet }) {
  const lines = source.split('\n')
  if (elementId) {
    const needle = `id="${elementId}"`
    const alt = `id='${elementId}'`
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(needle) || lines[i].includes(alt)) return i + 1
    }
  }
  if (snippet) {
    const probe = snippet.replace(/\s+/g, ' ').trim().slice(0, 80)
    if (probe.length > 20) {
      const flat = source.replace(/\s+/g, ' ')
      const at = flat.indexOf(probe)
      if (at !== -1) {
        // Map the flattened offset back to a line by re-walking the source.
        let seen = 0
        for (let i = 0; i < lines.length; i++) {
          seen += lines[i].replace(/\s+/g, ' ').length + 1
          if (seen >= at) return i + 1
        }
      }
    }
  }
  return null
}

function buildPrompt({ relFile, line, selector, snippet, message }) {
  const where = line ? `at line ${line}` : `(exact line not resolved, locate it with Grep)`
  return [
    `Edit the file ${relFile} in this directory.`,
    ``,
    `The user clicked an element ${where} matching the CSS selector: ${selector}`,
    snippet ? `\nThe element's current markup:\n${snippet}\n` : '',
    `Their request: ${message}`,
    ``,
    `Rules:`,
    `- This file can be very large. Use Grep and offset Reads to locate code. Never read the whole file.`,
    `- Change only this element and the CSS or JS that belongs to it.`,
    `- Do not reformat surrounding code and do not touch unrelated regions.`,
    `- No em dashes or en dashes in any copy you write.`,
    `- Reply with one sentence naming what you changed.`,
  ].join('\n')
}

// --- job runner -------------------------------------------------------------
function emit(job, type, data) {
  const ev = { type, data, ts: Date.now() }
  job.events.push(ev)
  for (const write of job.listeners) write(ev)
}

async function runJob({ jobId, targetFile, relFile, prompt, sessionId, isNewSession, meta }) {
  const job = jobs.get(jobId)
  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--allowedTools', 'Read', 'Edit', 'Grep', 'Glob',
    isNewSession ? '--session-id' : '--resume', sessionId,
  ]

  const child = spawn('claude', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
  job.child = child
  let summary = ''
  const filesChanged = new Set()
  let buf = ''

  child.stdout.on('data', chunk => {
    buf += chunk
    const lines = buf.split('\n')
    buf = lines.pop()
    for (const line of lines) {
      if (!line.trim()) continue
      let msg
      try { msg = JSON.parse(line) } catch { continue }
      if (msg.type === 'assistant') {
        for (const block of msg.message?.content || []) {
          if (block.type === 'text' && block.text.trim()) {
            summary = block.text.trim()
            emit(job, 'text', block.text)
          }
          if (block.type === 'tool_use') {
            const f = block.input?.file_path || block.input?.pattern || ''
            if (block.name === 'Edit' && block.input?.file_path) filesChanged.add(block.input.file_path)
            emit(job, 'tool', `${block.name} ${path.relative(ROOT, f) || f}`)
          }
        }
      } else if (msg.type === 'result') {
        if (msg.result) summary = String(msg.result).trim()
        emit(job, 'cost', { usd: msg.total_cost_usd, ms: msg.duration_ms })
      }
    }
  })

  child.stderr.on('data', d => emit(job, 'stderr', String(d)))

  child.on('close', async code => {
    const entry = {
      ts: new Date().toISOString(),
      target: relFile,
      selector: meta.selector,
      line: meta.line,
      request: meta.message,
      summary: summary || (code === 0 ? 'done' : `claude exited ${code}`),
      filesChanged: [...filesChanged].map(f => path.relative(ROOT, f)),
      backup: meta.backup,
      sessionId,
      author: AUTHOR,
      branch: BRANCH,
      kind: 'edit',
      ok: code === 0,
    }
    await fsp.appendFile(HISTORY, JSON.stringify(entry) + '\n')
    emit(job, 'done', entry)
    job.done = true
    locks.delete(targetFile)
  })
}

// --- routes -----------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const p = url.pathname

  // editor shell + inspector
  if (p === '/__editor' || p === '/__editor/') {
    return send(res, 200, await fsp.readFile(path.join(HERE, 'editor.html')), MIME['.html'])
  }
  if (p === '/__editor/inspect.js') {
    return send(res, 200, await fsp.readFile(path.join(HERE, 'inspect.js')), MIME['.js'])
  }

  // Every editable page on the site, so the picker is not a hand-kept list.
  if (p === '/__editor/pages') {
    const out = []
    const walk = dir => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue
        const abs = path.join(dir, e.name)
        if (e.isDirectory()) walk(abs)
        else if (e.name.endsWith('.html')) out.push('/' + path.relative(ROOT, abs))
      }
    }
    walk(ROOT)
    out.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
    return send(res, 200, out)
  }

  // The actual change, not just Claude's word for it.
  if (p === '/__editor/diff') {
    const backup = path.join(BACKUPS, path.basename(url.searchParams.get('backup') || ''))
    const file = resolveFile(url.searchParams.get('path') || '')
    if (!file || !fs.existsSync(backup)) return send(res, 404, { error: 'backup or target missing' })
    const d = spawn('diff', ['-u', '--label', 'before', '--label', 'after', backup, file])
    let text = ''
    d.stdout.on('data', c => { if (text.length < 60000) text += c })
    d.on('close', () => send(res, 200, { diff: text.trim() || '(no textual change)' }))
    return
  }

  if (p === '/__editor/stop' && req.method === 'POST') {
    const body = await readBody(req)
    const job = jobs.get(body.jobId)
    if (job?.child) { job.child.kill('SIGTERM'); return send(res, 200, { ok: true }) }
    return send(res, 404, { error: 'no such job' })
  }

  // Who is driving, shown in the shell so a shared branch is never ambiguous.
  if (p === '/__editor/who') {
    return send(res, 200, { author: AUTHOR, branch: BRANCH, log: path.relative(ROOT, HISTORY) })
  }

  // A note is a comment, not an instruction. Nothing runs, nothing costs.
  if (p === '/__editor/note' && req.method === 'POST') {
    const body = await readBody(req)
    const text = String(body.note || '').trim()
    if (!text) return send(res, 400, { error: 'empty note' })
    const entry = {
      ts: new Date().toISOString(),
      target: (body.targetPath || '').replace(/^\//, ''),
      selector: body.selector || '',
      line: body.line || null,
      request: text,
      summary: '(note)',
      filesChanged: [],
      author: AUTHOR,
      branch: BRANCH,
      kind: 'note',
      ok: true,
    }
    await fsp.appendFile(HISTORY, JSON.stringify(entry) + '\n')
    return send(res, 200, entry)
  }

  if (p === '/__editor/log') {
    let lines = []
    try {
      lines = (await fsp.readFile(HISTORY, 'utf8')).trim().split('\n').filter(Boolean)
    } catch {}
    return send(res, 200, lines.slice(-100).map(l => JSON.parse(l)))
  }

  if (p === '/__editor/source' && req.method === 'GET') {
    const file = resolveFile(url.searchParams.get('path') || '')
    if (!file) return send(res, 404, { error: 'not found' })
    const src = await fsp.readFile(file, 'utf8')
    const line = findLine(src, {
      elementId: url.searchParams.get('elementId') || '',
      snippet: url.searchParams.get('snippet') || '',
    })
    return send(res, 200, { file: path.relative(ROOT, file), line })
  }

  if (p === '/__editor/chat' && req.method === 'POST') {
    const body = await readBody(req)
    const file = resolveFile(body.targetPath || '/index.html')
    if (!file) return send(res, 404, { error: 'target not found' })
    if (locks.has(file)) return send(res, 409, { error: 'a run is already in flight for this file' })
    locks.add(file)

    const relFile = path.relative(ROOT, file)
    const src = await fsp.readFile(file, 'utf8')
    const line = findLine(src, { elementId: body.elementId, snippet: body.snippet })

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backup = `${relFile.replace(/[\/\\]/g, '_')}.${stamp}`
    await fsp.copyFile(file, path.join(BACKUPS, backup))

    const jobId = crypto.randomUUID()
    jobs.set(jobId, { events: [], done: false, listeners: [] })

    const sessionId = body.sessionId || crypto.randomUUID()
    runJob({
      jobId, targetFile: file, relFile,
      prompt: buildPrompt({
        relFile, line,
        selector: body.selector || '(whole page)',
        snippet: body.snippet, message: body.message,
      }),
      sessionId, isNewSession: !body.sessionId,
      meta: { selector: body.selector, line, message: body.message, backup },
    }).catch(err => { locks.delete(file); console.error(err) })

    return send(res, 200, { jobId, sessionId, file: relFile, line, backup })
  }

  if (p.startsWith('/__editor/stream/')) {
    const job = jobs.get(p.split('/').pop())
    if (!job) return send(res, 404, { error: 'no such job' })
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    })
    const write = ev => res.write(`data: ${JSON.stringify(ev)}\n\n`)
    job.events.forEach(write)
    if (job.done) return res.end()
    job.listeners.push(write)
    req.on('close', () => {
      job.listeners = job.listeners.filter(l => l !== write)
    })
    return
  }

  if (p === '/__editor/revert' && req.method === 'POST') {
    const body = await readBody(req)
    const backup = path.join(BACKUPS, path.basename(body.backup || ''))
    const file = resolveFile(body.targetPath || '')
    if (!file || !fs.existsSync(backup)) return send(res, 404, { error: 'backup or target missing' })
    await fsp.copyFile(backup, file)
    await fsp.appendFile(HISTORY, JSON.stringify({
      ts: new Date().toISOString(), target: path.relative(ROOT, file),
      request: '(revert)', summary: `restored from ${path.basename(backup)}`,
      filesChanged: [path.relative(ROOT, file)],
      author: AUTHOR, branch: BRANCH, kind: 'revert', ok: true,
    }) + '\n')
    return send(res, 200, { ok: true })
  }

  // static site, same origin as the shell
  const file = resolveFile(p === '/' ? '/index.html' : p)
  if (!file) return send(res, 404, 'not found', 'text/plain')
  const ext = path.extname(file).toLowerCase()
  const type = MIME[ext] || 'application/octet-stream'

  // Edit mode sticks via a cookie so in-page navigation and JS redirects
  // (portal/dashboard.html bounces to get-started.html) keep the inspector.
  // ?__edit=0 clears it.
  const flag = url.searchParams.get('__edit')
  const cookied = /(^|;\s*)osed=1/.test(req.headers.cookie || '')
  const editMode = flag === '1' || (cookied && flag !== '0')

  if (ext === '.html' && editMode) {
    let html = await fsp.readFile(file, 'utf8')
    const tag = `<script src="/__editor/inspect.js"></script>`
    html = html.includes('</body>') ? html.replace('</body>', `${tag}\n</body>`) : html + tag
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Set-Cookie': 'osed=1; Path=/; SameSite=Lax',
    })
    return res.end(html)
  }
  if (ext === '.html' && flag === '0') {
    res.setHeader('Set-Cookie', 'osed=; Path=/; Max-Age=0')
  }

  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  fs.createReadStream(file).pipe(res)
})

server.listen(PORT, () => {
  console.log(`editor  http://localhost:${PORT}/__editor/`)
  console.log(`serving ${ROOT}`)
  console.log(`branch  ${BRANCH}  ·  ${AUTHOR}`)
  console.log(`worklog ${path.relative(ROOT, HISTORY)}  (commit it with your changes)`)
})
