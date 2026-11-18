"""Serve the mockup on this computer only, with caching off so edits always show.

Run from anywhere:  python design/mockup/serve.py   (python3 on macOS)
Then open http://127.0.0.1:8765/home.html
"""
import functools
import http.server
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
PORT = 8765


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=str(HERE))
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as server:
        print(f"Mockup at http://127.0.0.1:{PORT}/home.html  (Ctrl+C to stop)")
        server.serve_forever()
