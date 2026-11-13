#!/usr/bin/env python3
"""Signed phone upload onto ripley.

SWapp signs a send-page link. The phone opens it here (a plain link, so the
HTTPS site never makes an HTTP request) and PUTs each file to this server.
The signature is the password. Bind the tailnet address, not the open internet.
Files land in ~/swapp-phone-intake unless PHONE_INTAKE_DIR is set.
"""

import hashlib
import hmac
import json
import os
import re
import sys
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BYTES = 3_000_000_000
SAFE = re.compile(r"[^A-Za-z0-9._-]+")
INBOX = os.path.expanduser(os.environ.get("PHONE_INTAKE_DIR", "~/swapp-phone-intake"))


def safe_name(raw):
    base = os.path.basename((raw or "").replace("\\", "/"))
    clean = SAFE.sub("_", base).strip("_")
    return (clean or "upload.bin")[:120]


def ticket_message(exp, size, name):
    return ("%s\n%s\n%s" % (exp, size, name)).encode()


def sign_ticket(secret, exp, size, name):
    return hmac.new(secret.encode(), ticket_message(exp, size, name), hashlib.sha256).hexdigest()


def ticket_ok(secret, exp, size, name, sig):
    if not isinstance(sig, str) or len(sig) != 64:
        return False
    expected = sign_ticket(secret, exp, size, name)
    return hmac.compare_digest(expected, sig)


def session_message(exp):
    return ("session\n%s" % exp).encode()


def sign_session(secret, exp):
    return hmac.new(secret.encode(), session_message(exp), hashlib.sha256).hexdigest()


def session_ok(secret, exp, sig):
    if not isinstance(sig, str) or len(sig) != 64:
        return False
    return hmac.compare_digest(sign_session(secret, exp), sig)


SEND_PAGE = """<!doctype html><html lang=en><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>Send to ripley</title><style>
body{font:17px/1.45 system-ui,sans-serif;margin:0;padding:24px;background:#f8fafc;color:#0f172a}
h1{font-size:24px;margin:0 0 8px}p{color:#475569;margin:0 0 20px}
label{display:block;background:#0f172a;color:#fff;border-radius:999px;padding:16px;text-align:center;font-weight:600}
input{display:none}ul{list-style:none;padding:0;margin:20px 0 0}
li{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;word-break:break-all}
b{display:block}.ok{color:#15803d}.bad{color:#be123c}small{color:#64748b}
</style></head><body>
<h1>Send to ripley</h1>
<p>Pick the video and any photos. Keep this screen open until each one says Done.</p>
<label for=f>Choose videos and pictures</label>
<input id=f type=file accept="video/*,image/*" multiple>
<ul id=list></ul>
<script>
const q=new URLSearchParams(location.search);
const f=document.getElementById('f'),list=document.getElementById('list');
let queue=Promise.resolve();
f.onchange=()=>{for(const file of f.files){const li=document.createElement('li');
li.innerHTML='<b></b><span>Waiting</span>';li.firstChild.textContent=file.name;list.prepend(li);
queue=queue.then(()=>send(file,li.lastChild));}f.value='';};
function send(file,out){return new Promise(done=>{
const u=new URLSearchParams({sexp:q.get('exp'),ssig:q.get('sig'),size:file.size,name:file.name});
const x=new XMLHttpRequest();x.open('PUT','/upload?'+u);
x.upload.onprogress=e=>{if(e.lengthComputable)out.textContent=Math.floor(100*e.loaded/e.total)+'%';};
x.onload=()=>{let r={};try{r=JSON.parse(x.responseText)}catch(e){}
if(x.status===200){out.className='ok';out.innerHTML='Done: '+r.bytes.toLocaleString()+' bytes<br><small></small>';out.lastChild.textContent=r.sha256;}
else{out.className='bad';out.textContent=r.error||'The send failed.';}done();};
x.onerror=()=>{out.className='bad';out.textContent='The send failed. Is Tailscale on?';done();};
x.send(file);});}
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    server_version = "SwappPhoneIntake/1"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _send(self, code, body, content_type):
        data = body if isinstance(body, bytes) else body.encode()
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    def _json(self, code, payload):
        self._send(code, json.dumps(payload), "application/json")

    def do_OPTIONS(self):
        self._send(204, b"", "text/plain")

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/health":
            self._send(200, b"ok", "text/plain")
            return
        if path == "/send":
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            secret = os.environ.get("PHONE_INTAKE_SECRET", "")
            try:
                exp = int(query.get("exp", ["0"])[0])
            except ValueError:
                exp = 0
            if not secret or exp < int(time.time()) or not session_ok(secret, exp, query.get("sig", [""])[0]):
                self._send(403, "This send link has expired. Open New video on the site again.", "text/plain; charset=utf-8")
                return
            self._send(200, SEND_PAGE, "text/html; charset=utf-8")
            return
        self._json(404, {"error": "Not found."})

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/upload":
            self._json(404, {"error": "Not found."})
            return
        query = urllib.parse.parse_qs(parsed.query)
        secret = os.environ.get("PHONE_INTAKE_SECRET", "")
        if not secret:
            self._json(503, {"error": "The send road is not set up."})
            return
        try:
            exp = int(query.get("exp", ["0"])[0])
            size = int(query.get("size", ["0"])[0])
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._json(400, {"error": "The ticket is not valid."})
            return
        raw_name = query.get("name", [""])[0]
        name = safe_name(raw_name)
        if size < 1 or size > MAX_BYTES or length != size:
            self._json(400, {"error": "The file size does not match the ticket."})
            return
        if "ssig" in query:
            # Send-page upload: the page link's signature covers every file.
            try:
                sexp = int(query.get("sexp", ["0"])[0])
            except ValueError:
                sexp = 0
            if sexp < int(time.time()) or not session_ok(secret, sexp, query.get("ssig", [""])[0]):
                self._json(403, {"error": "This send link has expired. Open New video on the site again."})
                return
        else:
            if name != raw_name:
                self._json(400, {"error": "The file name is not valid."})
                return
            if exp < int(time.time()) or not ticket_ok(secret, exp, size, name, query.get("sig", [""])[0]):
                self._json(403, {"error": "The ticket is not valid."})
                return

        os.makedirs(INBOX, exist_ok=True)
        final = os.path.join(INBOX, name)
        if os.path.exists(final):
            stem, dot, ext = name.rpartition(".")
            if not dot:
                stem, ext = name, ""
            n = 1
            while True:
                candidate = "%s-%d%s%s" % (stem, n, dot, ext)
                final = os.path.join(INBOX, candidate)
                if not os.path.exists(final):
                    name = candidate
                    break
                n += 1
        tmp = final + ".part"
        digest = hashlib.sha256()
        left = size
        try:
            with open(tmp, "wb") as handle:
                while left > 0:
                    chunk = self.rfile.read(min(1024 * 1024, left))
                    if not chunk:
                        break
                    handle.write(chunk)
                    digest.update(chunk)
                    left -= len(chunk)
        except (ConnectionError, BrokenPipeError, OSError):
            left = 1
        if left != 0:
            try:
                os.remove(tmp)
            except OSError:
                pass
            self._json(400, {"error": "The file stopped early."})
            return
        os.replace(tmp, final)
        got = os.path.getsize(final)
        receipt = {"name": name, "bytes": got, "sha256": digest.hexdigest()}
        with open(final + ".receipt.json", "w", encoding="utf-8") as handle:
            json.dump(receipt, handle)
        self._json(200, receipt)


def self_test():
    import tempfile
    import threading
    import urllib.error
    import urllib.request

    global INBOX
    secret = "self-test-secret"
    os.environ["PHONE_INTAKE_SECRET"] = secret
    INBOX = tempfile.mkdtemp(prefix="phone-intake-")
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    exp = int(time.time()) + 60
    body = b"clip"
    name = "clip.mp4"
    sig = sign_ticket(secret, exp, len(body), name)
    url = "http://%s:%d/upload?exp=%d&size=%d&name=%s&sig=%s" % (host, port, exp, len(body), name, sig)
    request = urllib.request.Request(url, data=body, method="PUT")
    with urllib.request.urlopen(request) as response:
        payload = json.loads(response.read().decode())
    assert payload["bytes"] == 4, payload
    assert payload["sha256"] == hashlib.sha256(body).hexdigest()
    saved = open(os.path.join(INBOX, "clip.mp4"), "rb").read()
    assert saved == body
    bad = urllib.request.Request(url + "00", data=body, method="PUT")
    try:
        urllib.request.urlopen(bad)
        raise SystemExit("bad ticket was accepted")
    except urllib.error.HTTPError as error:
        assert error.code == 403, error.code
    sexp = int(time.time()) + 60
    ssig = sign_session(secret, sexp)
    page = "http://%s:%d/send?exp=%d&sig=%s" % (host, port, sexp, ssig)
    with urllib.request.urlopen(page) as response:
        assert b"Send to ripley" in response.read()
    try:
        urllib.request.urlopen(page + "00")
        raise SystemExit("bad send link was accepted")
    except urllib.error.HTTPError as error:
        assert error.code == 403, error.code
    put = "http://%s:%d/upload?sexp=%d&ssig=%s&size=4&name=%s" % (
        host, port, sexp, ssig, urllib.parse.quote("PXL 1.mp4"))
    with urllib.request.urlopen(urllib.request.Request(put, data=body, method="PUT")) as response:
        payload = json.loads(response.read().decode())
    assert payload["name"] == "PXL_1.mp4" and payload["bytes"] == 4, payload
    server.shutdown()
    print("ok")


if __name__ == "__main__":
    if "--sign" in sys.argv:
        i = sys.argv.index("--sign")
        print(sign_ticket(sys.argv[i + 1], int(sys.argv[i + 2]), int(sys.argv[i + 3]), sys.argv[i + 4]))
        raise SystemExit(0)
    if "--sign-session" in sys.argv:
        i = sys.argv.index("--sign-session")
        print(sign_session(sys.argv[i + 1], int(sys.argv[i + 2])))
        raise SystemExit(0)
    if "--self-test" in sys.argv:
        self_test()
        raise SystemExit(0)
    host = sys.argv[sys.argv.index("--host") + 1] if "--host" in sys.argv else "127.0.0.1"
    port = int(sys.argv[sys.argv.index("--port") + 1] if "--port" in sys.argv else 8932)
    if not os.environ.get("PHONE_INTAKE_SECRET"):
        sys.stderr.write("PHONE_INTAKE_SECRET is not set\n")
        raise SystemExit(1)
    httpd = ThreadingHTTPServer((host, port), Handler)
    print("swapp phone intake on %s:%d -> %s" % (host, port, INBOX), flush=True)
    httpd.serve_forever()
