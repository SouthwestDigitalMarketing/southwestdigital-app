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
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BYTES = 3_000_000_000
SAFE = re.compile(r"[^A-Za-z0-9._-]+")
INBOX = os.path.expanduser(os.environ.get("PHONE_INTAKE_DIR", "~/swapp-phone-intake"))
# One pick on the send page is one batch, and one batch becomes one episode.
BATCH = re.compile(r"^[A-Za-z0-9-]{1,40}$")
BATCH_LOCK = threading.Lock()


def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return default


def write_json(path, value):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(value, handle)
    os.replace(tmp, path)


def note_batch_file(folder, expected, name, size):
    with BATCH_LOCK:
        meta_path = os.path.join(folder, ".batch.json")
        meta = read_json(meta_path, None) or {"created": int(time.time()), "expected": expected, "files": {}}
        meta["expected"] = max(int(meta.get("expected") or 0), expected)
        meta["files"][name] = size
        write_json(meta_path, meta)


def live_batches(inbox):
    """Batches still in the inbox: sending, or received and waiting for Showrunner."""
    out = []
    try:
        names = os.listdir(inbox)
    except OSError:
        return out
    for batch in names:
        folder = os.path.join(inbox, batch)
        if not BATCH.match(batch) or not os.path.isdir(folder):
            continue
        meta = read_json(os.path.join(folder, ".batch.json"), None)
        if not meta:
            continue
        files, total, done = [], 0, 0
        for name, size in sorted(meta.get("files", {}).items()):
            final = os.path.join(folder, name)
            if os.path.exists(final + ".receipt.json"):
                got, state = size, "received"
            elif os.path.exists(final + ".part"):
                got, state = min(os.path.getsize(final + ".part"), size), "sending"
            else:
                got, state = 0, "failed"
            files.append({"name": name, "bytes": size, "done": got, "state": state})
            total += size
            done += got
        received = sum(1 for item in files if item["state"] == "received")
        expected = int(meta.get("expected") or len(files))
        if any(item["state"] == "sending" for item in files):
            state = "sending"
        elif received >= expected:
            state = "received"
        else:
            state = "incomplete"
        out.append({"batch": batch, "created": meta.get("created"), "state": state, "expected": expected,
                    "received": received, "bytes": total, "done": done, "files": files})
    return out


def queue_status(inbox):
    """Live inbox batches merged with what Showrunner reports in queue.json."""
    merged = {item["batch"]: item for item in live_batches(inbox)}
    for item in read_json(os.path.join(inbox, "queue.json"), {}).get("batches", []):
        if isinstance(item, dict) and BATCH.match(str(item.get("batch", ""))):
            current = merged.get(item["batch"], {})
            if current.get("state") == "sending":
                continue
            merged[item["batch"]] = {**current, **item}
    videos = sorted(merged.values(), key=lambda item: item.get("created") or 0, reverse=True)
    return {"videos": videos[:30]}


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
h1{font-size:24px;margin:0 0 8px}h2{font-size:20px;margin:32px 0 8px}p{color:#475569;margin:0 0 20px}
label{display:block;background:#0f172a;color:#fff;border-radius:999px;padding:16px;text-align:center;font-weight:600}
input{display:none}ul{list-style:none;padding:0;margin:12px 0 0}
li{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;word-break:break-word}
b{display:block}.ok{color:#15803d}.bad{color:#be123c}small{display:block;color:#64748b}
.bar{height:6px;background:#e2e8f0;border-radius:3px;margin-top:8px}.bar i{display:block;height:6px;background:#0f172a;border-radius:3px}
</style></head><body>
<h1>Send to ripley</h1>
<p>Each time you choose files, that becomes one new video. Pick the video and its photos together. Keep this screen open while it sends.</p>
<label for=f>Choose videos and pictures</label>
<input id=f type=file accept="video/*,image/*" multiple>
<h2>Your videos</h2>
<ul id=queue><li>Loading...</li></ul>
<script>
const q=new URLSearchParams(location.search);
const f=document.getElementById('f'),queueEl=document.getElementById('queue');
let chain=Promise.resolve();
f.onchange=()=>{const files=[...f.files];f.value='';if(!files.length)return;
const batch=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
for(const file of files)chain=chain.then(()=>send(file,batch,files.length));chain.then(refresh);setTimeout(refresh,800);};
function send(file,batch,count){return new Promise(done=>{
const u=new URLSearchParams({sexp:q.get('exp'),ssig:q.get('sig'),size:file.size,name:file.name,batch,count});
const x=new XMLHttpRequest();x.open('PUT','/upload?'+u);
x.onload=x.onerror=()=>done();x.send(file);});}
const when=t=>t?new Date(t*1000).toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'}):'';
const mb=n=>(n/1e6).toLocaleString(undefined,{maximumFractionDigits:0})+' MB';
function line(v){
 if(v.state==='sending'){const pct=v.bytes?Math.floor(100*v.done/v.bytes):0;
  return ['Sending '+Math.min(v.received+1,v.expected)+' of '+v.expected+' — '+pct+'%',mb(v.done)+' of '+mb(v.bytes),pct];}
 if(v.state==='received')return ['Received. Making the episode...','Up to a minute.'];
 if(v.state==='incomplete')return ['Some files did not arrive','Send them again.'];
 if(v.state==='error')return ['Needs attention',v.message||''];
 return [v.stage||'Episode ready',v.project||''];}
function refresh(){fetch('/status.json?'+new URLSearchParams({exp:q.get('exp'),sig:q.get('sig')}),{cache:'no-store'})
.then(r=>r.json()).then(d=>{queueEl.innerHTML='';
 if(!d.videos.length){queueEl.innerHTML='<li>Nothing yet.</li>';return;}
 for(const v of d.videos){const li=document.createElement('li');const [head,sub,pct]=line(v);
  const t=document.createElement('b');t.textContent=v.project||('New video, sent '+when(v.created));li.append(t);
  const h=document.createElement('span');h.textContent=head;h.className=v.state==='error'||v.state==='incomplete'?'bad':(v.project?'ok':'');li.append(h);
  if(sub){const s=document.createElement('small');s.textContent=sub;li.append(s);}
  if(pct!==undefined){const bar=document.createElement('div');bar.className='bar';const i=document.createElement('i');i.style.width=pct+'%';bar.append(i);li.append(bar);}
  queueEl.append(li);}}).catch(()=>{});}
refresh();setInterval(refresh,4000);
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
        if path == "/status.json":
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            secret = os.environ.get("PHONE_INTAKE_SECRET", "")
            try:
                exp = int(query.get("exp", ["0"])[0])
            except ValueError:
                exp = 0
            if not secret or exp < int(time.time()) or not session_ok(secret, exp, query.get("sig", [""])[0]):
                self._json(403, {"error": "This link has expired."})
                return
            self._json(200, queue_status(INBOX))
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

        folder = INBOX
        batch = query.get("batch", [""])[0]
        if batch and "ssig" in query:
            if not BATCH.match(batch):
                self._json(400, {"error": "The batch is not valid."})
                return
            folder = os.path.join(INBOX, batch)
        os.makedirs(folder, exist_ok=True)
        final = os.path.join(folder, name)
        if os.path.exists(final):
            stem, dot, ext = name.rpartition(".")
            if not dot:
                stem, ext = name, ""
            n = 1
            while True:
                candidate = "%s-%d%s%s" % (stem, n, dot, ext)
                final = os.path.join(folder, candidate)
                if not os.path.exists(final):
                    name = candidate
                    break
                n += 1
        tmp = final + ".part"
        if folder != INBOX:
            try:
                expected = max(1, min(int(query.get("count", ["1"])[0]), 200))
            except ValueError:
                expected = 1
            note_batch_file(folder, expected, name, size)
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
    put = "http://%s:%d/upload?sexp=%d&ssig=%s&size=4&name=a.mp4&batch=b1&count=2" % (host, port, sexp, ssig)
    with urllib.request.urlopen(urllib.request.Request(put, data=body, method="PUT")) as response:
        assert json.loads(response.read().decode())["name"] == "a.mp4"
    status_url = "http://%s:%d/status.json?exp=%d&sig=%s" % (host, port, sexp, ssig)
    with urllib.request.urlopen(status_url) as response:
        videos = json.loads(response.read().decode())["videos"]
    assert videos[0]["batch"] == "b1" and videos[0]["state"] == "incomplete", videos
    with urllib.request.urlopen(urllib.request.Request(put.replace("a.mp4", "b.jpg"), data=body, method="PUT")):
        pass
    with urllib.request.urlopen(status_url) as response:
        videos = json.loads(response.read().decode())["videos"]
    assert videos[0]["state"] == "received" and videos[0]["received"] == 2, videos
    write_json(os.path.join(INBOX, "queue.json"), {"batches": [{"batch": "b1", "state": "episode", "project": "TREB X"}]})
    with urllib.request.urlopen(status_url) as response:
        videos = json.loads(response.read().decode())["videos"]
    assert videos[0]["project"] == "TREB X", videos
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
