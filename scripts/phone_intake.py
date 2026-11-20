#!/usr/bin/env python3
"""Signed phone upload onto ripley.

SWapp signs a send-page link. The phone opens it here (a plain link, so the
HTTPS site never makes an HTTP request) and PUTs each file to this server.
The signature is the password. Bind the tailnet address, not the open internet.
Files land in ~/swapp-phone-intake unless PHONE_INTAKE_DIR is set.
"""

import glob
import hashlib
import hmac
import json
import os
import re
import shutil
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BYTES = 60_000_000_000
# The Send to ripley phone app, built on ripley (android/phone-send/README.md).
APK = os.path.expanduser(os.environ.get("PHONE_INTAKE_APK", "~/.local/share/swapp-phone-intake/send-to-ripley.apk"))
SAFE = re.compile(r"[^A-Za-z0-9._-]+")
INBOX = os.path.expanduser(os.environ.get("PHONE_INTAKE_DIR", "~/swapp-phone-intake"))
# Published client reports Sol saves on ripley: <root>/<client>/reports/<year>/<YYYY-MM>.pdf.
# Served read-only to Tom's phone over the tailnet; the files never leave ripley.
REPORTS_ROOT = os.path.expanduser(os.environ.get("PHONE_INTAKE_REPORTS_ROOT", "~/projects/clients"))
# The clients the Reports page shows, with their proper names: {"<folder>": "BnB Getaway LLC"}.
# Today that is the clients with a Double account (Tom, 2026-11-17: Double reports only).
REPORT_NAMES = os.path.expanduser(os.environ.get("PHONE_INTAKE_REPORT_NAMES", "~/.config/swapp-phone-intake/report-names.json"))
# Each client's month status, written hourly by scripts/report_status.py from Double.
REPORT_STATUS = os.path.expanduser(os.environ.get("PHONE_INTAKE_REPORT_STATUS", "~/.local/share/swapp-phone-intake/report-status.json"))
# Privacy mode for screen recordings (Tom, 2026-11-20): a header switch on every Reports page,
# remembered in this cookie. When on, the server leaves names, account digits and notes out of
# the HTML, and the viewer blacks out the client's name and account-like numbers in the PDF.
PRIVACY_COOKIE = "swapp_privacy"
# Extra words to black out per client (owner names, a trading name): {"<folder>": ["Jane Smith"]}.
# Each client's privacy letter, fixed once given so 'Client C' never changes hands: {"<folder>": 2}.
REPORT_ALIASES = os.path.expanduser(os.environ.get("PHONE_INTAKE_PRIVACY_ALIASES", "~/.local/share/swapp-phone-intake/privacy-aliases.json"))
ALIAS_LOCK = threading.Lock()
REPORT_PRIVACY_WORDS = os.path.expanduser(os.environ.get("PHONE_INTAKE_PRIVACY_WORDS", "~/.config/swapp-phone-intake/privacy-words.json"))
# Name words too common to black out on their own ("Rental Properties" is an account, not a client).
PRIVACY_COMMON = {"llc", "pllc", "inc", "ltd", "corp", "co", "company", "the", "and", "of", "for", "dba", "group",
                  "services", "service", "solutions", "properties", "property", "rental", "rentals", "holdings",
                  "enterprises", "partners", "management", "personal", "business", "equity", "capital", "cash",
                  "bank", "income", "revenue", "assets", "asset", "investments", "investment", "financial", "trust",
                  "home", "homes", "real", "estate", "realty", "consulting", "llp", "pc", "pa", "car", "cars", "auto",
                  "city", "discount", "warehouse"}
# PDF.js (pdfjs-dist 3.11.174) for the report viewer, served from here so nothing loads from a CDN.
PDFJS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pdfjs")
PDFJS_FILES = {"pdf.min.js": "application/javascript", "pdf.worker.min.js": "application/javascript"}
# A signed Reports link lasts this long; an open viewer page asks for a fresh one before it runs out.
REPORT_SESSION_SECONDS = 3 * 3600
REPORT_RENEW_BELOW = 3600
CLIENT_DIR = re.compile(r"^[a-z0-9][a-z0-9_-]{0,80}$")
REPORT_YEAR = re.compile(r"^\d{4}$")
REPORT_FILE = re.compile(r"^(\d{4})-(\d{2})\.pdf$")
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]
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
                got = size
                state = "reused" if (read_json(final + ".receipt.json", None) or {}).get("reusedFrom") else "received"
            elif os.path.exists(final + ".part"):
                got = min(os.path.getsize(final + ".part"), size)
                state = "sending" if time.time() - os.path.getmtime(final + ".part") < 90 else "paused"
            else:
                got, state = 0, "failed"
            files.append({"name": name, "bytes": size, "done": got, "state": state})
            total += size
            done += got
        received = sum(1 for item in files if item["state"] in ("received", "reused"))
        reused = sum(1 for item in files if item["state"] == "reused")
        expected = int(meta.get("expected") or len(files))
        if any(item["state"] == "sending" for item in files):
            state = "sending"
        elif any(item["state"] == "paused" for item in files):
            state = "paused"
        elif received >= expected:
            state = "received"
        else:
            state = "incomplete"
        out.append({"batch": batch, "created": meta.get("created"), "state": state, "expected": expected,
                    "received": received, "reused": reused, "bytes": total, "done": done, "files": files})
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
    return {"videos": videos[:6]}


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


def app_key(secret):
    """A short fixed key for the app download link, so it fits on one line of a phone screen.

    The full signed link wrapped in Herdr on the phone and a tap opened only its first line
    (2026-11-15). Twelve hex digits is plenty for a download that is reachable on the tailnet only.
    """
    return hmac.new(secret.encode(), b"app-download", hashlib.sha256).hexdigest()[:12]


def session_message(exp):
    return ("session\n%s" % exp).encode()


def sign_session(secret, exp):
    return hmac.new(secret.encode(), session_message(exp), hashlib.sha256).hexdigest()


def session_ok(secret, exp, sig):
    if not isinstance(sig, str) or len(sig) != 64:
        return False
    return hmac.compare_digest(sign_session(secret, exp), sig)


def finalize_upload(final, name):
    tmp = final + ".part"
    digest = hashlib.sha256()
    with open(tmp, "rb") as handle:
        while True:
            block = handle.read(8 * 1024 * 1024)
            if not block:
                break
            digest.update(block)
    os.replace(tmp, final)
    receipt = {"name": name, "bytes": os.path.getsize(final), "sha256": digest.hexdigest()}
    with open(final + ".receipt.json", "w", encoding="utf-8") as handle:
        json.dump(receipt, handle)
    return receipt


def upload_state(folder, name, size):
    final = os.path.join(folder, name)
    receipt = read_json(final + ".receipt.json", None)
    if receipt:
        return {"received": size, "done": True, "receipt": receipt}
    try:
        received = os.path.getsize(final + ".part")
    except OSError:
        received = 0
    return {"received": received, "done": False}


def head_hash(path):
    """SHA-256 of a file's first MiB; with the exact size it identifies a clip whatever it is called."""
    with open(path, "rb") as handle:
        return hashlib.sha256(handle.read(1024 * 1024)).hexdigest()


def known_copy(inbox, name, size, batch, head=""):
    """A file ripley already received in another batch: same size and first MiB (head), else same name and size.

    The phone browser and the app can name one clip differently (4090.mp4 against
    PXL_20261115_192514234.mp4, 2026-11-15), so the app sends head and the name is ignored.
    """
    pattern = "*.receipt.json" if head else glob.escape(name) + ".receipt.json"
    for receipt_path in sorted(glob.glob(os.path.join(glob.escape(inbox), "*", pattern))
                               + glob.glob(os.path.join(glob.escape(inbox), "done", "*", pattern))):
        folder = os.path.dirname(receipt_path)
        if os.path.basename(folder) == batch:
            continue
        receipt = read_json(receipt_path, None) or {}
        media = receipt_path[: -len(".receipt.json")]
        if receipt.get("bytes") == size and os.path.isfile(media) and os.path.getsize(media) == size:
            if head and head_hash(media) != head:
                continue
            return media, receipt
    return None


def reuse_copy(folder, name, size, expected, found):
    """Put the copy ripley already has into this batch instead of sending it again."""
    media, receipt = found
    os.makedirs(folder, exist_ok=True)
    final = os.path.join(folder, name)
    for leftover in (final + ".part", final):
        if os.path.exists(leftover):
            os.remove(leftover)
    try:
        os.link(media, final)
    except OSError:
        shutil.copy2(media, final)
    write_json(final + ".receipt.json", {**receipt, "reusedFrom": os.path.relpath(media, INBOX)})
    note_batch_file(folder, expected, name, size)
    return {"received": size, "done": True, "reused": True}


def cancel_batch(inbox, batch):
    """Throw away a batch the phone stopped sending; one that fully arrived is already being made."""
    folder = os.path.join(inbox, batch)
    if not os.path.isdir(folder):
        return 200, {"cancelled": False}
    row = next((item for item in live_batches(inbox) if item["batch"] == batch), None)
    if row and row["state"] == "received":
        return 409, {"error": "Everything arrived; ripley is already making this video."}
    with BATCH_LOCK:
        shutil.rmtree(folder, ignore_errors=True)
    return 200, {"cancelled": True}


def client_name(folder):
    """The client's proper name from REPORT_NAMES, else the folder title-cased ('bnb-getaway' -> 'Bnb Getaway')."""
    named = read_json(REPORT_NAMES, {}) or {}
    if isinstance(named.get(folder), str) and named[folder].strip():
        return named[folder].strip()[:120]
    small = {"and", "of", "the", "llc"}
    words = [w for w in re.split(r"[-_]+", folder) if w]
    return " ".join(w.upper() if w in small - {"and", "of", "the"} else (w if w in small else w.capitalize()) for w in words)


def privacy_on(cookie_header):
    """True when the Privacy switch is on in this browser."""
    import http.cookies
    jar = http.cookies.SimpleCookie()
    try:
        jar.load(cookie_header or "")
    except http.cookies.CookieError:
        return False
    return PRIVACY_COOKIE in jar and jar[PRIVACY_COOKIE].value == "1"


def alias_numbers():
    """Every client's fixed privacy number; new clients get the next one, nobody is renumbered."""
    named = sorted(f for f in (read_json(REPORT_NAMES, {}) or {}) if CLIENT_DIR.match(f))
    with ALIAS_LOCK:
        numbers = {k: v for k, v in (read_json(REPORT_ALIASES, {}) or {}).items() if isinstance(v, int)}
        new = [f for f in named if f not in numbers]
        for folder in new:
            numbers[folder] = max(numbers.values(), default=-1) + 1
        if new:
            write_json(REPORT_ALIASES, numbers)
    return numbers


def client_alias(folder):
    """'Client A', 'Client B', ... fixed per client (REPORT_ALIASES), the same on every page while privacy is on."""
    numbers = alias_numbers()
    i = numbers.get(folder, max(numbers.values(), default=-1) + 1)
    letters = ""
    while True:
        i, r = divmod(i, 26)
        letters = chr(65 + r) + letters
        if not i:
            break
        i -= 1
    return "Client " + letters


def alias_slug(folder):
    """'client-a': the folder name used in links while privacy is on, so the address bar shows no name."""
    return client_alias(folder).lower().replace(" ", "-")


def resolve_folder(token):
    """A real client folder from a link: the folder itself, or its privacy alias ('client-a')."""
    named = [f for f in (read_json(REPORT_NAMES, {}) or {}) if CLIENT_DIR.match(f)]
    if token in named or not re.match(r"^client-[a-z]{1,3}$", token or ""):
        return token
    return next((f for f in named if alias_slug(f) == token), token)


def account_labels():
    """'Account 1', 'Account 2', ... per page, the same account always the same label: an account name can
    carry the client's or an owner's name ('TCB Chk - Owner Personal'), not only digits."""
    seen = {}
    def label(name):
        key = (name or "").strip().lower()
        if key not in seen:
            seen[key] = "Account %d" % (len(seen) + 1)
        return seen[key]
    return label


def mask_digits(text):
    """An account name with its numbers hidden: '*4821 WFB Chk' -> '*•••• WFB Chk'."""
    return re.sub(r"\d{2,}", "\u2022\u2022\u2022\u2022", text or "")


def privacy_hash(word):
    """FNV-1a 32-bit of a word lower-cased to [a-z0-9]; the viewer hashes PDF words the same way,
    so the page can match the client's name without carrying it."""
    h = 0x811C9DC5
    for ch in re.sub(r"[^a-z0-9]", "", word.lower()).encode():
        h = ((h ^ ch) * 0x01000193) & 0xFFFFFFFF
    return h


def privacy_words(folder):
    """Hashes of the words to black out in this client's PDFs: its name, folder and any extras."""
    extra = (read_json(REPORT_PRIVACY_WORDS, {}) or {}).get(folder) or []
    text = " ".join([client_name(folder), folder] + [w for w in extra if isinstance(w, str)])
    words = {w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) >= 2 and w not in PRIVACY_COMMON}
    return sorted(privacy_hash(w) for w in words)


def privacy_toggle(private):
    """The header switch. It sets the cookie for /reports and reloads, so the server redraws the page."""
    label = "&#128274; Privacy on" if private else "Privacy off"
    return ("<button id=pv class='pv%s' type=button aria-pressed=%s title='Hide client names and account numbers'>%s</button>"
            "<script>document.getElementById('pv').onclick=function(){document.cookie='%s=%s;path=/reports;max-age=31536000;samesite=lax';"
            "location.reload();};"
            # A switch flipped in another tab redraws this one too, so no tab is left showing the other mode.
            "setInterval(function(){if((document.cookie.indexOf('%s=1')>=0)!==%s)location.reload();},2000);</script>"
            % (" on" if private else "", "true" if private else "false", label, PRIVACY_COOKIE, "0" if private else "1",
               PRIVACY_COOKIE, "true" if private else "false"))


PRIVACY_STYLE = (".pv{flex:0 0 auto;font:600 14px system-ui,sans-serif;border-radius:999px;padding:6px 12px;cursor:pointer;"
                 "border:1px solid #cbd5e1;background:#fff;color:#334155}.pv.on{background:#7c3aed;border-color:#7c3aed;color:#fff}")


def list_reports(root):
    """Every client in REPORT_NAMES, by name, each with its published months newest first (maybe none)."""
    out = []
    named = read_json(REPORT_NAMES, {}) or {}
    for folder in sorted(named, key=lambda f: client_name(f).lower()):
        if not CLIENT_DIR.match(folder):
            continue
        base = os.path.join(root, folder, "reports")
        months = []
        if not os.path.isdir(base) or os.path.islink(base):
            out.append({"folder": folder, "name": client_name(folder), "months": months})
            continue
        for year in sorted(os.listdir(base), reverse=True):
            year_dir = os.path.join(base, year)
            if not REPORT_YEAR.match(year) or not os.path.isdir(year_dir) or os.path.islink(year_dir):
                continue
            for name in sorted(os.listdir(year_dir), reverse=True):
                match = REPORT_FILE.match(name)
                path = os.path.join(year_dir, name)
                if match and match.group(1) == year and 1 <= int(match.group(2)) <= 12 and os.path.isfile(path) and not os.path.islink(path):
                    months.append({"year": year, "file": name, "label": "%s %s" % (MONTHS[int(match.group(2)) - 1], year)})
        out.append({"folder": folder, "name": client_name(folder), "months": months})
    return out


def report_path(root, folder, year, name):
    """The real file for /reports/<folder>/<year>/<YYYY-MM>.pdf, or None if it is not a published report."""
    match = REPORT_FILE.match(name)
    if not (CLIENT_DIR.match(folder) and REPORT_YEAR.match(year) and match and match.group(1) == year):
        return None
    path = os.path.join(root, folder, "reports", year, name)
    real = os.path.realpath(path)
    if not real.startswith(os.path.realpath(root) + os.sep) or real != os.path.abspath(path) or not os.path.isfile(real):
        return None
    return real


# Month status for each client, shown as a legend first so Tom can weigh it before the rows use it
# (Tom, 2026-11-17). Internal target: last month closed and its report issued within the first
# five business days; weekly Friday client notices in between. (key, label, color, meaning)
REPORT_STATUSES = [
    ("done", "Done", "#15803d", "Last month closed and report published; no open client questions."),
    ("on-track", "On track", "#2563eb", "Within the first 5 business days; close in progress; client owes nothing."),
    ("waiting", "Waiting on client", "#d97706", "Questions unanswered or statements missing in Double; we cannot finish yet."),
    ("late", "Late", "#be123c", "Past the 5th business day; client owes nothing; we have not published."),
    ("catching-up", "Catching up", "#7c3aed", "Still bringing older months up to date; last month's close has not started in Double."),
    ("none", "No report yet", "#94a3b8", "Nothing published for this client yet."),
]


def status_row(key, name, href=None, note=None):
    """One client row in the look its status gives it: a colored edge and a short tag on the right.
    A legend sample carries its meaning inside the row as a second line (note)."""
    import html
    if key is None:  # reports saved, status not worked out yet: a plain row
        return "<a class=row href='%s'>%s</a>" % (href, html.escape(name)) if href else "<div class=row>%s</div>" % html.escape(name)
    label, color = next(((l, c) for k, l, c, _ in REPORT_STATUSES if k == key), ("", "#94a3b8"))
    tag = "" if key == "none" else "<span class=tag style='color:%s;border-color:%s'>%s</span>" % (color, color, html.escape(label))
    edge = "" if key == "none" else " style='border-left:5px solid %s'" % color
    text = html.escape(name) + ("<small>%s</small>" % html.escape(note) if note else "")
    inner = "<span class=nm>%s</span>%s" % (text, tag)
    if href and key != "none":
        return "<a class='row st'%s href='%s'>%s</a>" % (edge, href, inner)
    return "<div class='row st %s'%s>%s</div>" % ("off" if key == "none" else "", edge, inner)


def status_legend():
    """A closed 'Legend' button that opens to each status: a sample row as it will look, then what it means."""
    import html
    items = "".join("<div class=item>%s</div>" % status_row(key, "Example Client LLC", note=meaning)
                    for key, _, _, meaning in REPORT_STATUSES)
    return "<details class=legend><summary>Legend</summary><div class=items>%s</div></details>" % items


def status_reason(info, today=None, private=False):
    """Why a client has its tag, in one or two plain sentences (Tom, 2026-11-18: tap the client, see why)."""
    import datetime as dt
    status = info.get("status")
    try:
        year, month = (int(x) for x in (info.get("month") or "").split("-"))
        name = dt.date(year, month, 1).strftime("%B")
    except ValueError:
        name = "Last month"
    try:
        due = dt.date.fromisoformat(info.get("due") or "")
    except ValueError:
        due = None
    due_text = "%s, %s %d" % (due.strftime("%a"), due.strftime("%b"), due.day) if due else "the 5th business day"
    close, progress = info.get("close"), info.get("progress")
    try:
        percent = "%d%%" % round(float(str(progress).rstrip("%")))
    except ValueError:
        percent = None
    if status == "done":
        return ["%s report is published." % name]
    if status == "waiting":
        return ["Waiting on the client: %s." % info["waiting"].rstrip(".") if info.get("waiting") and not private
                else "Waiting on the client to answer questions or send statements in Double."]
    if status == "catching-up":
        return ["Still finishing older months.", "%s's close isn't open in Double yet." % name]
    if info.get("tasksTotal") and close != "done":
        percent = "0%" if not info.get("tasksDone") else "%d%%" % round(100 * info["tasksDone"] / info["tasksTotal"])
    if close == "done" and not info.get("saved"):
        work = "%s's close is done, but the report isn't saved here yet." % name
    elif close in (None, "notStarted") or percent in (None, "0%"):
        work = "We haven't started %s's close in Double yet." % name
    else:
        work = "%s's close in Double is %s done." % (name, percent)
    if status == "late":
        return ["%s report was due %s." % (name, due_text), work]
    return ["%s report is due %s." % (name, due_text), work]


def days_late(info, today=None):
    """Days past the due date for a late client, else 0."""
    import datetime as dt
    if info.get("status") != "late":
        return 0
    try:
        return max(0, ((today or dt.date.today()) - dt.date.fromisoformat(info.get("due") or "")).days)
    except ValueError:
        return 0


def month_label(ym):
    """'202610' -> 'Oct 2026'."""
    import datetime as dt
    try:
        return dt.date(int(ym[:4]), int(ym[4:6]), 1).strftime("%b %Y")
    except (TypeError, ValueError):
        return str(ym)


def statement_list(info, mask=lambda text: text):
    """'Statements for October': one line per owed account, arrived (date) / missing / not issued yet."""
    import html
    accounts = info.get("statements") or []
    if not accounts or info.get("status") == "catching-up":
        return ""
    ym = info.get("month") or ""
    title = month_label(ym.replace("-", "")).split()[0] if ym else "last month"
    rows = []
    for a in accounts:
        state = a["months"].get(ym)
        if state == "missing":
            mark, text, cls = "&#10007;", "Missing", "miss"
        elif state == "not issued yet":
            mark, text, cls = "&#9675;", "Not issued yet (%s)" % a["cadence"], "wait"
        elif state == "none on file":
            mark, text, cls = "?", "None on file", "wait"
        else:
            mark, text, cls = "&#10003;", "In, %s" % month_day(state), "ok"
        rows.append("<li class=%s><span>%s</span><b>%s</b><em>%s</em><small>%s</small></li>"
                    % (cls, mark, html.escape(mask(a["name"])), html.escape(text), html.escape(statement_dates(a))))
    for name in info.get("unchecked") or []:
        rows.append("<li class=wait><span>?</span><b>%s</b><em>Can't check: no account number in Double</em></li>" % html.escape(mask(name)))
    return "<div class=stm><b>Statements for %s</b><ul>%s</ul></div>" % (html.escape(title), "".join(rows))


def feed_list(info, mask=lambda text: text, private=False):
    """'Bank feeds': each connected account as read from the QuickBooks Banking page, with when it was read."""
    import datetime as dt
    import html
    feed = info.get("feeds") or {}
    accounts = feed.get("accounts") or []
    if not accounts:
        return "<div class=stm><b>Bank feeds</b><ul><li class=wait><span>?</span><b>Not checked yet</b>" \
               "<em>Read from the QuickBooks Banking page; nothing recorded for this client.</em></li></ul></div>"
    rows = []
    for a in accounts:
        state = a.get("state")
        mark, cls = {"ok": ("&#10003;", "ok"), "stale": ("!", "miss"), "disconnected": ("&#10007;", "miss"),
                     "error": ("&#10007;", "miss")}.get(state, ("?", "wait"))
        label = {"ok": "Connected", "stale": "Not updating", "disconnected": "Disconnected", "error": "Error"}.get(state, state or "")
        detail = "Last updated %s" % month_day(a.get("lastUpdated"))
        if a.get("pending") is not None:
            detail += " · %d pending" % a["pending"]
        if a.get("note") and not private:
            detail += " · " + a["note"]
        rows.append("<li class=%s><span>%s</span><b>%s</b><em>%s</em><small>%s</small></li>"
                    % (cls, mark, html.escape(mask(a.get("name") or "")), html.escape(label), html.escape(detail)))
    try:
        age = (dt.date.today() - dt.date.fromisoformat(feed.get("checked") or "")).days
        checked = "today" if age == 0 else ("yesterday" if age == 1 else "%d days ago" % age)
    except ValueError:
        checked = "unknown"
    return "<div class=stm><b>Bank feeds</b> <i>checked in QuickBooks %s</i><ul>%s</ul></div>" % (checked, "".join(rows))


def statement_dates(account):
    """'Covers through Oct 31 · next ends about Nov 30', or the overdue end dates; next dates are estimates."""
    last, nxt, overdue = account.get("lastEnd"), account.get("nextEnd"), account.get("overdue") or []
    if not last:
        return "No statement on file"
    if overdue:
        span = month_day(overdue[0]) if len(overdue) == 1 else "%s to %s" % (month_day(overdue[0]), month_day(overdue[-1]))
        return "Covers through %s · missing: ends %s (%d)" % (month_day(last), span, len(overdue))
    return "Covers through %s · next ends about %s" % (month_day(last), month_day(nxt)) if nxt else "Covers through %s" % month_day(last)


def month_day(iso):
    import datetime as dt
    try:
        day = dt.date.fromisoformat(iso)
        # The year only when it is not this year: 'Oct 31', 'Apr 17, 2025'.
        return "%s %d" % (day.strftime("%b"), day.day) + (", %d" % day.year if day.year != dt.date.today().year else "")
    except (TypeError, ValueError):
        return str(iso)


def missing_for(info, ym):
    """Owed statements that were missing for one report month 'YYYY-MM'."""
    return [a["name"] for a in info.get("statements") or [] if a["months"].get(ym) == "missing"]


def status_facts(info, mask=lambda text: text):
    """What to decide on: whose move, months still open, tasks left, accounts to reconcile, our note to the client."""
    facts = []
    note = info.get("note") or ""
    note_says = any(w in note.lower() for w in ("do not have", "missing", "waiting on", "we need"))
    if info.get("status") != "done":
        if any(a.get("state") in ("disconnected", "error") for a in (info.get("feeds") or {}).get("accounts") or []):
            facts.append(("Whose move", "The client's: reconnect the bank feed"))
        elif info.get("missing"):
            facts.append(("Whose move", "The client's: statements missing"))
        elif info.get("waiting") or note_says:
            facts.append(("Whose move", "The client's (see the note below)"))
        else:
            if info.get("statements") and info.get("unchecked"):
                facts.append(("Whose move", "Ours, for the accounts we can check"))
            else:
                facts.append(("Whose move", "Ours: the client has sent what we need" if info.get("statements") else "Ours"))
    open_months = info.get("openMonths") or []
    if len(open_months) > 1:
        facts.append(("Not closed", "%d months, oldest %s" % (len(open_months), month_label(open_months[0]))))
    elif open_months:
        facts.append(("Open month", month_label(open_months[0])))
    if info.get("lastClosed"):
        facts.append(("Last closed", month_label(info["lastClosed"])))
    with_dates = [a for a in info.get("statements") or [] if a.get("lastEnd")]
    if with_dates:
        earliest = min(with_dates, key=lambda a: a["lastEnd"])
        gap = len(info.get("statements") or []) - len(with_dates)
        facts.append(("All statements in through", month_day(earliest["lastEnd"]) + (" (%s)" % mask(earliest["name"]) if len(with_dates) > 1 else "")
                      + (", %d with none on file" % gap if gap else "")))
    if info.get("tasksTotal"):
        facts.append(("Close tasks", "%d of %d done" % (info.get("tasksDone") or 0, info["tasksTotal"])))
    if info.get("toReconcile"):
        facts.append(("Not reconciled", ", ".join(mask(n) for n in info["toReconcile"])))
    return facts, note


def reports_page(root, folder, query, private=False):
    """HTML for the client list, or one client's months. Links keep the signed exp/sig."""
    import html
    sign = "?" + query
    clients = list_reports(root)
    style = ("<meta name=viewport content='width=device-width,initial-scale=1'><style>"
             "body{font:17px/1.45 system-ui,sans-serif;margin:0;padding:24px;background:#f8fafc;color:#0f172a}"
             "h1{font-size:24px;margin:0 0 12px}a.row{display:block;background:#fff;border:1px solid #e2e8f0;border-radius:10px;"
             "padding:10px 14px;margin-bottom:6px;color:#0f172a;text-decoration:none;font-weight:600}"
             "div.row{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;margin-bottom:6px;font-weight:600;color:#94a3b8}"
             "small{display:block;color:#64748b;font-weight:400}"
             ".legend{margin:0 0 14px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}"
             ".legend summary{display:flex;justify-content:space-between;align-items:center;cursor:pointer;list-style:none;"
             "padding:12px 14px;font-size:15px;font-weight:600;color:#0f172a}"
             ".legend summary::-webkit-details-marker{display:none}.legend summary:after{content:'\\25BE';color:#64748b}"
             ".legend[open] summary{border-bottom:1px solid #e2e8f0}.legend[open] summary:after{content:'\\25B4'}"
             ".legend .items{padding:4px 12px 12px;background:#f8fafc}"
             ".legend .item{margin-top:8px}.legend .item small{font-size:13px;margin-top:2px}.legend .st{align-items:flex-start}"
             ".st,a.row.st{display:flex;align-items:center;justify-content:space-between;gap:10px}.st .nm{min-width:0}"
             ".tag{flex:0 0 auto;font-size:12px;font-weight:600;border:1px solid;border-radius:999px;padding:1px 8px;background:#fff}"
             ".why{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin:0 0 16px}"
             ".why .head{display:flex;align-items:center;gap:10px;margin-bottom:6px}.why .late{font-size:14px;font-weight:700}"
             ".why .tag{display:inline-block}.why p{margin:0}.why p+p{margin-top:2px;color:#334155}"
             ".why dl{margin:6px 0 0;font-size:15px}"
             ".why dt{color:#64748b;font-size:13px;margin-top:10px}.why dd{margin:0;font-weight:600}"
             ".why blockquote{margin:10px 0 0;padding:8px 10px;background:#f8fafc;border-radius:8px;font-size:14px;color:#334155}"
             ".why blockquote b{display:block;font-size:12px;color:#64748b;margin-bottom:2px}"
             ".stm{margin-top:10px}.stm>b{font-size:13px;color:#64748b}.stm ul{list-style:none;margin:4px 0 0;padding:0}"
             ".stm li{position:relative;padding:8px 0 8px 24px;border-top:1px solid #f1f5f9;font-size:15px}"
             ".stm li span{position:absolute;left:2px;top:8px}.stm li b,.stm li em{display:block}"
             ".stm li em{font-style:normal;color:#475569}.stm .ok span{color:#15803d}.stm .miss span,.stm .miss em{color:#be123c;font-weight:600}"
             ".stm li small{margin:2px 0 0;font-size:13px;color:#64748b}.stm>i{font-style:normal;font-size:12px;color:#94a3b8}.stm .wait span{color:#94a3b8}small.gap{color:#be123c;font-weight:600}"
             ".why small{margin-top:8px;font-size:12px}h2{font-size:15px;color:#64748b;margin:0 0 8px;font-weight:600}"
             "div.row.st:not(.off){background:#fff;color:#0f172a}a.back{color:#475569;display:inline-block;margin-bottom:12px}"
             ".top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px}.top h1{margin:0}"
             + PRIVACY_STYLE + "</style>")
    mask = account_labels() if private else (lambda text: text)
    shown = (lambda c: client_alias(c["folder"])) if private else (lambda c: c["name"])
    slug = (lambda f: alias_slug(f)) if private else (lambda f: f)
    if folder is None:
        # Name only, one compact row each (20 to 50 clients), in the look of last month's status
        # (Tom, 2026-11-17). A client without saved reports is grey and does not open.
        statuses = (read_json(REPORT_STATUS, {}) or {}).get("clients") or {}
        known = {k for k, _, _, _ in REPORT_STATUSES}
        def row(c):
            status = (statuses.get(c["folder"]) or {}).get("status")
            key = status if status in known else ("none" if not c["months"] else None)
            return status_row(key, shown(c), href="/reports/%s%s" % (slug(c["folder"]), sign))
        rows = "".join(row(c) for c in clients) or "<p>No clients set up for reports yet.</p>"
        return ("<!doctype html><html lang=en><head><meta charset=utf-8><title>Reports</title>%s</head><body>"
                "<div class=top><h1>Reports</h1>%s</div>%s%s</body></html>" % (style, privacy_toggle(private), status_legend(), rows))
    client = next((c for c in clients if c["folder"] == folder), None)
    if client is None:
        return None
    saved_status = read_json(REPORT_STATUS, {}) or {}
    info = (saved_status.get("clients") or {}).get(folder) or {}
    def month_row(m):
        gaps = missing_for(info, m["file"][:7])
        warn = "<small class=gap>Built without: %s</small>" % html.escape(", ".join(mask(g) for g in gaps)) if gaps else ""
        return "<a class=row href='/reports/%s/%s/%s/view%s'>%s%s</a>" % (slug(folder), m["year"], m["file"][:7], sign, html.escape(m["label"]), warn)
    rows = "".join(month_row(m) for m in client["months"]) or "<p><small>No reports saved yet.</small></p>"
    why = ""
    entry = next(((label, color) for k, label, color, _ in REPORT_STATUSES if k == info.get("status")), None)
    if entry:
        label, color = entry
        lines = "".join("<p>%s</p>" % html.escape(line) for line in status_reason(info, private=private))
        facts, note = status_facts(info, mask)
        if facts:
            lines += "<dl>%s</dl>" % "".join("<dt>%s</dt><dd>%s</dd>" % (html.escape(k), html.escape(v)) for k, v in facts)
        lines += statement_list(info, mask)
        lines += feed_list(info, mask, private)
        if note:
            lines += "<blockquote><b>Our note to the client in Double</b>%s</blockquote>" % (
                "<i>Hidden in privacy mode</i>" if private else html.escape(note))
        checked = (saved_status.get("updated") or "").replace("T", " ")[:16]
        late = days_late(info)
        head = "<span class=tag style='color:%s;border-color:%s'>%s</span>" % (color, color, html.escape(label))
        if late:
            head += "<span class=late style='color:%s'>%d day%s late</span>" % (color, late, "" if late == 1 else "s")
        why = ("<div class=why style='border-left:5px solid %s'><div class=head>%s</div>%s"
               "<small>Checked in Double %s</small></div>" % (color, head, lines, html.escape(checked)))
    name = shown(client)
    return ("<!doctype html><html lang=en><head><meta charset=utf-8><title>%s reports</title>%s</head><body>"
            "<a class=back href='/reports%s'>&lsaquo; All clients</a><div class=top><h1>%s</h1>%s</div>%s<h2>Reports</h2>%s</body></html>"
            % (html.escape(name), style, sign, html.escape(name), privacy_toggle(private), why, rows))


REPORT_VIEWER = r"""<!doctype html><html lang=en><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>__TITLE__</title><style>
html,body{margin:0;background:#475569;font:15px/1.3 system-ui,sans-serif}
#bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#0f172a;color:#e2e8f0;padding:8px 10px}
#bar a,#bar button{color:#fff;background:#334155;border:0;border-radius:8px;padding:8px 12px;font:600 15px system-ui,sans-serif;text-decoration:none;cursor:pointer}
#bar button:active,#bar a:active{background:#1e293b}
#bar .sp{flex:1 1 auto}#when{font-size:13px;color:#cbd5e1}#when b{color:#fff}
#pages{display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px 0 40px}
#pages canvas{display:block;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.4);max-width:100%;height:auto}
#msg{color:#e2e8f0;text-align:center;padding:30px 16px}
.pv{font:600 15px system-ui,sans-serif;border-radius:8px;padding:8px 12px;cursor:pointer;border:0;background:#334155;color:#fff}.pv.on{background:#7c3aed}
</style></head><body>
<div id=bar><a id=back href="__BACK__">&lsaquo; __CLIENT__</a><button id=refresh type=button>Refresh</button>
<span id=when>Loading&hellip;</span><span class=sp></span>__PRIVACY____DOWNLOAD__</div>
<div id=pages><div id=msg>Loading report&hellip;</div></div>
<script src="/reports/_pdfjs/pdf.min.js?__SIGN__"></script>
<script>
(function(){
var CFG=__CFG__;
var sign=CFG.sign, seen=null, busy=false, shown=false;
var pages=document.getElementById('pages'), when=document.getElementById('when');
pdfjsLib.GlobalWorkerOptions.workerSrc='/reports/_pdfjs/pdf.worker.min.js?'+sign;
function url(p,extra){return p+'?'+sign+(extra||'');}
function setSign(r){
  sign='exp='+r.exp+'&sig='+r.sig;
  document.getElementById('back').href='/reports/'+CFG.folder+'?'+sign;
  var dl=document.getElementById('dl');if(dl)dl.href=url(CFG.raw);
}
function stamp(sec){
  var d=new Date(sec*1000);
  var t=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(d);
  when.innerHTML='Updated <b>'+t+'</b>';
}
function note(text){when.textContent=text;}
// Privacy mode: black out the client's name (matched by word hash, so this page never carries it)
// and anything shaped like an account number, email, phone or tax id, before the page is shown.
var WORDS=null;
if(CFG.privacy){WORDS={};CFG.privacy.words.forEach(function(h){WORDS[h]=1;});}
function fnv(w){var h=0x811c9dc5;for(var i=0;i<w.length;i++){h^=w.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h>>>0;}
// Account-shaped text names the whole line ('*1234 TCB Chk - Owner Personal'): hide the line.
var LINE=[
  /(?<![A-Za-z])(?:[xX*•#]+|\.{2,}|…)\s?\d{2,}/,
  /(?:ending(?:\s+in)?|acct\.?|account(?:\s*(?:number|no\.?))?|a\/c)[\s:#xX*•]*\d{3,}/i,
  /\(\s*[xX*•#]*\d{3,}\s*\)/,
  /[A-Za-z)\]]\s*(?:[-–—:#]\s*)?(?!(?:19|20)\d\d\s*$)\d{4}\s*$/,
  /\(deleted\)/i
];
// Hide just the matching text.
var SPAN=[
  /[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/g,
  /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g,
  /\b\d{2}-\d{7}\b|\b\d{3}-\d{2}-\d{4}\b/g,
  /(?<![\d.,$])\d{5,}(?!\d|[.,]\d|\s?%)/g,
  /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:(?:\d+(?:st|nd|rd|th)|[A-Za-z][A-Za-z'.-]*)\s+){1,4}(?:Rd|Road|St|Street|Ave|Avenue|Dr|Drive|Ln|Lane|Blvd|Boulevard|Ct|Court|Way|Pl|Place|Pkwy|Parkway|Hwy|Highway|Cir|Circle|Trl|Trail|Loop|Ter|Terrace|Cv|Cove|Bend|Xing|Fwy|Freeway)\b\.?/gi,
  /\b[NSEW]\.?\s+\d+(?:st|nd|rd|th)\s+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive)\b/gi,
  /\bP\.?\s?O\.?\s*Box\s*\d+/gi,
  /\b(?:FM|CR|RM|SH|County\s+Road|Farm\s+to\s+Market)\s*-?\s*\d{2,4}\b/gi
];
// Owner and equity lines name a person after the dash ('Distributions - First Last'): hide the name.
var TAIL=/\b(?:distributions?|draws?|owner'?s?(?:\s+(?:draw|equity|contributions?|investment|distributions?|pay|loan))?|shareholder(?:\s+(?:loan|distributions?|contributions?))?|member(?:\s+(?:draws?|distributions?|contributions?))?|partner(?:\s+(?:draws?|distributions?|contributions?))?|contributions?)\s*[-–—:]\s*(\S.*)$/id;
var RANKED=/^\s*\d{1,2}\.\s+(\S.*)$/d;
var POSSESSIVE=/\b[A-Z][a-z]+['\u2019]s\b/g;
function spans(s){
  var out=[],m;
  for(var i=0;i<LINE.length;i++)if(LINE[i].test(s))return [[0,s.length]];
  SPAN.forEach(function(p){p.lastIndex=0;while((m=p.exec(s)))out.push([m.index,m.index+m[0].length]);});
  if((m=TAIL.exec(s)))out.push(m.indices[1]);
  // Numbered lists ('3. Jane Smith', the top payees) are mostly people: hide the name, keep the rank.
  if((m=RANKED.exec(s)))out.push(m.indices[1]);
  // A capitalised possessive in summary text is usually a person ('Jane's draw').
  POSSESSIVE.lastIndex=0;while((m=POSSESSIVE.exec(s)))out.push([m.index,m.index+m[0].length]);
  return out;
}
function hits(s){
  var out=spans(s),m,re=/[A-Za-z0-9]+/g;
  while((m=re.exec(s))){var w=m[0].toLowerCase();if(w.length>=2&&WORDS[fnv(w)])out.push([m.index,m.index+m[0].length]);}
  return out;
}
async function redact(page,vp,ctx){
  var tc=await page.getTextContent();
  ctx.fillStyle='#0f172a';
  tc.items.forEach(function(it){
    var s=it.str||'';if(!s.trim())return;
    var spans=hits(s);if(!spans.length)return;
    var t=pdfjsLib.Util.transform(vp.transform,it.transform);
    // Character widths vary, so each bar reaches one average character past its text on both sides.
    var h=Math.hypot(t[2],t[3]),w=it.width*vp.scale,per=w/s.length,pad=Math.max(per*1.6,h*0.3);
    spans.forEach(function(sp){
      var x0=t[4]+Math.max(0,sp[0]*per-pad),x1=t[4]+Math.min(w+pad,sp[1]*per+pad);
      ctx.fillRect(x0,t[5]-h*1.05,x1-x0,h*1.35);
    });
  });
}
async function render(buf,mtime){
  var pdf=await pdfjsLib.getDocument({data:buf}).promise;
  var width=Math.min(document.documentElement.clientWidth,1000);
  var scale=Math.min(Math.max(window.devicePixelRatio||1,2),3);
  var canvases=[];
  for(var n=1;n<=pdf.numPages;n++){
    var page=await pdf.getPage(n);
    var base=page.getViewport({scale:1});
    var vp=page.getViewport({scale:(width/base.width)*scale});
    var c=document.createElement('canvas');c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);
    c.style.width=(c.width/scale)+'px';
    await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
    if(WORDS)await redact(page,vp,c.getContext('2d'));
    canvases.push(c);
  }
  // Keep the reader's place: which page is at the top, and how far down it.
  var keep=null,old=pages.querySelectorAll('canvas');
  for(var i=0;i<old.length;i++){var r=old[i].getBoundingClientRect();
    if(r.bottom>document.getElementById('bar').offsetHeight){keep={i:i,f:(document.getElementById('bar').offsetHeight-r.top)/r.height};break;}}
  pages.replaceChildren.apply(pages,canvases);
  if(keep&&canvases.length){var t=canvases[Math.min(keep.i,canvases.length-1)];
    window.scrollTo(0,window.scrollY+t.getBoundingClientRect().top-document.getElementById('bar').offsetHeight+keep.f*t.getBoundingClientRect().height);}
  shown=true;stamp(mtime);
  pdf.destroy();
}
async function load(mtime){
  var res=await fetch(url(CFG.raw,'&t='+Date.now()),{cache:'no-store'});
  if(!res.ok)throw new Error('http '+res.status);
  var buf=await res.arrayBuffer();
  await render(buf,mtime);
}
async function check(force){
  if(busy)return;busy=true;
  try{
    var res=await fetch(url(CFG.stat,'&t='+Date.now()),{cache:'no-store'});
    if(res.status===403){note('This link expired. Go back and open the report again.');return;}
    if(!res.ok)throw new Error('http '+res.status);
    var s=await res.json();
    if(s.renew)setSign(s.renew);
    var key=s.mtime+':'+s.size;
    if(force||key!==seen){await load(s.mtime);seen=key;}
  }catch(e){
    // A half-saved file or a dropped connection: keep what is on screen and try again next time.
    if(!shown){pages.innerHTML='<div id=msg>Could not load the report yet. Trying again&hellip;</div>';}
    else{note('Update failed, retrying…');}
  }finally{busy=false;}
}
document.getElementById('refresh').onclick=function(){note('Refreshing…');check(true);};
document.addEventListener('visibilitychange',function(){if(!document.hidden)check(false);});
check(true);setInterval(function(){if(!document.hidden)check(false);},10000);
})();
</script></body></html>"""


def report_viewer_page(root, folder, year, month, query, private=False):
    """The HTML viewer for one report: PDF.js on ripley, a top bar, and a page that refreshes itself."""
    import html
    name = "%s-%s.pdf" % (year, month)
    if report_path(root, folder, year, name) is None:
        return None
    shown = client_alias(folder) if private else client_name(folder)
    label = "%s %s" % (shown, "%s %s" % (MONTHS[int(month) - 1], year))
    link = alias_slug(folder) if private else folder
    raw = "/reports/%s/%s/%s" % (link, year, name)
    cfg = {"sign": query, "folder": link, "raw": raw, "stat": "/reports/%s/%s/%s-%s/stat" % (link, year, year, month),
           "privacy": {"words": privacy_words(folder)} if private else None}
    # The privacy switch reuses the list pages' button, restyled for the dark bar; no Download while it is on.
    toggle = privacy_toggle(private)
    download = "" if private else '<a id=dl href="%s">Download</a>' % html.escape(raw + "?" + query)
    return (REPORT_VIEWER.replace("__TITLE__", html.escape(label)).replace("__CLIENT__", html.escape(shown))
            .replace("__PRIVACY__", toggle).replace("__DOWNLOAD__", download)
            .replace("__BACK__", "/reports/%s?%s" % (link, query))
            .replace("__SIGN__", query).replace("__CFG__", json.dumps(cfg).replace("<", "\\u003c")))


def resumable_batch(inbox, name, size):
    """A batch still waiting on this same file, so a re-pick carries on."""
    try:
        names = sorted(os.listdir(inbox))
    except OSError:
        return None
    for batch in names:
        folder = os.path.join(inbox, batch)
        if not BATCH.match(batch) or not os.path.isdir(folder):
            continue
        meta = read_json(os.path.join(folder, ".batch.json"), None) or {}
        if meta.get("files", {}).get(name) == size and not os.path.exists(os.path.join(folder, name + ".receipt.json")):
            return batch
    return None


SEND_PAGE = """<!doctype html><html lang=en><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>Send to ripley</title><style>
body{font:17px/1.45 system-ui,sans-serif;margin:0;padding:24px;background:#f8fafc;color:#0f172a}
h1{font-size:24px;margin:0 0 8px}h2{font-size:20px;margin:32px 0 8px}p{color:#475569;margin:0 0 20px}
label{display:inline-block;background:#0f172a;color:#fff;border-radius:999px;padding:14px 24px;font-weight:600}
ol{list-style:none;padding:0;margin:10px 0 0}ol li{border:0;padding:3px 0 3px 28px;margin:0;position:relative;background:none;color:#94a3b8}
ol li:before{position:absolute;left:4px;content:"○"}ol li.done{color:#475569}ol li.done:before{content:"✓";color:#15803d}
ol li.now{color:#0f172a;font-weight:600}ol li.now:before{content:"●"}ol li.stopped{color:#be123c;font-weight:600}ol li.stopped:before{content:"✕"}ol small,ol .meter span{font-weight:400}
input{display:none}a{display:inline-block;margin-top:6px;color:#0f172a;font-weight:600}ul{list-style:none;padding:0;margin:12px 0 0}
li{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;word-break:break-word}
b{display:block}.ok{color:#15803d}.bad{color:#be123c}small{display:block;color:#64748b}
.bar{height:6px;background:#e2e8f0;border-radius:3px;margin-top:8px}.bar i{display:block;height:6px;background:#0f172a;border-radius:3px}
.meter{display:flex;align-items:center;gap:10px;margin-top:10px}.meter span{flex:0 0 7.5em;font-size:14px;color:#475569}
.meter .bar{flex:1;height:10px;margin:0;border-radius:5px}.meter .bar i{height:10px;border-radius:5px}.meter b{flex:0 0 3.2em;text-align:right;font-size:15px}
</style></head><body>
<label for=f>Choose videos and pictures</label>
<p style="margin-top:12px">Pick everything for one video at once. Keep this screen open while it sends.</p>
<p><a id=getapp href="#">Get the phone app</a> (keeps sending through calls and other apps)</p>
<input id=f type=file accept="video/*,image/*" multiple>
<p id=msg class=bad></p>
<ul id=queue></ul>
<script>
const q=new URLSearchParams(location.search);
// Same signed link as this page, so the download needs no extra sign-in.
document.getElementById('getapp').href='/app.apk?'+new URLSearchParams({exp:q.get('exp'),sig:q.get('sig')});
const f=document.getElementById('f'),queueEl=document.getElementById('queue'),msg=document.getElementById('msg');
let chain=Promise.resolve();
const CHUNK=8*1024*1024;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const auth={sexp:q.get('exp'),ssig:q.get('sig')};
f.onchange=async()=>{const files=[...f.files];f.value='';if(!files.length)return;msg.textContent='';
let batch=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
try{const r=await(await fetch('/resume?'+new URLSearchParams({...auth,name:files[0].name,size:files[0].size}))).json();if(r.batch)batch=r.batch;}catch(e){}
for(const file of files)chain=chain.then(()=>send(file,batch,files.length));chain.then(refresh);setTimeout(refresh,800);};
async function where(base){const r=await fetch('/upload-status?'+new URLSearchParams(base),{cache:'no-store'});return r.json();}
async function send(file,batch,count){
 const base={...auth,size:file.size,name:file.name,batch,count};
 let received=0,tries=0;
 try{received=(await where(base)).received;}catch(e){}
 while(received<file.size){
  try{
   const end=Math.min(received+CHUNK,file.size);
   const r=await fetch('/upload?'+new URLSearchParams({...base,offset:received}),{method:'PUT',body:file.slice(received,end)});
   const j=await r.json();
   if(r.status===200||r.status===409){received=j.done?file.size:j.received;tries=0;continue;}
   if(r.status>=400&&r.status<500){msg.textContent=file.name+' was not sent: '+(j.error||'refused')+' Tell Ummon.';return;}
   throw new Error(j.error||'send failed');
  }catch(e){
   tries++;if(tries>120){msg.textContent=file.name+' could not be sent after many tries. Choose it again.';return;}
   await sleep(Math.min(20000,1000*tries));
   try{received=(await where(base)).received;}catch(e2){}
  }
 }
}
const when=t=>t?new Date(t*1000).toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'}):'';
const again=v=>v.reused?' '+v.reused+(v.reused===1?' file was':' files were')+' already on ripley, so not sent again.':'';
const mb=n=>(n/1e6).toLocaleString(undefined,{maximumFractionDigits:0})+' MB';
// Every autopilot step, ticked off as it goes; the render bars sit under the render step.
function steps(v){const ol=document.createElement('ol');
 for(const s of v.steps){const li=document.createElement('li');li.className=s.state;li.textContent=s.label;
  if(s.state==='stopped'&&s.message){const m=document.createElement('small');m.textContent=s.message;li.append(m);}
  const r=v.render||{};
  if(s.state==='now'&&r.total!==undefined){
   if(r.piece)li.append(meter('Piece '+r.piece+' of '+r.pieces,r.pieceShare));
   li.append(meter('Whole video',r.total));
   if(r.minutesLeft){const m=document.createElement('small');m.textContent='About '+r.minutesLeft+' min left';li.append(m);}}
  ol.append(li);}
 return ol;}
// One labelled bar with its percent at the end, for the render.
function meter(label,share){const pct=Math.floor(100*Math.min(1,Math.max(0,share||0)));
 const row=document.createElement('div');row.className='meter';const l=document.createElement('span');l.textContent=label;
 const bar=document.createElement('div');bar.className='bar';const i=document.createElement('i');i.style.width=pct+'%';bar.append(i);
 const n=document.createElement('b');n.textContent=pct+'%';row.append(l,bar,n);return row;}
function line(v){
 if(v.state==='sending'){const pct=v.bytes?Math.floor(100*v.done/v.bytes):0;
  return ['Sending '+Math.min(v.received+1,v.expected)+' of '+v.expected+' — '+pct+'%',mb(v.done)+' of '+mb(v.bytes)+again(v),pct];}
 if(v.state==='received')return ['Received. Making the episode...','Up to a minute.'+again(v)];
 if(v.state==='paused'){const pct=v.bytes?Math.floor(100*v.done/v.bytes):0;return ['Paused at '+pct+'%','Keep this page open; it carries on by itself. If you closed it, choose the same video again.',pct];}
 if(v.state==='incomplete')return ['Some files did not arrive','Send them again.'];
 if(v.state==='error')return ['Needs attention',v.message||''];
 return [v.stage||'Episode ready',''];}
function refresh(){fetch('/status.json?'+new URLSearchParams({exp:q.get('exp'),sig:q.get('sig')}),{cache:'no-store'})
.then(r=>r.json()).then(d=>{queueEl.innerHTML='';
 for(const v of d.videos.filter(v=>!v.url)){const li=document.createElement('li');const [head,sub,pct]=line(v);
  const t=document.createElement('b');t.textContent=v.project||('New video, sent '+when(v.created));li.append(t);
  if(v.steps&&v.steps.length){li.append(steps(v));queueEl.append(li);continue;}
  const h=document.createElement('span');h.textContent=head;h.className=v.state==='error'||v.state==='incomplete'||v.state==='paused'?'bad':(v.project?'ok':'');li.append(h);
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
        if path in ("/upload-status", "/resume"):
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            secret = os.environ.get("PHONE_INTAKE_SECRET", "")
            try:
                sexp = int(query.get("sexp", ["0"])[0])
                size = int(query.get("size", ["0"])[0])
            except ValueError:
                sexp, size = 0, 0
            if not secret or sexp < int(time.time()) or not session_ok(secret, sexp, query.get("ssig", [""])[0]):
                self._json(403, {"error": "This send link has expired. Open New video on the site again."})
                return
            name = safe_name(query.get("name", [""])[0])
            if path == "/resume":
                self._json(200, {"batch": resumable_batch(INBOX, name, size)})
                return
            batch = query.get("batch", [""])[0]
            if not BATCH.match(batch):
                self._json(400, {"error": "The batch is not valid."})
                return
            folder = os.path.join(INBOX, batch)
            state = upload_state(folder, name, size)
            head = query.get("head", [""])[0]
            head = head if re.fullmatch(r"[0-9a-f]{64}", head) else ""
            found = None if state["done"] or size <= 0 else known_copy(INBOX, name, size, batch, head)
            if found:
                try:
                    expected = int(query.get("count", ["1"])[0])
                except ValueError:
                    expected = 1
                state = reuse_copy(folder, name, size, expected, found)
            self._json(200, state)
            return
        if path == "/app/version":
            # What the latest built app is, so the app's splash screen can say up to date or offer
            # the update. Written next to the APK when it is staged (android/phone-send/README.md).
            self._json(200, read_json(os.path.splitext(APK)[0] + ".json", {}) or {})
            return
        if path in ("/app.apk", "/app"):
            # The phone app download: behind the send page's signed link, or the short /app?k= key.
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            secret = os.environ.get("PHONE_INTAKE_SECRET", "")
            try:
                exp = int(query.get("exp", ["0"])[0])
            except ValueError:
                exp = 0
            short = bool(secret) and hmac.compare_digest(app_key(secret), query.get("k", [""])[0])
            if not short and (not secret or exp < int(time.time()) or not session_ok(secret, exp, query.get("sig", [""])[0])):
                self._send(403, "This link has expired.", "text/plain; charset=utf-8")
                return
            try:
                with open(APK, "rb") as handle:
                    data = handle.read()
            except OSError:
                self._send(404, "The phone app has not been built yet.", "text/plain; charset=utf-8")
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.android.package-archive")
            self.send_header("Content-Disposition", 'attachment; filename="swapp.apk"')
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if path in ("/reports", "/reports.json") or path.startswith("/reports/"):
            # Published client reports, behind the same signed link as the send page.
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            secret = os.environ.get("PHONE_INTAKE_SECRET", "")
            try:
                exp = int(query.get("exp", ["0"])[0])
            except ValueError:
                exp = 0
            if not secret or exp < int(time.time()) or not session_ok(secret, exp, query.get("sig", [""])[0]):
                self._send(403, "This link has expired. Open Reports in SWapp again.", "text/plain; charset=utf-8")
                return
            sign = urllib.parse.urlencode({"exp": exp, "sig": query.get("sig", [""])[0]})
            private = privacy_on(self.headers.get("Cookie"))
            if path == "/reports.json":
                # Every published report, for the app's "new report" phone alert.
                items = [{"client": c["folder"], "name": c["name"], "label": m["label"],
                          "path": "/reports/%s/%s/%s" % (c["folder"], m["year"], m["file"])}
                         for c in list_reports(REPORTS_ROOT) for m in c["months"]]
                self._json(200, {"reports": items})
                return
            parts = [urllib.parse.unquote(p) for p in path.split("/")[2:] if p]
            if parts and parts[0] != "_pdfjs":
                token, parts[0] = parts[0], resolve_folder(parts[0])
                if private and token == parts[0] and token in (read_json(REPORT_NAMES, {}) or {}):
                    # Privacy on and a real client folder in the address bar (a link from before the
                    # switch, or history): move to the alias address so the name leaves the screen.
                    self.send_response(302)
                    self.send_header("Location", "/reports/%s?%s" % ("/".join([alias_slug(token)] + parts[1:]),
                                                                   urllib.parse.urlparse(self.path).query))
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
            if len(parts) == 2 and parts[0] == "_pdfjs" and parts[1] in PDFJS_FILES:
                with open(os.path.join(PDFJS_DIR, parts[1]), "rb") as handle:
                    data = handle.read()
                self.send_response(200)
                self.send_header("Content-Type", PDFJS_FILES[parts[1]])
                self.send_header("Cache-Control", "private, max-age=86400")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            if len(parts) == 4 and parts[3] in ("view", "stat") and re.match(r"^\d{4}-\d{2}$", parts[2]) and parts[2][:4] == parts[1]:
                real = report_path(REPORTS_ROOT, parts[0], parts[1], parts[2] + ".pdf")
                if real is None or not 1 <= int(parts[2][5:]) <= 12:
                    self._send(404, "No such report.", "text/plain; charset=utf-8")
                    return
                if parts[3] == "stat":
                    info = os.stat(real)
                    payload = {"mtime": int(info.st_mtime), "size": info.st_size}
                    if exp - int(time.time()) < REPORT_RENEW_BELOW:
                        fresh = int(time.time()) + REPORT_SESSION_SECONDS
                        payload["renew"] = {"exp": fresh, "sig": sign_session(secret, fresh)}
                    self._json(200, payload)
                    return
                body = report_viewer_page(REPORTS_ROOT, parts[0], parts[1], parts[2][5:], sign, private).encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Cache-Control", "private, no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if len(parts) <= 1:
                page = reports_page(REPORTS_ROOT, parts[0] if parts else None, sign, private)
                if page is None:
                    self._send(404, "No such client.", "text/plain; charset=utf-8")
                    return
                self.send_response(200)
                body = page.encode()
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Cache-Control", "private, no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            real = report_path(REPORTS_ROOT, *parts) if len(parts) == 3 else None
            if real is None:
                self._send(404, "No such report.", "text/plain; charset=utf-8")
                return
            with open(real, "rb") as handle:
                data = handle.read()
            label = "%s %s" % (client_alias(parts[0]) if private else client_name(parts[0]), parts[2][:-4])
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Disposition", 'inline; filename="%s.pdf"' % re.sub(r"[^A-Za-z0-9 _-]", "", label))
            self.send_header("Cache-Control", "private, no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
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

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/cancel":
            self._json(404, {"error": "Not found."})
            return
        query = urllib.parse.parse_qs(parsed.query)
        secret = os.environ.get("PHONE_INTAKE_SECRET", "")
        try:
            sexp = int(query.get("sexp", ["0"])[0])
        except ValueError:
            sexp = 0
        if not secret or sexp < int(time.time()) or not session_ok(secret, sexp, query.get("ssig", [""])[0]):
            self._json(403, {"error": "This send link has expired."})
            return
        batch = query.get("batch", [""])[0]
        if not BATCH.match(batch):
            self._json(400, {"error": "The batch is not valid."})
            return
        self._json(*cancel_batch(INBOX, batch))

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
        if "offset" in query and "ssig" in query:
            self._put_chunk(query, secret, name, size, length)
            return
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


def put_chunk(handler, query, secret, name, size, length):
    """One slice of a send-page file at a byte offset. A dropped connection
    keeps what arrived; the page asks where to carry on and resends from there."""
    try:
        sexp = int(query.get("sexp", ["0"])[0])
        offset = int(query.get("offset", ["-1"])[0])
        expected = max(1, min(int(query.get("count", ["1"])[0]), 200))
    except ValueError:
        handler._json(400, {"error": "The piece is not valid."})
        return
    if sexp < int(time.time()) or not session_ok(secret, sexp, query.get("ssig", [""])[0]):
        handler._json(403, {"error": "This send link has expired. Open New video on the site again."})
        return
    batch = query.get("batch", [""])[0]
    if not BATCH.match(batch) or size < 1 or size > MAX_BYTES or length < 1 or offset < 0 or offset + length > size:
        handler._json(400, {"error": "The piece is not valid."})
        return
    folder = os.path.join(INBOX, batch)
    os.makedirs(folder, exist_ok=True)
    note_batch_file(folder, expected, name, size)
    current = upload_state(folder, name, size)
    if current["done"]:
        handler._json(200, current)
        return
    if offset != current["received"]:
        handler._json(409, current)
        return
    final = os.path.join(folder, name)
    left = length
    try:
        with open(final + ".part", "ab") as handle:
            while left > 0:
                block = handler.rfile.read(min(1024 * 1024, left))
                if not block:
                    break
                handle.write(block)
                left -= len(block)
    except (ConnectionError, BrokenPipeError, OSError):
        left = 1
    if left:
        handler.close_connection = True
        handler._json(400, upload_state(folder, name, size))
        return
    if os.path.getsize(final + ".part") >= size:
        receipt = finalize_upload(final, name)
        handler._json(200, {"received": size, "done": True, "receipt": receipt})
        return
    handler._json(200, upload_state(folder, name, size))


Handler._put_chunk = lambda self, query, secret, name, size, length: put_chunk(self, query, secret, name, size, length)


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
        sent = response.read()
        assert b"Send to ripley" in sent and b"Get the phone app" in sent
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
    big = b"0123456789" * 3
    base = "http://%s:%d/upload?sexp=%d&ssig=%s&size=%d&name=big.mp4&batch=b2&count=1" % (host, port, sexp, ssig, len(big))
    def piece(offset, data):
        request = urllib.request.Request(base + "&offset=%d" % offset, data=data, method="PUT")
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.loads(response.read().decode())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read().decode())
    assert piece(0, big[:12]) == (200, {"received": 12, "done": False})
    code, state = piece(0, big[:12])
    assert code == 409 and state["received"] == 12, (code, state)
    stat_url = "http://%s:%d/upload-status?sexp=%d&ssig=%s&size=%d&name=big.mp4&batch=b2" % (host, port, sexp, ssig, len(big))
    with urllib.request.urlopen(stat_url) as response:
        assert json.loads(response.read().decode())["received"] == 12
    resume_url = "http://%s:%d/resume?sexp=%d&ssig=%s&size=%d&name=big.mp4" % (host, port, sexp, ssig, len(big))
    with urllib.request.urlopen(resume_url) as response:
        assert json.loads(response.read().decode())["batch"] == "b2"
    code, state = piece(12, big[12:])
    assert code == 200 and state["done"] and state["receipt"]["sha256"] == hashlib.sha256(big).hexdigest(), state
    # The same video picked again for a new video is not sent twice: ripley reuses its copy.
    os.makedirs(os.path.join(INBOX, "done"), exist_ok=True)
    os.replace(os.path.join(INBOX, "b2"), os.path.join(INBOX, "done", "b2"))
    again_url = "http://%s:%d/upload-status?sexp=%d&ssig=%s&size=%d&name=big.mp4&batch=b4&count=1" % (host, port, sexp, ssig, len(big))
    with urllib.request.urlopen(again_url) as response:
        assert json.loads(response.read().decode()) == {"received": len(big), "done": True, "reused": True}
    reused = os.path.join(INBOX, "b4", "big.mp4")
    assert open(reused, "rb").read() == big
    assert read_json(reused + ".receipt.json", {})["sha256"] == hashlib.sha256(big).hexdigest()
    with urllib.request.urlopen(status_url) as response:
        row = [v for v in json.loads(response.read().decode())["videos"] if v["batch"] == "b4"][0]
    assert row["state"] == "received" and row["reused"] == 1, row
    other_size = "http://%s:%d/upload-status?sexp=%d&ssig=%s&size=%d&name=big.mp4&batch=b5&count=1" % (host, port, sexp, ssig, len(big) + 1)
    with urllib.request.urlopen(other_size) as response:
        assert json.loads(response.read().decode()) == {"received": 0, "done": False}
    # Cancel throws away a half-sent batch, and refuses one that fully arrived.
    def post(path):
        try:
            with urllib.request.urlopen(urllib.request.Request(path, data=b"", method="POST")) as response:
                return response.status, json.loads(response.read().decode())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read().decode())
    half = "http://%s:%d/upload?sexp=%d&ssig=%s&size=4&name=c.mp4&batch=b6&count=2" % (host, port, sexp, ssig)
    with urllib.request.urlopen(urllib.request.Request(half, data=body, method="PUT")):
        pass
    cancel = "http://%s:%d/cancel?sexp=%d&ssig=%s&batch=" % (host, port, sexp, ssig)
    assert post(cancel + "b6") == (200, {"cancelled": True}) and not os.path.exists(os.path.join(INBOX, "b6"))
    assert post(cancel + "b4")[0] == 409 and os.path.isdir(os.path.join(INBOX, "b4"))
    assert post(cancel + "nope") == (200, {"cancelled": False})
    assert post(cancel.replace("ssig=", "ssig=00") + "b4")[0] == 403
    # The app download needs the signed link.
    global APK
    APK = os.path.join(INBOX, "app.apk")
    with open(APK, "wb") as handle:
        handle.write(b"PK-app")
    with urllib.request.urlopen(page.replace("/send?", "/app.apk?")) as response:
        assert response.read() == b"PK-app"
    try:
        urllib.request.urlopen(page.replace("/send?", "/app.apk?") + "00")
        raise SystemExit("bad app link was accepted")
    except urllib.error.HTTPError as error:
        assert error.code == 403, error.code
    # The app sends the first MiB's hash, so a renamed copy of a received clip is still reused.
    renamed = "http://%s:%d/upload-status?sexp=%d&ssig=%s&size=%d&name=PXL_renamed.mp4&batch=b7&count=1&head=%s" % (
        host, port, sexp, ssig, len(big), hashlib.sha256(big).hexdigest())
    with urllib.request.urlopen(renamed) as response:
        assert json.loads(response.read().decode()) == {"received": len(big), "done": True, "reused": True}
    wrong = "http://%s:%d/upload-status?sexp=%d&ssig=%s&size=%d&name=PXL_renamed.mp4&batch=b8&count=1&head=%s" % (
        host, port, sexp, ssig, len(big), "0" * 64)
    with urllib.request.urlopen(wrong) as response:
        assert json.loads(response.read().decode()) == {"received": 0, "done": False}
    write_json(os.path.splitext(APK)[0] + ".json", {"versionCode": 3, "versionName": "3.0"})
    with urllib.request.urlopen("http://%s:%d/app/version" % (host, port)) as response:
        assert json.loads(response.read().decode()) == {"versionCode": 3, "versionName": "3.0"}
    # The short app link works with its key and only with it.
    with urllib.request.urlopen("http://%s:%d/app?k=%s" % (host, port, app_key(secret))) as response:
        assert response.read() == b"PK-app"
    try:
        urllib.request.urlopen("http://%s:%d/app?k=000000000000" % (host, port))
        raise SystemExit("bad short app key was accepted")
    except urllib.error.HTTPError as error:
        assert error.code == 403, error.code
    # Rows take last month's status from report-status.json; no saved reports stays grey.
    global REPORT_STATUS
    REPORT_STATUS = os.path.join(INBOX, "status.json")
    write_json(REPORT_STATUS, {"clients": {"bnb-getaway": {"status": "late", "month": "2026-10", "due": "2026-11-06", "close": "notStarted"}, "sj-equity-llc": {"status": "done"}}})
    # Reports: signed list, client page, the PDF itself; nothing outside reports/<year>/<YYYY-MM>.pdf.
    global REPORTS_ROOT
    REPORTS_ROOT = os.path.join(INBOX, "clients")
    os.makedirs(os.path.join(REPORTS_ROOT, "bnb-getaway", "reports", "2026"))
    with open(os.path.join(REPORTS_ROOT, "bnb-getaway", "reports", "2026", "2026-10.pdf"), "wb") as handle:
        handle.write(b"%PDF-oct")
    with open(os.path.join(REPORTS_ROOT, "bnb-getaway", "secret.txt"), "wb") as handle:
        handle.write(b"no")
    global REPORT_NAMES, REPORT_ALIASES, REPORT_PRIVACY_WORDS
    REPORT_NAMES = os.path.join(INBOX, "names.json")
    REPORT_ALIASES = os.path.join(INBOX, "aliases.json")
    REPORT_PRIVACY_WORDS = os.path.join(INBOX, "privacy-words.json")
    write_json(REPORT_NAMES, {"bnb-getaway": "BnB Getaway LLC", "sj-equity-llc": "SJ Equity LLC"})
    reports = "http://%s:%d/reports" % (host, port)
    signed = "?exp=%d&sig=%s" % (sexp, ssig)
    with urllib.request.urlopen(reports + signed) as response:
        page = response.read()
        # Client rows show the name only; descriptions live inside the legend's sample rows.
        clients_part = page.split(b"</details>", 1)[1]
        assert b"BnB Getaway LLC" in clients_part and b"SJ Equity LLC" in clients_part and b"<small>" not in clients_part
        # Any client with a status opens and shows its tag, even before reports are saved.
        assert b">Late</span>" in clients_part and b">Done</span>" in clients_part and b"/reports/sj-equity-llc?" in clients_part
        assert b"Waiting on client" in page and b"5th business day" in page
    with urllib.request.urlopen(reports + "/bnb-getaway" + signed) as response:
        client_page = response.read()
        # The client page opens with why the tag is what it is, above the months.
        assert b"October 2026" in client_page and b"class=why" in client_page and b"report was due" in client_page
    with urllib.request.urlopen(reports + "/sj-equity-llc" + signed) as response:
        assert b"No reports saved yet." in response.read()
    with urllib.request.urlopen(reports + "/bnb-getaway/2026/2026-10.pdf" + signed) as response:
        assert response.read() == b"%PDF-oct" and response.headers["Content-Type"] == "application/pdf"
    # The month link opens a viewer page; PDF.js and the file stamp come from the same signed link.
    assert b"/reports/bnb-getaway/2026/2026-10/view?" in client_page
    with urllib.request.urlopen(reports + "/bnb-getaway/2026/2026-10/view" + signed) as response:
        viewer = response.read()
        assert response.headers["Content-Type"].startswith("text/html") and b"/reports/_pdfjs/pdf.min.js" in viewer and b"October 2026" in viewer
    with urllib.request.urlopen(reports + "/_pdfjs/pdf.min.js" + signed) as response:
        assert len(response.read()) > 100_000
    long_exp = int(time.time()) + 3 * 3600
    with urllib.request.urlopen(reports + "/bnb-getaway/2026/2026-10/stat?exp=%d&sig=%s" % (long_exp, sign_session("self-test-secret", long_exp))) as response:
        stat = json.loads(response.read().decode())
        assert stat["size"] == 8 and stat["mtime"] > 0 and "renew" not in stat, stat
    # A link with under an hour left comes back with a fresh one, signed the same way.
    soon = int(time.time()) + 600
    with urllib.request.urlopen(reports + "/bnb-getaway/2026/2026-10/stat?exp=%d&sig=%s" % (soon, sign_session("self-test-secret", soon))) as response:
        renew = json.loads(response.read().decode())["renew"]
    assert renew["exp"] > time.time() + 3 * 3600 - 60 and session_ok("self-test-secret", renew["exp"], renew["sig"])
    # Privacy mode: aliases instead of names, account digits and notes hidden, no Download, and the
    # viewer carries word hashes of the name, never the name itself.
    write_json(REPORT_STATUS, {"clients": {"bnb-getaway": {
        "status": "late", "month": "2026-10", "due": "2026-11-06", "close": "notStarted", "note": "Call Jane Doe re 4821",
        "statements": [{"name": "*4821 WFB Chk", "lastEnd": "2026-10-31", "months": {"2026-10": "missing"}, "cadence": "monthly"}],
        "toReconcile": ["*9934 WNB Savings"], "feeds": {"accounts": [{"name": "*4821 WFB Chk", "state": "ok", "note": "Jane's card"}]}},
        "sj-equity-llc": {"status": "done"}}})
    def private_get(path):
        request = urllib.request.Request(reports + path + signed, headers={"Cookie": PRIVACY_COOKIE + "=1"})
        with urllib.request.urlopen(request) as response:
            return response.read()
    listing = private_get("")
    assert b"BnB Getaway" not in listing and b"SJ Equity" not in listing and b"Client A" in listing and b"Client B" in listing
    assert b"bnb-getaway" not in listing and b"sj-equity" not in listing and b"/reports/client-a?" in listing
    assert b"Privacy on" in listing and b"aria-pressed=true" in listing
    hidden = private_get("/bnb-getaway")
    for leak in (b"BnB", b"bnb-getaway", b"4821", b"9934", b"Jane"):
        assert leak not in hidden, leak
    assert b"Client A" in hidden and b"Hidden in privacy mode" in hidden and b"Account 1" in hidden and b"WFB" not in hidden
    # A real folder in the address bar moves to its alias while privacy is on; a client added later
    # gets the next letter and nobody else's letter changes.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    try:
        urllib.request.build_opener(NoRedirect).open(urllib.request.Request(
            reports + "/bnb-getaway/2026/2026-10/view" + signed, headers={"Cookie": PRIVACY_COOKIE + "=1"}))
        raise SystemExit("real folder was served with privacy on")
    except urllib.error.HTTPError as error:
        assert error.code == 302 and error.headers["Location"].startswith("/reports/client-a/2026/2026-10/view?"), error.headers["Location"]
    write_json(REPORT_NAMES, {"aaa-new-client": "AAA New", "bnb-getaway": "BnB Getaway LLC", "sj-equity-llc": "SJ Equity LLC"})
    assert (client_alias("bnb-getaway"), client_alias("sj-equity-llc"), client_alias("aaa-new-client")) == ("Client A", "Client B", "Client C")
    write_json(REPORT_NAMES, {"bnb-getaway": "BnB Getaway LLC", "sj-equity-llc": "SJ Equity LLC"})
    with urllib.request.urlopen(reports + "/bnb-getaway" + signed) as response:
        shown = response.read()
        assert b"4821" in shown and b"Jane Doe" in shown and b"Privacy off" in shown
    private_viewer = private_get("/bnb-getaway/2026/2026-10/view")
    assert b"BnB" not in private_viewer and b"getaway" not in private_viewer.lower()
    assert private_get("/client-a/2026/2026-10.pdf") == b"%PDF-oct" and b"Client A" in private_get("/client-a")
    assert b">Download<" not in private_viewer and b"Client A" in private_viewer
    assert str(privacy_hash("getaway")).encode() in private_viewer and privacy_hash("Get-Away") == privacy_hash("getaway")
    assert "llc" not in [w for w in ("llc",) if privacy_hash(w) in privacy_words("bnb-getaway")]
    assert b">Download<" in viewer
    assert mask_digits("*4821 WFB Chk") == "*\u2022\u2022\u2022\u2022 WFB Chk" and client_alias("sj-equity-llc") == "Client B"
    for bad in ("/_pdfjs/..%2Fphone_intake.py" + signed, "/_pdfjs/pdf.min.js" + signed.replace("sig=", "sig=00"),
                "/bnb-getaway/2026/2026-13/view" + signed, "/bnb-getaway/2026/2025-10/stat" + signed, "/bnb-getaway/2026/2026-10/other" + signed):
        try:
            urllib.request.urlopen(reports + bad)
            raise SystemExit("viewer request was allowed: " + bad)
        except urllib.error.HTTPError as error:
            assert error.code in (403, 404), (bad, error.code)
    with urllib.request.urlopen(reports + ".json" + signed) as response:
        listed = json.loads(response.read().decode())["reports"]
    assert listed == [{"client": "bnb-getaway", "name": "BnB Getaway LLC", "label": "October 2026",
                       "path": "/reports/bnb-getaway/2026/2026-10.pdf"}], listed
    for bad in ("/bnb-getaway/2026/2026-10.pdf" + signed.replace("sig=", "sig=00"),
                "/bnb-getaway/2026/..%2Fsecret.txt" + signed, "/bnb-getaway/2026/2025-10.pdf" + signed, "/bnb-getaway/../secret.txt" + signed):
        try:
            urllib.request.urlopen(reports + bad)
            raise SystemExit("report request was allowed: " + bad)
        except urllib.error.HTTPError as error:
            assert error.code in (403, 404), (bad, error.code)
    # A 4.97 GB phone video (2026-11-13) was refused by the old 3 GB cap.
    base = "http://%s:%d/upload?sexp=%d&ssig=%s&size=%d&name=huge.mp4&batch=b3&count=1" % (host, port, sexp, ssig, 4_969_898_905)
    assert piece(0, big) == (200, {"received": len(big), "done": False})
    server.shutdown()
    print("ok")


if __name__ == "__main__":
    if "--sign" in sys.argv:
        i = sys.argv.index("--sign")
        print(sign_ticket(sys.argv[i + 1], int(sys.argv[i + 2]), int(sys.argv[i + 3]), sys.argv[i + 4]))
        raise SystemExit(0)
    if "--app-key" in sys.argv:
        print(app_key(sys.argv[sys.argv.index("--app-key") + 1]))
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
