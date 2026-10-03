"""Local HTTP server for the lab: GET /big.bin?n=<bytes> downloads, POST /upload discards the body.
Create the blob first:  head -c 40000000 /dev/urandom > big.bin   (or set LAB_BLOB)."""
import http.server, socketserver, os, sys
class H(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def log_message(self, *a): pass
    def do_GET(self):
        data = open(os.environ.get("LAB_BLOB","big.bin"),"rb").read()
        n = int(self.path.split("n=")[1]) if "n=" in self.path else len(data)
        self.send_response(200); self.send_header("Content-Length", str(n)); self.end_headers()
        self.wfile.write(data[:n])
    def do_POST(self):
        n = int(self.headers["Content-Length"]); got = 0
        while got < n:
            c = self.rfile.read(min(65536, n-got))
            if not c: break
            got += len(c)
        self.send_response(200); self.send_header("Content-Length","2"); self.end_headers(); self.wfile.write(b"ok")
class S(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads=True; allow_reuse_address=True
S(("127.0.0.1", 8080), H).serve_forever()
