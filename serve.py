#!/usr/bin/env python3
"""Local HTTP server for home-designer."""
import http.server
import socketserver
import os
import sys
import webbrowser

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[home-designer] " + (fmt % args) + "\n")


# Allow immediate port reuse after fast restart
socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    url = f"http://localhost:{PORT}/"
    print(f"户型设计师已启动: {url}")
    print("Ctrl+C 退出")
    webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已退出")
