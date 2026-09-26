// Company map notes API. Every route needs `Authorization: Bearer <NOTES_KEY>`; the key lives
// only in the Worker secret and inside the encrypted /sales payload, never in the public repo.
//   GET    /notes              -> { ok, notes:[...] }
//   POST   /notes              { doc, branch, author, body } -> { ok, note }
//   PATCH  /notes/:id          { done:true|false } -> { ok, note }
//   POST   /seen               { doc, who } -> { ok }   (who opened this document)
const WHO = new Set(['Andy', 'Nick']);

function cors(env, req) {
  const o = req.headers.get('Origin') || '';
  const ok = (env.ORIGINS || '').split(',').map(s => s.trim()).includes(o);
  return {
    'Access-Control-Allow-Origin': ok ? o : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
}

async function authed(env, req) {
  const got = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/, '');
  if (!env.NOTES_KEY || !got || got.length !== env.NOTES_KEY.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ env.NOTES_KEY.charCodeAt(i);
  return diff === 0;
}

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);

export default {
  async fetch(req, env) {
    const h = cors(env, req);
    const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: h });
    if (req.method === 'OPTIONS') return new Response(null, { headers: h });
    if (!(await authed(env, req))) return out({ ok: false, reason: 'forbidden' }, 401);

    const url = new URL(req.url);
    const p = url.pathname.replace(/\/+$/, '');
    let body = {};
    if (req.method === 'POST' || req.method === 'PATCH') {
      try { body = await req.json(); } catch { return out({ ok: false, reason: 'bad_json' }, 400); }
    }

    if (p === '/notes' && req.method === 'GET') {
      const r = await env.DB.prepare('SELECT * FROM notes ORDER BY id DESC LIMIT 500').all();
      return out({ ok: true, notes: r.results });
    }

    if (p === '/notes' && req.method === 'POST') {
      const doc = clean(body.doc, 64), branch = clean(body.branch, 32), text = clean(body.body, 4000);
      const author = clean(body.author, 8);
      if (!doc || !branch || !text || !WHO.has(author)) return out({ ok: false, reason: 'need_doc_branch_author_body' }, 400);
      const now = new Date().toISOString();
      const note = await env.DB.prepare(
        'INSERT INTO notes (doc, branch, author, body, created, seen) VALUES (?1, ?2, ?3, ?4, ?5, ?3) RETURNING *'
      ).bind(doc, branch, author, text, now).first();
      return out({ ok: true, note });
    }

    const m = p.match(/^\/notes\/(\d+)$/);
    if (m && req.method === 'PATCH') {
      const done = body.done ? 1 : 0;
      const note = await env.DB.prepare(
        'UPDATE notes SET done = ?1, done_at = CASE WHEN ?1 = 1 THEN ?2 ELSE NULL END WHERE id = ?3 RETURNING *'
      ).bind(done, new Date().toISOString(), Number(m[1])).first();
      return note ? out({ ok: true, note }) : out({ ok: false, reason: 'not_found' }, 404);
    }

    if (p === '/seen' && req.method === 'POST') {
      const doc = clean(body.doc, 64), who = clean(body.who, 8);
      if (!doc || !WHO.has(who)) return out({ ok: false, reason: 'need_doc_who' }, 400);
      await env.DB.prepare(
        "UPDATE notes SET seen = CASE WHEN seen = '' THEN ?2 ELSE seen || ',' || ?2 END " +
        "WHERE doc = ?1 AND instr(',' || seen || ',', ',' || ?2 || ',') = 0"
      ).bind(doc, who).run();
      return out({ ok: true });
    }

    return out({ ok: false, reason: 'no_route' }, 404);
  },
};
