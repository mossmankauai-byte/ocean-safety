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
    def log_message(self, *a): pass

socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('127.0.0.1', PORT), functools.partial(Handler, directory=ROOT)) as srv:
    srv.serve_forever()
