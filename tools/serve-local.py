#!/usr/bin/env python3
"""Serve a checkout on localhost with /api/wx proxied to the Netlify mirror.

The app fetches conditions from /api/wx, a Netlify Function that a plain static server does not
have, so a local tree shows "last-known conditions" instead of live ones. This proxies just that
path to the mirror (ocean-safety.netlify.app, which resolves on Nick's wifi where the apex does
not) and serves everything else from the tree. Local preview and off-test rig only; never deployed.

    python3 tools/serve-local.py <root> <port>
"""
import functools, http.server, socketserver, sys, urllib.request

ROOT, PORT = sys.argv[1], int(sys.argv[2])
MIRROR = 'https://ocean-safety.netlify.app'

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/wx'):
            try:
                with urllib.request.urlopen(MIRROR + self.path, timeout=20) as r:
                    body = r.read()
                    self.send_response(200)
                    self.send_header('Content-Type', r.headers.get('Content-Type', 'application/json'))
                    self.send_header('Content-Length', str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
            except Exception:
                self.send_response(502); self.end_headers()
            return
        return super().do_GET()
    # One-shot ingest for the GoHawaii pull: the browser tab (any origin) POSTs a JSON body and it
    # lands under evidence/ingest/<name>.json. A cross-origin text/plain POST needs no preflight.
    # Local rig only; the path is a fixed folder and the name is sanitised, nothing else is written.
    def do_POST(self):
        if self.path.startswith('/ingest'):
            import os, re
            name = re.sub(r'[^a-z0-9_-]', '', (self.path.split('name=')[1].split('&')[0] if 'name=' in self.path else 'ingest'))[:40] or 'ingest'
            n = int(self.headers.get('Content-Length', '0'))
            body = self.rfile.read(n)
            out = os.path.expanduser('~/Desktop/OceanSafe/gohawaii/evidence/ingest')
            os.makedirs(out, exist_ok=True)
            with open(os.path.join(out, name + '.json'), 'wb') as f: f.write(body)
            self.send_response(204); self.send_header('Access-Control-Allow-Origin', '*'); self.end_headers()
            return
        self.send_response(404); self.end_headers()
    def log_message(self, *a): pass

socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('127.0.0.1', PORT), functools.partial(Handler, directory=ROOT)) as srv:
    srv.serve_forever()
